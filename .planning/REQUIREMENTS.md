# Requirements: EasyPack v1.2

**Defined:** 2026-04-26
**Core Value:** 选中项目 → 一键在终端执行指令，无需手动切换目录和输入命令

## v1.2 Requirements

### Keyboard Shortcuts (KB)

- [x] **KB-01**: User can assign a keyboard shortcut (e.g. Ctrl+Alt+G) to any command via command settings
- [x] **KB-02**: With a project selected, pressing a bound shortcut immediately executes the command in the system terminal
- [x] **KB-03**: When switching projects, all shortcuts are automatically re-registered based on the merged command set (global + project-level overrides)
- [x] **KB-04**: When assigning a shortcut, the system detects conflicts with existing bindings and warns the user
- [x] **KB-05**: User can clear a shortcut binding from any command
- [x] **KB-06**: Shortcut bindings persist across app restarts via tauri-plugin-store

### System Tray (TRAY)

- [x] **TRAY-01
**: App icon appears in Windows system tray while the app is running
- [x] **TRAY-02
**: Closing the main window (Alt+F4 or title bar close) hides to tray instead of quitting
- [x] **TRAY-03
**: Single-clicking the tray icon toggles main window visibility
- [x] **TRAY-04
**: Right-clicking the tray icon shows a context menu
- [x] **TRAY-05
**: Tray context menu includes "Show/Hide Window" toggle option
- [x] **TRAY-06
**: Tray context menu includes "Quit" option that fully exits the app
- [x] **TRAY-07
**: Tray context menu can directly trigger execution of favorite commands on the selected project
- [x] **TRAY-08**: Tray presence and close-to-tray behavior can be toggled in settings

### Mini Floating Window (FLOAT)

- [x] **FLOAT-01**: User can open a mini floating window from main window toolbar or tray menu
- [x] **FLOAT-02**: Floating window displays command buttons for the currently selected project
- [x] **FLOAT-03**: Floating window stays always on top of other windows
- [x] **FLOAT-04**: Floating window does not appear in the Windows taskbar
- [x] **FLOAT-05**: Clicking a command in the floating window executes it on the currently selected project in the system terminal
- [x] **FLOAT-06**: Floating window reflects project selection changes from main window in real-time
- [x] **FLOAT-07**: User can close the floating window independently without affecting the main window

### Edge Drawer (DRAWER)

- [x] **DRAWER-01**: User can drag the main window to any screen edge to trigger snap-and-hide
- [x] **DRAWER-02**: All four screen edges (top, bottom, left, right) are supported for snapping
- [x] **DRAWER-03**: When snapped and hidden, mouse contact at the hidden edge triggers the window to slide out
- [x] **DRAWER-04**: Mouse leaving the revealed window causes it to slide back and auto-hide
- [x] **DRAWER-05**: Slide-out and slide-back animations are smooth (no visual tearing or jumps)
- [x] **DRAWER-06**: User can un-dock the window by dragging it away from the edge

## Future Requirements

### Edge Drawer Enhancements

- **DRAWER-07**: Multi-monitor support — drawer works correctly when snapped to edges of non-primary monitors
- **DRAWER-08**: DPI-aware thin sliver — trigger area scales correctly at 150%/200% display scaling

### Floating Window Enhancements

- **FLOAT-08**: User can customize which commands appear in the floating window
- **FLOAT-09**: Floating window remembers its position across sessions

### Keyboard Enhancements

- **KB-07**: Global hotkey to show/hide the main window from anywhere
- **KB-08**: Quick launcher mode — press a global hotkey to open a command palette

## Out of Scope

| Feature | Reason |
|---------|--------|
| macOS / Linux 托盘 | 仅 Windows 平台 |
| 内嵌终端 | 彻底改变产品性质 |
| 多显示器边缘吸附 | 延迟到后续版本，需更多测试资源 |
| 浮动窗口自定义布局 | 当前固定按钮列表足够 |
| 全局命令面板 | 键盘增强的进阶功能，v1.2 聚焦快捷键绑定 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KB-01 | Phase 11 | Complete |
| KB-02 | Phase 11 | Complete |
| KB-03 | Phase 11 | Complete |
| KB-04 | Phase 11 | Complete |
| KB-05 | Phase 11 | Complete |
| KB-06 | Phase 11 | Complete |
| TRAY-01 | Phase 12 | Complete |
| TRAY-02 | Phase 12 | Complete |
| TRAY-03 | Phase 12 | Complete |
| TRAY-04 | Phase 12 | Complete |
| TRAY-05 | Phase 12 | Complete |
| TRAY-06 | Phase 12 | Complete |
| TRAY-07 | Phase 12 | Complete |
| TRAY-08 | Phase 12 | Complete |
| FLOAT-01 | Phase 13 | Complete |
| FLOAT-02 | Phase 13 | Complete |
| FLOAT-03 | Phase 13 | Complete |
| FLOAT-04 | Phase 13 | Complete |
| FLOAT-05 | Phase 13 | Complete |
| FLOAT-06 | Phase 13 | Complete |
| FLOAT-07 | Phase 13 | Complete |
| DRAWER-01 | Phase 14 | Complete |
| DRAWER-02 | Phase 14 | Complete |
| DRAWER-03 | Phase 14 | Complete |
| DRAWER-04 | Phase 14 | Complete |
| DRAWER-05 | Phase 14 | Complete |
| DRAWER-06 | Phase 14 | Complete |

**Coverage:**
- v1.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-26*
*Last updated: 2026-04-27 after Phase 11 completion*
