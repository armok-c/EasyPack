---
phase: 12-系统托盘
verified: 2026-04-28T14:30:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "单击托盘图标可以切换主窗口的显示/隐藏状态"
    reason: "用户在 12-DISCUSSION-LOG.md D-09 讨论中明确选择'始终显示窗口'而非'切换'，实现符合用户决策"
    accepted_by: "user"
    accepted_at: "2026-04-27"
re_verification:
  previous_status: human_needed
  previous_score: 13/13
  gaps_closed:
    - "右键托盘菜单显示项目名、最近执行指令列表、显示/隐藏窗口选项（stale closure 修复 via ref pattern）"
    - "应用启动后关闭按钮/Alt+F4 的行为始终与设置中的 closeToTray 状态一致（settingsLoaded 守卫）"
    - "Switch 组件 unchecked 状态与背景有明显视觉区分（bg-muted-foreground/30+40）"
    - "关闭托盘总开关后托盘图标立即消失（trayRef 先 null 再 close）"
    - "执行指令后最近指令出现在右键托盘菜单中（同 stale closure 根因，ref 修复覆盖）"
  gaps_remaining: []
  regressions: []
---

# Phase 12: 系统托盘 Verification Report

**Phase Goal:** 应用可以常驻系统托盘，关闭窗口不退出程序，托盘菜单提供完整操作入口
**Verified:** 2026-04-28T14:30:00Z
**Status:** human_needed
**Re-verification:** Yes -- after Plan 03 gap closure (4 UAT issues fixed)

## Goal Achievement

### Observable Truths

**Roadmap Success Criteria (5 truths):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 应用运行时系统托盘显示应用图标，关闭窗口后应用不退出 | VERIFIED | Cargo.toml tray-icon feature; tauri.conf.json trayIcon config; useTray.ts TrayIcon.new(); App.tsx onCloseRequested interception + settingsLoaded guard |
| 2 | 单击托盘图标可以切换主窗口的显示/隐藏状态 | VERIFIED (override) | useTray.ts L157-161: action callback always calls onShow + show + setFocus; user chose "always show" over "toggle" in D-09 discussion |
| 3 | 右键托盘图标弹出上下文菜单，包含"显示/隐藏窗口"和"退出"选项 | VERIFIED | useTray.ts L52-121: buildMenu creates toggle-window MenuItem + Separator + project + recentCommands + Separator + quit; showMenuOnLeftClick: false |
| 4 | 托盘菜单可以直接对当前选中项目执行收藏指令 | VERIFIED | useTray.ts L89-103: recentCommands items with onExecuteRef.current(cmd.command); enabled depends on currentProjectRef.current !== null |
| 5 | 用户可以在设置中开关托盘常驻和关闭到托盘行为 | VERIFIED | SettingsDialog.tsx two Switch controls; App.tsx L162-174: persistence to store; L140-159: load from store |

**Plan 01 must-haves (5 truths):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | 系统托盘显示应用图标，Tooltip 固定显示 'EasyPack' | VERIFIED | useTray.ts L153: tooltip: "EasyPack" |
| 7 | 单击托盘图标始终显示窗口并聚焦 | VERIFIED | useTray.ts L157-161: onClick calls onShowRef + getCurrentWindow().show() + setFocus() |
| 8 | 右键托盘图标显示上下文菜单，包含显示/隐藏窗口、最近指令、退出 | VERIFIED | useTray.ts L52-121: complete menu build with ref pattern for stale closure fix |
| 9 | 托盘菜单可直接执行最近执行过的指令 | VERIFIED | useTray.ts L89-103: recentCommands iteration with onExecuteRef.current(cmd.command) |
| 10 | 窗口可见性状态机 VISIBLE/TRAY_HIDDEN 正常工作 | VERIFIED | useVisibilityState.ts: useState("VISIBLE"), 10 tests passing |

