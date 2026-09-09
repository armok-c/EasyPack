use std::time::Duration;

const COLORREF_INVALID: u32 = u32::MAX;
const PICKER_TIMEOUT: Duration = Duration::from_secs(30);

/// Convert a Windows COLORREF (0x00BBGGRR) to the web color format.
pub(crate) fn colorref_to_hex(colorref: u32) -> Option<String> {
    if colorref == COLORREF_INVALID {
        return None;
    }

    let red = colorref & 0xff;
    let green = (colorref >> 8) & 0xff;
    let blue = (colorref >> 16) & 0xff;
    Some(format!("#{red:02x}{green:02x}{blue:02x}"))
}

#[cfg(windows)]
mod windows_impl {
    use super::{colorref_to_hex, PICKER_TIMEOUT};
    use std::collections::VecDeque;
    use std::ptr::null_mut;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Arc, Mutex, OnceLock};
    use std::thread;
    use std::time::{Duration, Instant};
    use windows_sys::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC, HDC};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, PeekMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, LLKHF_UP, MSG, MSLLHOOKSTRUCT, PM_REMOVE,
        WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP,
        WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    const POLL_INTERVAL: Duration = Duration::from_millis(5);

    enum HookEvent {
        LeftDown(POINT),
        LeftUp,
        EscapeDown,
        EscapeUp,
    }

    fn should_consume_input(cancel_requested: bool, is_down: bool, was_consumed: bool) -> bool {
        if is_down {
            !cancel_requested
        } else {
            was_consumed
        }
    }

    fn inputs_are_drained(consume_left: bool, consume_escape: bool) -> bool {
        !consume_left && !consume_escape
    }

    struct HookState {
        events: mpsc::Sender<HookEvent>,
        consume_left: AtomicBool,
        consume_escape: AtomicBool,
        cancel_requested: Arc<AtomicBool>,
    }

    const MAX_EARLY_CANCELLATIONS: usize = 16;
    const EARLY_CANCELLATION_TTL: Duration = Duration::from_secs(30);

    struct ActiveCapture {
        request_id: String,
        cancel_requested: Arc<AtomicBool>,
    }

    struct CaptureControl {
        active: Option<ActiveCapture>,
        early_cancellations: VecDeque<(String, Instant)>,
    }

    pub(super) struct CaptureRegistration {
        request_id: String,
        cancel_requested: Arc<AtomicBool>,
    }

    static ACTIVE: AtomicBool = AtomicBool::new(false);
    static CAPTURE_CONTROL: OnceLock<Mutex<CaptureControl>> = OnceLock::new();
    static HOOK_STATE: OnceLock<Mutex<Option<Arc<HookState>>>> = OnceLock::new();

    fn capture_control() -> &'static Mutex<CaptureControl> {
        CAPTURE_CONTROL.get_or_init(|| {
            Mutex::new(CaptureControl {
                active: None,
                early_cancellations: VecDeque::new(),
            })
        })
    }

    fn hook_state() -> &'static Mutex<Option<Arc<HookState>>> {
        HOOK_STATE.get_or_init(|| Mutex::new(None))
    }

    fn current_hook_state() -> Option<Arc<HookState>> {
        hook_state()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn prune_early_cancellations(control: &mut CaptureControl) {
        control
            .early_cancellations
            .retain(|(_, created_at)| created_at.elapsed() <= EARLY_CANCELLATION_TTL);
        while control.early_cancellations.len() > MAX_EARLY_CANCELLATIONS {
            let _ = control.early_cancellations.pop_front();
        }
    }

    pub(super) fn begin_capture(request_id: String) -> Result<CaptureRegistration, String> {
        let mut control = capture_control()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if ACTIVE.swap(true, Ordering::AcqRel) {
            return Err("屏幕取色正在进行中".to_string());
        }

        prune_early_cancellations(&mut control);
        let cancel_requested = Arc::new(AtomicBool::new(false));
        if let Some(position) = control
            .early_cancellations
            .iter()
            .position(|(pending_id, _)| pending_id == &request_id)
        {
            let _ = control.early_cancellations.remove(position);
            cancel_requested.store(true, Ordering::Release);
        }
        control.active = Some(ActiveCapture {
            request_id: request_id.clone(),
            cancel_requested: cancel_requested.clone(),
        });
        Ok(CaptureRegistration {
            request_id,
            cancel_requested,
        })
    }

    pub(super) fn cancel_screen_color_pick(request_id: String) {
        let mut control = capture_control()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prune_early_cancellations(&mut control);
        if let Some(active) = control
            .active
            .as_ref()
            .filter(|active| active.request_id == request_id)
        {
            active.cancel_requested.store(true, Ordering::Release);
            return;
        }
        if !control
            .early_cancellations
            .iter()
            .any(|(pending_id, _)| pending_id == &request_id)
        {
            control
                .early_cancellations
                .push_back((request_id, Instant::now()));
            prune_early_cancellations(&mut control);
        }
    }

    impl Drop for CaptureRegistration {
        fn drop(&mut self) {
            let mut control = capture_control()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let is_current = control.active.as_ref().is_some_and(|active| {
                active.request_id == self.request_id
                    && Arc::ptr_eq(&active.cancel_requested, &self.cancel_requested)
            });
            if is_current {
                control.active = None;
                ACTIVE.store(false, Ordering::Release);
            }
        }
    }

    unsafe extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            if let Some(state) = current_hook_state() {
                match wparam as u32 {
                    WM_LBUTTONDOWN => {
                        if lparam != 0
                            && should_consume_input(
                                state.cancel_requested.load(Ordering::Acquire),
                                true,
                                false,
                            )
                        {
                            let mouse = &*(lparam as *const MSLLHOOKSTRUCT);
                            state.consume_left.store(true, Ordering::Release);
                            let _ = state.events.send(HookEvent::LeftDown(mouse.pt));
                            return 1;
                        }
                    }
                    WM_LBUTTONUP => {
                        let was_consumed = state.consume_left.swap(false, Ordering::AcqRel);
                        if should_consume_input(
                            state.cancel_requested.load(Ordering::Acquire),
                            false,
                            was_consumed,
                        ) {
                            let _ = state.events.send(HookEvent::LeftUp);
                            return 1;
                        }
                    }
                    _ => {}
                }
            }
        }

        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            if let Some(state) = current_hook_state() {
                let message = wparam as u32;
                if matches!(message, WM_KEYDOWN | WM_SYSKEYDOWN | WM_KEYUP | WM_SYSKEYUP)
                    && lparam != 0
                {
                    let keyboard = &*(lparam as *const KBDLLHOOKSTRUCT);
                    if keyboard.vkCode == VK_ESCAPE as u32 {
                        if keyboard.flags & LLKHF_UP != 0 {
                            let was_consumed = state.consume_escape.swap(false, Ordering::AcqRel);
                            if should_consume_input(
                                state.cancel_requested.load(Ordering::Acquire),
                                false,
                                was_consumed,
                            ) {
                                let _ = state.events.send(HookEvent::EscapeUp);
                                return 1;
                            }
                        } else if should_consume_input(
                            state.cancel_requested.load(Ordering::Acquire),
                            true,
                            false,
                        ) {
                            state.consume_escape.store(true, Ordering::Release);
                            let _ = state.events.send(HookEvent::EscapeDown);
                            return 1;
                        }
                    }
                }
            }
        }

        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    struct HookHandles {
        mouse: HHOOK,
        keyboard: HHOOK,
    }

    impl Drop for HookHandles {
        fn drop(&mut self) {
            unsafe {
                if !self.mouse.is_null() {
                    let _ = UnhookWindowsHookEx(self.mouse);
                }
                if !self.keyboard.is_null() {
                    let _ = UnhookWindowsHookEx(self.keyboard);
                }
            }
            *hook_state()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
        }
    }

    fn install_hooks(state: Arc<HookState>) -> Result<HookHandles, String> {
        let mut state_slot = hook_state()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if state_slot.is_some() {
            return Err("屏幕取色正在进行中".to_string());
        }
        *state_slot = Some(state);
        drop(state_slot);

        let module: HINSTANCE = unsafe { GetModuleHandleW(null_mut()) };
        if module.is_null() {
            *hook_state()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
            return Err("无法初始化屏幕取色".to_string());
        }

        let mouse = unsafe { SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), module, 0) };
        if mouse.is_null() {
            *hook_state()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
            return Err("无法初始化屏幕取色".to_string());
        }

        let keyboard = unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), module, 0) };
        if keyboard.is_null() {
            unsafe {
                let _ = UnhookWindowsHookEx(mouse);
            }
            *hook_state()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
            return Err("无法初始化屏幕取色".to_string());
        }

        Ok(HookHandles { mouse, keyboard })
    }

    struct ScreenDc {
        handle: HDC,
    }

    impl ScreenDc {
        fn acquire() -> Result<Self, String> {
            let handle = unsafe { GetDC(null_mut()) };
            if handle.is_null() {
                return Err("无法读取屏幕颜色".to_string());
            }
            Ok(Self { handle })
        }
    }

    impl Drop for ScreenDc {
        fn drop(&mut self) {
            unsafe {
                let _ = ReleaseDC(null_mut(), self.handle);
            }
        }
    }

    fn read_screen_color(point: POINT) -> Result<String, String> {
        let dc = ScreenDc::acquire()?;
        let colorref = unsafe { GetPixel(dc.handle, point.x, point.y) };
        colorref_to_hex(colorref).ok_or_else(|| "无法读取屏幕颜色".to_string())
    }

    fn pump_messages() {
        unsafe {
            let mut message: MSG = std::mem::zeroed();
            while PeekMessageW(&mut message, null_mut(), 0, 0, PM_REMOVE) != 0 {
                let _ = TranslateMessage(&message);
                let _ = DispatchMessageW(&message);
            }
        }
    }

    fn wait_for_consumed_inputs(
        events: &mpsc::Receiver<HookEvent>,
        cancel_requested: &AtomicBool,
        consume_left: &AtomicBool,
        consume_escape: &AtomicBool,
    ) {
        loop {
            pump_messages();
            while let Ok(event) = events.try_recv() {
                if matches!(event, HookEvent::EscapeDown) {
                    cancel_requested.store(true, Ordering::Release);
                }
            }
            if inputs_are_drained(
                consume_left.load(Ordering::Acquire),
                consume_escape.load(Ordering::Acquire),
            ) {
                return;
            }
            thread::sleep(POLL_INTERVAL);
        }
    }

    pub(super) fn capture_screen_color(
        registration: CaptureRegistration,
    ) -> Result<Option<String>, String> {
        capture_screen_color_inner(registration.cancel_requested.clone())
    }

    fn capture_screen_color_inner(
        cancel_requested: Arc<AtomicBool>,
    ) -> Result<Option<String>, String> {
        let (sender, events) = mpsc::channel();
        let state = Arc::new(HookState {
            events: sender,
            consume_left: AtomicBool::new(false),
            consume_escape: AtomicBool::new(false),
            cancel_requested,
        });
        let _hooks = install_hooks(state.clone())?;
        let deadline = Instant::now() + PICKER_TIMEOUT;

        while Instant::now() < deadline {
            if state.cancel_requested.load(Ordering::Acquire) {
                wait_for_consumed_inputs(
                    &events,
                    &state.cancel_requested,
                    &state.consume_left,
                    &state.consume_escape,
                );
                return Ok(None);
            }
            pump_messages();
            match events.try_recv() {
                Ok(HookEvent::LeftDown(point)) => {
                    let color = read_screen_color(point);
                    wait_for_consumed_inputs(
                        &events,
                        &state.cancel_requested,
                        &state.consume_left,
                        &state.consume_escape,
                    );
                    if state.cancel_requested.load(Ordering::Acquire) {
                        return Ok(None);
                    }
                    return color.map(Some);
                }
                Ok(HookEvent::EscapeDown) => {
                    state.cancel_requested.store(true, Ordering::Release);
                    wait_for_consumed_inputs(
                        &events,
                        &state.cancel_requested,
                        &state.consume_left,
                        &state.consume_escape,
                    );
                    return Ok(None);
                }
                Ok(HookEvent::LeftUp | HookEvent::EscapeUp) => {}
                Err(mpsc::TryRecvError::Empty) => thread::sleep(POLL_INTERVAL),
                Err(mpsc::TryRecvError::Disconnected) => {
                    wait_for_consumed_inputs(
                        &events,
                        &state.cancel_requested,
                        &state.consume_left,
                        &state.consume_escape,
                    );
                    return Err("屏幕取色失败，请重试".to_string());
                }
            }
        }

        wait_for_consumed_inputs(
            &events,
            &state.cancel_requested,
            &state.consume_left,
            &state.consume_escape,
        );
        if state.cancel_requested.load(Ordering::Acquire) {
            return Ok(None);
        }
        Err("屏幕取色超时".to_string())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::sync::atomic::Ordering;

        #[test]
        fn cancellation_registration_matches_request_ids() {
            let early_id = "screen-color-test-early".to_string();
            cancel_screen_color_pick(early_id.clone());
            let early = begin_capture(early_id).expect("early cancellation should be retained");
            assert!(early.cancel_requested.load(Ordering::Acquire));
            drop(early);

            let first_id = "screen-color-test-first".to_string();
            let first = begin_capture(first_id.clone()).expect("first capture should start");
            assert!(begin_capture("screen-color-test-duplicate".to_string()).is_err());
            cancel_screen_color_pick(first_id.clone());
            assert!(first.cancel_requested.load(Ordering::Acquire));
            drop(first);

            let next = begin_capture("screen-color-test-next".to_string())
                .expect("next capture should start");
            cancel_screen_color_pick(first_id);
            assert!(!next.cancel_requested.load(Ordering::Acquire));
            drop(next);
        }

        #[test]
        fn cancellation_input_keeps_only_consumed_key_pairs() {
            assert!(should_consume_input(false, true, false));
            assert!(!should_consume_input(true, true, false));
            assert!(should_consume_input(true, false, true));
            assert!(!should_consume_input(true, false, false));
            assert!(inputs_are_drained(false, false));
            assert!(!inputs_are_drained(true, false));
            assert!(!inputs_are_drained(false, true));
        }
    }
}

