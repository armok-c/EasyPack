---
spike: 001
name: minimal-tray-api
type: standard
validates: "Given Tauri 2 启用 tray-icon feature，When 从 JS 用最简代码创建 TrayIcon + 菜单 + action handler，Then 托盘图标出现、右键菜单显示、点击菜单项和托盘图标触发回调"
verdict: VALIDATED
related: []
tags: [tauri, tray, windows, runtime]
---

# Spike 001: Minimal Tray API Validation

## What This Validates

**Given:** Tauri 2.10.x 应用启用了 `tray-icon` feature，Windows 11 环境
**When:** 用最简单的 JS 代码调用 `TrayIcon.new()` + `Menu.new()` + `MenuItem.new()`
**Then:** 所有 tray API 功能正常工作

## Research

### API 调查要点

| Approach | Notes |
|----------|-------|
| JS TrayIcon.new() | 验证目标 — 完全从前端 JS 创建和管理托盘 |
| Rust tauri::tray | 替代方案，未测试 |
| tauri.conf.json 静态声明 | 已从配置中移除 |

### 关键发现

1. `defaultWindowIcon()` 返回有效 Image 对象 (rid=609211804)
2. `showMenuOnLeftClick: false` 正确使左键点击走 action 回调
3. **`PredefinedMenuItem.new()` 参数格式**：正确格式是 `{ item: "Separator" }`，不是 `{ item: { item: "Separator" } }`
4. `core:default` 权限已包含所有 tray 和 menu 权限

## How to Run

```bash
pnpm tauri dev
```

页面显示 "Spike 001" 测试面板，点击"创建托盘"按钮。

## What to Expect

所有 7 项验证通过（见下方 Results）。

## Investigation Trail

### Iteration 1: 初次构建

创建了 `src/SpikeTrayTest.tsx`，临时替换 `main.tsx` 加载。

### Iteration 2: 发现根因

首次运行时立即报错：
```
invalid args `options` for command `new`: unknown variant `item`, expected one of `Separator`, `Copy`, `Cut`, ...
```

**根因：`PredefinedMenuItem.new({ item: { item: "Separator" } })` 参数嵌套错误。**

Rust 侧反序列化时把内层对象 `{ item: "Separator" }` 当作变体名去匹配，自然找不到 `"item"` 这个变体。

修复为 `{ item: "Separator" }` 后一切正常。

### Iteration 3: 修复后验证

用户运行修复后的 spike：
- 5 步创建流程全部成功
- 右键菜单正常弹出
- 菜单项点击回调触发
- 动态菜单更新成功
- 托盘销毁成功
- Move/Enter/Leave/Click 事件均正常触发

## Results

**Verdict: VALIDATED**

所有验证项通过：

| # | 验证项 | 结果 |
|---|--------|------|
| 1 | 托盘图标出现 | PASS |
| 2 | defaultWindowIcon() 返回有效图标 | PASS (Image rid=609211804) |
| 3 | 右键菜单弹出 | PASS |
| 4 | 菜单项 action 回调触发 | PASS |
| 5 | setMenu() 动态更新 | PASS |
| 6 | close() 销毁托盘 | PASS |
| 7 | action 回调（Enter/Move/Leave/Click） | PASS |

**根因确认：** 原始 `useTray.ts` 中 `PredefinedMenuItem.new({ item: { item: "Separator" } })` 参数格式错误，导致 `buildMenu()` 在创建 Separator 时抛异常。异常被 catch 捕获后只输出 console.error，整个托盘创建流程静默失败。这解释了为什么 9 轮代码审查（都集中在 JS 逻辑层面）无法发现问题 — 真正的 bug 是 Tauri API 调用参数格式错误。