**Plan 02 must-haves (7 truths):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | 点击关闭按钮（TitleBar X）隐藏窗口到托盘，不退出程序 | VERIFIED | TitleBar.tsx L44-49: handleClose checks onCloseBehavior; App.tsx L180: onCloseBehavior guarded by settingsLoaded |
| 12 | Alt+F4 也隐藏到托盘 | VERIFIED | App.tsx L129-138: onCloseRequested interception with settingsLoaded guard |
| 13 | 最小化按钮正常最小化到任务栏 | VERIFIED | TitleBar.tsx L36-38: handleMinimize calls appWindow.minimize() |
| 14 | TitleBar 新增齿轮按钮，点击打开设置弹窗 | VERIFIED | TitleBar.tsx L70-76: Settings button calls onSettingsOpen |
| 15 | 设置弹窗包含两个开关：启用系统托盘 + 关闭时隐藏到托盘 | VERIFIED | SettingsDialog.tsx L44-75: two Switch rows with dependency |
| 16 | 关闭总开关立即消失托盘图标，关闭按钮恢复为退出 | VERIFIED | App.tsx L162-169: handleTrayEnabledChange; useTray.ts L125-131: enabled=false closes tray |
| 17 | 执行指令后自动记录到最近执行列表 | VERIFIED | App.tsx L97-106: handleExecuteWithRecent calls addRecentCommand |

**Plan 03 gap-closure must-haves (5 truths) -- RE-VERIFICATION FOCUS:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 18 | 右键托盘菜单显示项目名（禁用项）、最近执行指令列表、显示/隐藏窗口选项 | VERIFIED | useTray.ts L71-72: hasProject/hasCommands from refs; L78-86: project name from currentProjectRef; L89-103: commands from recentCommandsRef |
| 19 | 应用启动后关闭按钮/Alt+F4 的行为始终与设置中的 closeToTray 状态一致，且默认为隐藏到托盘 | VERIFIED | App.tsx L88: settingsLoaded state; L130: shouldHide guard; L180: onCloseBehavior with settingsLoaded fallback to "hide" |
| 20 | Switch 组件 unchecked 状态与背景有明显视觉区分 | VERIFIED | switch.tsx L18: data-[state=unchecked]:bg-muted-foreground/30 dark:bg-muted-foreground/40 |
| 21 | 关闭托盘总开关后托盘图标立即消失 | VERIFIED | useTray.ts L126-131: enabled=false branch: trayRef.current=null then tray.close(); L182-185: cleanup same pattern |
| 22 | 执行指令后最近指令出现在右键托盘菜单中 | VERIFIED | Same root cause as #18 -- ref pattern ensures buildMenu reads latest recentCommands; Effect 1 L167-172: rebuild menu after async creation |