#[tauri::command]
pub async fn pick_screen_color(
    app: tauri::AppHandle,
    request_id: String,
) -> Result<Option<String>, String> {
    #[cfg(windows)]
    let result = match windows_impl::begin_capture(request_id) {
        Ok(registration) => match tauri::async_runtime::spawn_blocking(move || {
            windows_impl::capture_screen_color(registration)
        })
        .await
        {
            Ok(result) => result,
            Err(_) => Err("屏幕取色失败，请重试".to_string()),
        },
        Err(error) => Err(error),
    };

    #[cfg(not(windows))]
    let result: Result<Option<String>, String> = {
        let _ = request_id;
        Err("屏幕取色仅支持 Windows".to_string())
    };

    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
    result
}

#[tauri::command]
pub fn cancel_screen_color_pick(request_id: String) {
    #[cfg(windows)]
    windows_impl::cancel_screen_color_pick(request_id);
    #[cfg(not(windows))]
    let _ = request_id;
}

#[cfg(test)]
mod tests {
    use super::colorref_to_hex;

    #[test]
    fn converts_colorref_bgr_bytes_to_rgb_hex() {
        assert_eq!(colorref_to_hex(0x0056_3412), Some("#123456".to_string()));
        assert_eq!(colorref_to_hex(0), Some("#000000".to_string()));
        assert_eq!(colorref_to_hex(0x00ff_ffff), Some("#ffffff".to_string()));
    }

    #[test]
    fn rejects_the_getpixel_invalid_sentinel() {
        assert_eq!(colorref_to_hex(u32::MAX), None);
    }
}