**Score:** 18/18 truths verified (deduped from 5+5+7+5 roadmap/plan truths, accounting for overlap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/useTray.ts` | 托盘图标创建、菜单构建、事件处理、ref pattern | VERIFIED | 217 行; currentProjectRef (5 occurrences), recentCommandsRef (4 occurrences); tray cleanup null-before-close |
| `src/hooks/useRecentCommands.ts` | 最近执行指令列表管理 | VERIFIED | 55 行; functional setState, store persistence, 8 max |
| `src/hooks/useVisibilityState.ts` | 窗口可见性状态机 | VERIFIED | 25 行; VISIBLE/TRAY_HIDDEN |
| `src-tauri/Cargo.toml` | tray-icon feature 启用 | VERIFIED | features = ["protocol-asset", "tray-icon"] |
| `src-tauri/tauri.conf.json` | trayIcon 配置块 | VERIFIED | 1 occurrence of trayIcon |
| `src-tauri/capabilities/default.json` | window show/hide/focus 权限 | VERIFIED | 3 permission entries found |
| `src/components/SettingsDialog.tsx` | 通用设置弹窗组件 | VERIFIED | 82 行; Dialog + 2 Switch with dependency |
| `src/components/ui/switch.tsx` | shadcn Switch with enhanced unchecked | VERIFIED | 33 行; bg-muted-foreground/30+40 |
| `src/components/TitleBar.tsx` | 齿轮按钮 + 关闭行为改造 | VERIFIED | 105 行; onSettingsOpen + onCloseBehavior props |
| `src/App.tsx` | 全部 tray hooks 集成 + settingsLoaded | VERIFIED | 232 行; settingsLoaded guard on L88, L130, L138, L180 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| App.tsx | useTray.ts | useTray() hook call | WIRED | L116-126: all params passed including handleExecuteWithRecent |
| App.tsx | useVisibilityState.ts | useVisibilityState() | WIRED | L91: destructured visibility, hideToTray, showFromTray |
| App.tsx | useRecentCommands.ts | useRecentCommands({ store }) | WIRED | L94: store from useProject; L97-106: addRecentCommand usage |
| App.tsx | TitleBar.tsx | onSettingsOpen + onCloseBehavior props | WIRED | L178-181: settingsLoaded guard on close behavior |
| App.tsx | SettingsDialog.tsx | settingsOpen state + all tray props | WIRED | L218-225: complete prop wiring |
| useTray.ts | @tauri-apps/api/tray | TrayIcon.new() | WIRED | L150-163: tray creation with all config |
| useTray.ts | @tauri-apps/api/menu | Menu.new() + MenuItem.new() | WIRED | L52-121: buildMenu with ref pattern |
| useTray.ts internal | refs | currentProjectRef / recentCommandsRef | WIRED | L47-50: ref declarations + assignment; L71-72, L82, L90, L97: ref reads in buildMenu |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| useTray.ts buildMenu | currentProjectRef.current | App.tsx currentProject via ref update | Yes -- ref updated every render (L48) | FLOWING |
| useTray.ts buildMenu | recentCommandsRef.current | useRecentCommands via App.tsx ref update | Yes -- ref updated every render (L50); addRecentCommand updates store | FLOWING |
| useTray.ts buildMenu | visibilityRef.current | useVisibilityState via ref update | Yes -- ref updated every render (L46) | FLOWING |
| App.tsx | settingsLoaded | loadTraySettings effect | Yes -- setSettingsLoaded(true) after store read (L154) | FLOWING |
| App.tsx | closeToTray | store.get("closeToTray") + useState | Yes -- loaded from store with safe default (L148-153) | FLOWING |
| SettingsDialog.tsx | trayEnabled / closeToTray | App.tsx state props | Yes -- passed from App.tsx state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | No errors | PASS |
| Test suite | `npx vitest run` | 132/132 passed (11 files) | PASS |
| currentProjectRef in useTray.ts | `grep -c "currentProjectRef" src/hooks/useTray.ts` | 5 | PASS |
| recentCommandsRef in useTray.ts | `grep -c "recentCommandsRef" src/hooks/useTray.ts` | 4 | PASS |
| settingsLoaded in App.tsx | `grep "settingsLoaded" src/App.tsx` | 4 matches (declare + set + 2 guards) | PASS |
| Switch unchecked color | `grep "bg-muted-foreground" src/components/ui/switch.tsx` | Present (/30 + /40) | PASS |
| Cargo.toml tray-icon feature | `grep "tray-icon" src-tauri/Cargo.toml` | Found | PASS |
| Plan 03 commits exist | `git log --oneline \| grep "12-03"` | cd59281, fab7696, c6c8ccd | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRAY-01 | 12-01 | App icon appears in system tray while running | SATISFIED | Cargo.toml tray-icon + tauri.conf.json trayIcon + useTray.ts TrayIcon.new() |
| TRAY-02 | 12-02 | Closing main window (Alt+F4 or X) hides to tray instead of quitting | SATISFIED | App.tsx onCloseRequested L129-138 + settingsLoaded guard; TitleBar.tsx handleClose L44-49 |
| TRAY-03 | 12-01 | Single-clicking tray icon toggles/shows window | SATISFIED (override) | useTray.ts L157-161 always shows window; user chose "always show" in D-09 |
| TRAY-04 | 12-01 | Right-clicking tray icon shows a context menu | SATISFIED | useTray.ts showMenuOnLeftClick: false + buildMenu() |
| TRAY-05 | 12-01 | Tray menu includes "Show/Hide Window" toggle | SATISFIED | useTray.ts L53-66: toggle-window MenuItem with dynamic text |
| TRAY-06 | 12-01 | Tray menu includes "Quit" option | SATISFIED | useTray.ts L110-118: quit MenuItem; App.tsx L124: appWindow.destroy() |
| TRAY-07 | 12-01 | Tray menu can trigger command execution | SATISFIED | useTray.ts L89-103: recentCommands menu items with onExecute action |
| TRAY-08 | 12-02 | Tray presence and close-to-tray behavior toggleable in settings | SATISFIED | SettingsDialog.tsx 2 Switch controls; App.tsx L162-174 persistence |

**Note:** REQUIREMENTS.md still shows TRAY-02, TRAY-05, TRAY-06, TRAY-08 as `[ ]` unchecked and "Pending" in traceability table. The code implementation satisfies all 8 requirements. The REQUIREMENTS.md status fields should be updated to reflect actual completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| useTray.ts | 60,63,64,129,159,160,185 | console.error in .catch() | Info | Legitimate error logging for async Tauri API calls |
| useTray.ts | 84 | Empty action callback `() => {}` | Info | Intentional no-op for disabled menu item (current project display) |
| useTray.ts | 174, 205 | console.error in catch blocks | Info | Error logging for tray creation/update failures |
| useRecentCommands.ts | 42 | `.catch(() => {})` | Info | Silent catch for store write failure; defensive, no data loss |
| App.tsx | 122-123 | console.error in .catch() | Info | Error logging for window show/hide operations |

No blocker or warning anti-patterns. No TODO/FIXME/placeholder patterns. No stub implementations.

### Human Verification Required

### 1. Gap-1/GAP-4 Verification: Tray Menu Content

**Test:** Run `pnpm tauri dev`. Select a project. Execute a command. Right-click tray icon.
**Expected:** Context menu shows: toggle window text + separator + "EasyPack (project name)" (disabled) + "Execute: {command name}" items + separator + "Quit". Recent commands appear after execution.
**Why human:** Native context menu rendering, menu item text, and disabled styling are runtime behaviors. The stale closure fix via ref pattern must be verified at runtime to confirm Effect 2 timing is correct.

### 2. Gap-2 Verification: Close-to-Tray Timing Safety

**Test:** Delete any existing store file (or clear trayEnabled/closeToTray keys). Start `pnpm tauri dev`. Immediately click the X close button before settings load from store.
**Expected:** Window hides to tray (does NOT exit). Then test: click tray icon to restore, then close again (should still hide). Then test: open settings, disable close-to-tray, close window -- should now exit.
**Why human:** settingsLoaded guard timing requires real async store loading. The race condition between store load and user clicking close needs runtime verification.

### 3. Gap-3 Verification: Switch Visual Contrast

**Test:** Open settings dialog. Toggle "Enable System Tray" off, then on. Observe the Switch thumb position and background color in both checked and unchecked states.
**Expected:** Unchecked state shows a clearly visible gray background (bg-muted-foreground/30 or /40) that is distinguishable from the surrounding dialog background. Checked state shows primary color.
**Why human:** Visual contrast between unchecked Switch and dialog background needs human eye verification across themes.

### 4. Gap-3 Verification: Tray Icon Cleanup on Toggle Off

**Test:** Open settings. Toggle "Enable System Tray" off.
**Expected:** Tray icon disappears immediately from system tray. Toggle back on -- icon reappears.
**Why human:** System tray icon appearance/disappearance is a native OS integration that cannot be verified programmatically.

### 5. Minimize Still Works (Regression)

**Test:** Click the minimize button (-) on TitleBar.
**Expected:** Window minimizes to taskbar as normal. Does NOT go to tray.
**Why human:** Distinguishing minimize-to-taskbar vs hide-to-tray requires visual observation.

### Gaps Summary

No code-level gaps remain. All 4 UAT issues from the first verification round have been addressed by Plan 03:

1. **Stale closure (GAP-1 + GAP-4):** Fixed by adding `currentProjectRef` and `recentCommandsRef` in useTray.ts. buildMenu() now reads from refs instead of stale closure variables. Effect 1 also includes a post-creation menu rebuild to cover the async window.

2. **Close exits app (GAP-2):** Fixed by adding `settingsLoaded` state guard in App.tsx. Both `onCloseBehavior` and `onCloseRequested` default to "hide" before store loads, preventing the race condition where stale store values caused the app to exit.

3. **Switch contrast + tray cleanup (GAP-3):** Switch unchecked background changed from `bg-input` to `bg-muted-foreground/30`/`bg-muted-foreground/40`. Tray cleanup reordered to `trayRef.current = null` before `tray.close()` to prevent async window period issues.

TypeScript compiles cleanly, all 132 tests pass, and all 3 Plan 03 commits are verified in git history. Status remains **human_needed** because system tray behavior is inherently visual and interactive -- the core refactoring must be confirmed at runtime.

---

_Verified: 2026-04-28T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
