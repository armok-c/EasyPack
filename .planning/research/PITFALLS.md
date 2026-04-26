# Domain Pitfalls: EasyPack v1.2

**Domain:** Tauri 2.x + React 19 Windows 桌面应用 -- 在 v1.1 基础上增加快捷键、托盘、悬浮窗、边缘抽屉
**Researched:** 2026-04-26
**Overall confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or user-facing breakage.

---

### Pitfall 1: 全局快捷键与系统快捷键冲突导致静默失败

**What goes wrong:**
使用 `tauri-plugin-global-shortcut` 注册的快捷键可能与 Windows 系统快捷键（Win+D, Alt+Tab, Ctrl+Esc）、其他应用的全局快捷键（VS Code 的 Ctrl+K、PowerToys 的 Alt+Space）冲突。`register()` 调用会失败，但如果没有正确处理错误，用户以为快捷键已设置成功，实际上并未注册。

更危险的情况：某些快捷键组合在 Windows 上注册成功但会导致系统行为异常（例如覆盖了输入法快捷键）。

**Why it happens:**
Windows 的全局快捷键注册使用 `RegisterHotKey` Win32 API，该 API 有严格限制 -- 每个快捷键组合在整个系统中只能被一个进程注册。如果另一个应用先注册了相同的组合，后续注册会失败。

**Consequences:**
- 用户设置的快捷键不生效，以为功能损坏
- 静默失败导致快捷键配置状态与实际注册状态不一致
- 极端情况下覆盖系统快捷键导致 OS 行为异常

**Prevention:**
1. 始终检查 `register()` 的返回值或异常
2. 在快捷键分配 UI 中显示明确的成功/失败反馈
3. 使用 `isRegistered()` 在注册前检查冲突
4. 强制要求双修饰键策略：用户自定义快捷键必须包含至少两个修饰键（`Ctrl+Alt+`、`Ctrl+Shift+`、`Alt+Shift+`），禁止单修饰键组合
5. 提供推荐的快捷键方案列表（如 `Ctrl+Alt+1` 到 `Ctrl+Alt+9`），降低冲突概率

```typescript
// Shortcut assignment validation
function validateShortcut(shortcut: string): { valid: boolean; reason?: string } {
  const parts = shortcut.split('+');
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1];

  // Must have at least 2 modifiers
  if (modifiers.length < 2) {
    return { valid: false, reason: '快捷键必须包含至少两个修饰键（如 Ctrl+Alt+X）' };
  }

  // Block known system shortcuts
  const blocked = ['Control+Escape', 'Alt+Tab', 'Alt+F4'];
  if (blocked.includes(shortcut)) {
    return { valid: false, reason: '该组合为系统保留快捷键' };
  }

  return { valid: true };
}
```

**Detection:**
- 注册后立即调用 `isRegistered()` 验证
- 在 CommandCard 上显示快捷键状态（已注册/冲突）
- 启动时检查所有已存储的快捷键是否仍可注册

**Phase to address:** Phase 1（全局快捷键 -- 在设计阶段就建立冲突检测机制）

---

### Pitfall 2: 关闭窗口与托盘隐藏和边缘抽屉状态冲突

**What goes wrong:**
v1.2 引入了两种"隐藏窗口"的机制：(1) 关闭按钮隐藏到托盘（`appWindow.hide()`），(2) 边缘抽屉移动到屏幕外（`setPosition`）。如果两者不协调，可能出现：

1. 窗口在边缘抽屉隐藏状态下被用户通过托盘"显示"，但 `show()` 只是恢复可见性，不会将窗口从屏幕外位置移回来 -- 窗口"显示"了但用户看不到
2. 窗口在托盘隐藏状态下触发了边缘抽屉的 `onMoved` 事件（理论上不应该，但需确认）
3. 用户在边缘抽屉隐藏状态下点击托盘"退出"，但窗口仍在屏幕外位置 -- 下次启动时窗口在屏幕外

**Why it happens:**
两种隐藏机制操作不同的窗口属性：托盘使用 `hide()`/`show()`（窗口可见性），边缘抽屉使用 `setPosition()`（窗口位置）。两者不感知对方的状态。

**Consequences:**
- 窗口"消失"无法找回（托盘 show 了但窗口仍在屏幕外）
- 启动时窗口位置错误
- 用户以为应用崩溃了

**Prevention:**
建立统一的窗口可见性状态机：

```typescript
type WindowVisibilityState =
  | { mode: 'visible' }                              // 正常显示
  | { mode: 'tray-hidden' }                          // 托盘隐藏
  | { mode: 'drawer-hidden', edge: EdgeDirection, savedPosition: Position };  // 边缘抽屉隐藏

// 托盘 "显示" 操作必须感知边缘抽屉状态
async function showFromTray(state: WindowVisibilityState) {
  if (state.mode === 'drawer-hidden') {
    // 先恢复位置，再显示
    await appWindow.setPosition(state.savedPosition);
    await appWindow.show();
  } else if (state.mode === 'tray-hidden') {
    await appWindow.show();
  }
  await appWindow.setFocus();
}
```

**Detection:**
- 托盘"显示"后检查窗口位置是否在屏幕范围内
- 启动时读取持久化的窗口状态，如果位置在屏幕外则校正
- 自动化测试：边缘抽屉隐藏 -> 托盘显示 -> 验证窗口可见且位置正确

**Phase to address:** Phase 2（托盘）和 Phase 4（边缘抽屉）-- 必须在 Phase 2 就设计好状态机框架

---

### Pitfall 3: 悬浮窗与主窗口的 React 状态不同步

**What goes wrong:**
悬浮窗是独立的 WebView 实例，拥有自己的 React 树和 JS 上下文。主窗口的状态变更（切换项目、编辑指令、删除指令）不会自动反映到悬浮窗。如果事件同步有延迟或丢失，悬浮窗可能显示过时的数据：

1. 用户在主窗口删除了一个指令，悬浮窗仍显示该指令，点击后执行了不应存在的命令
2. 用户切换了项目，悬浮窗仍显示旧项目的指令
3. 悬浮窗创建时没有获取到当前状态，显示空白

**Why it happens:**
Tauri 的 `emit`/`listen` 事件系统是异步的。如果悬浮窗的 `listen` 在主窗口 `emit` 之后才注册，事件就丢失了。或者在事件传递过程中 React 渲染批处理导致状态更新延迟。

**Consequences:**
- 悬浮窗执行错误的指令（对错误的项目或已删除的指令）
- 用户困惑：主窗口和悬浮窗显示不一致
- 信任度下降

**Prevention:**
1. **初始状态同步** -- 悬浮窗创建后，主窗口立即 emit 当前完整状态，不依赖增量更新

```typescript
// 悬浮窗创建后，发送完整初始状态
const floating = new WebviewWindow('floating', { ... });
await floating.once('tauri://created', async () => {
  await emit('easypack:full-state', {
    project: currentProject,
    commands: activeCommands,
  });
});
```

2. **增量更新 + 定期全量同步** -- 除了每次变更都 emit 事件外，每 30 秒做一次全量状态同步

3. **悬浮窗执行前校验** -- 点击执行时，检查当前项目是否仍存在、指令是否仍在列表中

4. **单一数据源** -- 主窗口是唯一的 state source of truth。悬浮窗只有缓存数据，不做独立状态修改

**Detection:**
- 悬浮窗显示数据时加时间戳，如果超过 5 秒未更新则显示"数据可能过期"提示
- 在指令执行前调用 `invoke` 确认指令仍然存在

**Phase to address:** Phase 3（悬浮窗 -- 事件通信设计必须在一开始就考虑同步可靠性）

---

### Pitfall 4: 边缘抽屉在多显示器或高 DPI 环境下位置计算错误

**What goes wrong:**
边缘抽屉依赖屏幕边界位置来计算窗口应该移动到哪里。在以下场景中可能出错：

1. 多显示器 -- 窗口在副显示器上时，屏幕边界计算基于主显示器，导致窗口移到了错误位置
2. 高 DPI 缩放 -- Tauri 的 `LogicalPosition` 和 `PhysicalPosition` 转换错误，导致隐藏/显示时位置偏移
3. 任务栏占据屏幕空间 -- 边缘位置没有排除任务栏区域，窗口被任务栏遮挡
4. Windows Snap -- 用户使用 Win+方向键时与边缘抽屉逻辑冲突

**Why it happens:**
Tauri 的窗口位置 API 在多显示器环境下的行为文档不够详细。`currentMonitor()` 返回的信息可能不包含任务栏偏移。DPI 缩放的 `LogicalPosition`/`PhysicalPosition` 转换需要正确使用 `ScaleFactor`。

**Consequences:**
- 窗口"消失"到屏幕外的错误位置
- 多显示器用户无法使用边缘抽屉
- 高 DPI 下抽屉显示/隐藏动画不平滑

**Prevention:**
1. 使用 `availableMonitors()` 获取所有显示器信息，根据窗口当前位置确定所在显示器
2. 使用 `currentMonitor()` 获取当前显示器的精确边界
3. 考虑任务栏偏移 -- Windows 任务栏可能占据底部（默认）、顶部、左侧或右侧
4. 统一使用 `LogicalPosition` 进行位置计算，不要混用 Physical 和 Logical

```typescript
async function getScreenEdge(windowPos: Position, windowSize: Size): Promise<EdgeDirection | null> {
  // 获取窗口所在的显示器（不是主显示器）
  const monitor = await getCurrentWindow().currentMonitor();
  if (!monitor) return null;

  const { size, position: monitorPos, scaleFactor } = monitor;

  // 使用 Logical 坐标进行所有计算
  const threshold = 20;
  const absX = windowPos.x - monitorPos.x;
  const absY = windowPos.y - monitorPos.y;

  if (absX <= threshold) return 'left';
  if (absX + windowSize.width >= size.width - threshold) return 'right';
  if (absY <= threshold) return 'top';
  // 不推荐 bottom -- 可能与 Windows 任务栏冲突
  return null;
}
```

5. 测试矩阵必须包含：单显示器、双显示器（左右/上下）、150%/200% DPI 缩放

**Detection:**
- 窗口隐藏后检查位置是否在目标显示器范围内
- 不同 DPI 设置下手动测试
- 双显示器环境下拖拽到副显示器边缘测试

**Phase to address:** Phase 4（边缘抽屉 -- 从设计阶段就考虑多显示器支持）

---

### Pitfall 5: 全局快捷键在项目切换后执行错误的指令

**What goes wrong:**
快捷键绑定的指令在项目切换后可能指向了错误的指令。场景：

1. 用户为全局指令 A 绑定了 `Ctrl+Alt+B`
2. 项目 X 的项目级指令中，指令 C 也绑定了 `Ctrl+Alt+B`
3. 切换到项目 X 时，`Ctrl+Alt+B` 应该执行 C 而非 A，但如果快捷键注册没有更新，会继续执行 A

**Why it happens:**
快捷键与 CommandItem 的绑定是静态存储的，但实际执行的指令取决于当前选中的项目和全局/项目指令的覆盖关系。如果快捷键注册逻辑只读取全局指令列表，就忽略了项目级覆盖。

**Consequences:**
- 执行了非预期的指令
- 用户困惑 -- 明明设置了项目级快捷键却执行了全局指令

**Prevention:**
1. 项目切换时，必须重新注册所有快捷键（先 unregister 全部，再根据当前指令集重新 register）
2. 项目级指令与全局指令的快捷键采用相同的覆盖规则：项目级覆盖全局
3. 如果全局指令 A 和项目级指令 C 都绑定了 `Ctrl+Alt+B`，项目激活时只注册 C 的绑定

```typescript
// 获取当前生效的指令列表（考虑项目级覆盖）
function getActiveCommands(globalCmds: CommandItem[], projectCmds: CommandItem[]): CommandItem[] {
  // 项目级指令覆盖同 ID 的全局指令
  const projectIds = new Set(projectCmds.map(c => c.id));
  return [...globalCmds.filter(c => !projectIds.has(c.id)), ...projectCmds];
}

// 注册当前生效指令的快捷键
function registerActiveShortcuts(activeCmds: CommandItem[]) {
  // 先全部注销
  // 再只注册 activeCmds 中的快捷键
}
```

**Detection:**
- 项目切换后，验证 `isRegistered()` 返回的是当前项目的快捷键绑定
- 手动测试：全局和项目级同一快捷键绑定不同指令，切换项目后按快捷键验证执行结果

**Phase to address:** Phase 1（全局快捷键 -- 设计阶段就考虑项目级覆盖）

---

## Moderate Pitfalls

### Pitfall 6: 托盘图标在 Windows 系统托盘溢出区域被隐藏

**What goes wrong:**
Windows 系统托盘有"溢出区域"（notification area overflow）。新应用的托盘图标默认可能被放到溢出区域，用户看不到图标。当窗口隐藏到托盘后，用户无法恢复窗口。

**Prevention:**
1. 在首次运行时提示用户将 EasyPack 图标固定到任务栏托盘
2. 在 README 或首次启动引导中说明如何固定托盘图标
3. 提供 `TrayIcon.setIcon()` 在收到新消息/执行指令后短暂更改图标（闪烁效果），吸引用户注意
4. 文档中说明：右键任务栏 -> 任务栏设置 -> 通知区域 -> 选择哪些图标显示在任务栏上

**Detection:**
- 用户反馈"关了窗口找不到了"
- 托盘图标在溢出区域而非直接可见

---

### Pitfall 7: 悬浮窗的 Vite 多页构建配置导致主窗口打包失败

**What goes wrong:**
为了支持悬浮窗的独立 HTML 入口（`floating.html`），需要配置 Vite 的多页构建（`rollupOptions.input`）。如果配置不正确，可能导致：

1. 主窗口的 `index.html` 打包路径变化，Tauri 找到的前端文件不对
2. CSS 和 JS 资源路径在两个入口之间冲突
3. 开发模式下 `floating.html` 的 HMR 不工作

**Prevention:**
1. 仔细配置 Vite 多页构建，确保 `index.html` 的输出路径不变
2. 悬浮窗的 HTML 入口使用独立的 `div id`（`floating-root` 而非 `root`）
3. 开发和打包模式下分别测试两个入口
4. 悬浮窗共享主窗口的 `index.css` 和 Tailwind 配置

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        floating: resolve(__dirname, 'floating.html'),
      },
    },
  },
});
```

5. 确认 Tauri 的 `frontendDist` 配置仍然指向正确的输出目录

**Detection:**
- `npm run build` 后检查 `dist/` 目录是否包含 `index.html` 和 `floating.html`
- 开发模式下 `http://localhost:1420/floating.html` 是否可访问

---

### Pitfall 8: 快捷键字符串格式在不同平台上的差异（虽然仅 Windows）

**What goes wrong:**
`tauri-plugin-global-shortcut` 使用特定的快捷键字符串格式（如 `"CommandOrControl+Alt+G"`）。在 Windows 上，`CommandOrControl` 映射到 `Ctrl`。但如果在代码中硬编码了 `"Ctrl+Alt+G"` 而非 `"CommandOrControl+Alt+G"`，虽然仅支持 Windows 平台没有实际问题，但违反了 Tauri 的跨平台约定，可能在 Tauri 版本升级后产生兼容问题。

**Prevention:**
1. 使用 `"CommandOrControl"` 而非 `"Ctrl"` -- 这是 Tauri 的推荐格式
2. 建立快捷键字符串的常量映射，避免在多处硬编码

```typescript
const MODIFIER = 'CommandOrControl';
const SHORTCUTS = {
  COMMAND_1: `${MODIFIER}+Alt+1`,
  COMMAND_2: `${MODIFIER}+Alt+2`,
  TOGGLE_FLOATING: `${MODIFIER}+Shift+M`,
} as const;
```

---

### Pitfall 9: 边缘抽屉的 2px 窗口条在某些 Windows 版本上不可见或无法接收鼠标事件

**What goes wrong:**
边缘抽屉的"thin sliver"方案依赖窗口部分可见（2-4px）来接收 `mouseEnter` 事件。但某些 Windows 版本或显示设置下：

1. Windows 的 DWM（Desktop Window Manager）可能将过于窄的窗口视为"最小化"而隐藏
2. 2px 在 200% DPI 缩放下实际只有 1 物理像素，难以触发
3. Windows 11 的 Snap Layout 可能干扰接近屏幕边缘的窗口

**Prevention:**
1. 使用 4px 而非 2px 的条宽 -- 在高 DPI 下仍然可触发
2. 在条宽区域使用 CSS `cursor: pointer` 和明显的视觉提示
3. 测试 Windows 10 和 Windows 11 的不同行为
4. 提供"禁用边缘抽屉"的选项作为 fallback

**Detection:**
- 在 150% 和 200% DPI 下测试隐藏后的自动显示
- 在 Windows 10 和 11 上分别测试
- 窗口隐藏后鼠标移到边缘无法触发显示

---

## Minor Pitfalls

### Pitfall 10: CommandDialog 中的快捷键录制与 Radix Dialog 的键盘事件冲突

**What goes wrong:**
快捷键录制需要捕获所有 `keydown` 事件（包括 Escape、Tab 等）。但 Radix Dialog（shadcn/ui 的 Dialog 底层）也会监听 Escape（关闭弹窗）和 Tab（焦点陷阱）。录制过程中按 Escape 可能同时关闭了弹窗。

**Prevention:**
- 在快捷键录制模式下，使用 `e.preventDefault()` 和 `e.stopPropagation()` 阻止事件冒泡到 Radix Dialog
- 录制模式下用单独的 overlay 覆盖整个弹窗内容，明确指示"正在录制快捷键"
- 使用 `e.nativeEvent.stopImmediatePropagation()` 阻止所有其他监听器

---

### Pitfall 11: 悬浮窗关闭后重新创建导致 Tauri 窗口标签冲突

**What goes wrong:**
`WebviewWindow` 使用 `label` 作为唯一标识。如果悬浮窗被销毁后重新创建使用相同 label `"floating"`，Tauri 可能抛出 "window already exists" 错误。

**Prevention:**
- 悬浮窗关闭时（用户手动关闭），不销毁窗口，而是 `hide()`
- 只有在应用退出时才真正销毁
- 或者在创建前检查 `getWindow(label)` 是否已存在

```typescript
async function getOrCreateFloating(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel('floating');
  if (existing) return existing;
  return new WebviewWindow('floating', { ... });
}
```

---

### Pitfall 12: 托盘菜单的 "退出" 操作被 window.onCloseRequested 拦截

**What goes wrong:**
如果退出的实现是调用 `appWindow.close()`，而 `onCloseRequested` 事件会 `preventDefault()` 并 `hide()`，那么托盘的"退出"实际上只是隐藏了窗口，并没有退出应用。

**Prevention:**
- 托盘"退出"使用 `app.exit(0)`（`@tauri-apps/api/process` 的 `exit`），而不是 `appWindow.close()`
- `app.exit(0)` 绕过 `onCloseRequested` 事件，直接退出进程

```typescript
import { exit } from '@tauri-apps/api/process';

const quitItem = await MenuItem.new({
  text: '退出',
  action: async () => {
    await exit(0);  // 正确：直接退出进程
    // 不要用: await getCurrentWindow().close();  // 会被拦截
  }
});
```

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| 全局快捷键注册 | 快捷键冲突导致静默失败 | 双修饰键策略 + `isRegistered()` 检查 | CRITICAL |
| 全局快捷键项目切换 | 项目级覆盖未反映到快捷键注册 | 项目切换时重新注册所有快捷键 | CRITICAL |
| 托盘隐藏 | 关闭到托盘与边缘抽屉状态冲突 | 统一窗口可见性状态机 | CRITICAL |
| 托盘退出 | 退出被 onCloseRequested 拦截 | 使用 `app.exit(0)` 而非 `window.close()` | CRITICAL |
| 托盘图标可见性 | 图标在溢出区域 | 首次运行引导用户固定 | MODERATE |
| 悬浮窗状态同步 | 主窗口状态变更未传递 | 事件同步 + 初始全量状态 + 定期校验 | CRITICAL |
| 悬浮窗 Vite 构建 | 多页构建配置错误 | 打包后检查 dist 输出 | MODERATE |
| 悬浮窗窗口标签 | 重创建时 label 冲突 | `getByLabel` 检查 + hide 而非 close | MODERATE |
| 边缘抽屉多显示器 | 位置计算基于错误显示器 | 使用 `currentMonitor()` 获取实际显示器 | CRITICAL |
| 边缘抽屉 DPI | 高 DPI 下 2px 条不可见 | 使用 4px 条宽 + 测试多种 DPI | MODERATE |
| 边缘抽屉任务栏 | 窗口被任务栏遮挡 | 检测任务栏位置并排除 | MODERATE |
| 快捷键录制 | Radix Dialog 键盘事件冲突 | `stopImmediatePropagation` 阻止冒泡 | MINOR |

---

## v1.0/v1.1 遗留 Pitfalls（仍适用）

以下 pitfall 来自 v1.0/v1.1 研究文档，在 v1.2 开发中仍然适用：

### Existing 1: Capabilities 权限配置遗漏
每次添加新 Tauri 插件或窗口 API 都需要同步更新 `src-tauri/capabilities/default.json`。v1.2 新增的权限数量最多（global-shortcut 3 个 + multi-window 8 个 + drawer 相关 6 个），最容易遗漏。

### Existing 2: Rust async 命令使用 owned 类型
所有新增的 Tauri 命令（drawer 相关）必须使用 `String` 而非 `&str` 作为参数类型。

### Existing 3: generate_handler! 宏遗漏注册
新增的 Rust 命令必须注册到 `lib.rs` 的 `generate_handler!` 宏中。

### Existing 4: raw_arg() 用于 Windows 命令执行
v1.1 确立的模式继续适用 -- 所有 `std::process::Command` 的参数传递使用 `raw_arg()` 或 `.current_dir()`。

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 快捷键冲突 | LOW | 更换快捷键组合，调用 `unregister` + `register` |
| 托盘/抽屉状态冲突 | MEDIUM | 在托盘 show 操作中加入抽屉状态检查，恢复窗口位置 |
| 悬浮窗状态不同步 | LOW | emit 全量状态，悬浮窗强制刷新 |
| 多显示器位置错误 | MEDIUM | 启动时检查窗口位置是否在任何可见显示器范围内，否则重置到主显示器 |
| 退出被拦截 | LOW | 改用 `app.exit(0)` |
| 窗口标签冲突 | LOW | 创建前 `getByLabel` 检查 |
| Vite 多页构建失败 | MEDIUM | 检查 rollupOptions.input 配置，确认 dist 输出结构 |

---

## Sources

### v1.2 新增 Sources

- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- 权限、JS API、平台支持 -- HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- tray-icon feature、Menu API、事件处理 -- HIGH confidence
- [Tauri v2 Window Configuration](https://v2.tauri.app/reference/config/) -- WindowConfig、TrayIconConfig -- HIGH confidence
- [Tauri v2 WebviewWindow API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/) -- 多窗口创建 -- HIGH confidence
- [Tauri v2 Event System](https://v2.tauri.app/develop/calling-frontend/) -- emit/listen 通信 -- HIGH confidence
- [Windows RegisterHotKey API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey) -- 全局快捷键的底层机制 -- HIGH confidence
- [Win32 WH_MOUSE_LL Hook](https://learn.microsoft.com/en-us/windows/win32/winmsg/about-hooks) -- 鼠标钩子 API -- HIGH confidence
- [windows crate](https://crates.io/crates/windows) -- Rust Win32 API 绑定 -- HIGH confidence
- [Vite Multi-Page App](https://vite.dev/guide/build#multi-page-app) -- 多页构建配置 -- HIGH confidence
- [Tauri v2 process.exit API](https://v2.tauri.app/reference/javascript/api/namespaceprocess/) -- 进程退出 API -- HIGH confidence

### v1.0/v1.1 继承 Sources

- [rust-lang/rust#29494](https://github.com/rust-lang/rust/issues/29494) -- Windows 参数转义问题 -- HIGH confidence
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- 无边框窗口 -- HIGH confidence
- [walkdir crate](https://crates.io/crates/walkdir) -- 目录遍历 -- HIGH confidence

---

*Pitfalls research for: EasyPack v1.2 -- 快捷键、托盘、悬浮窗、边缘抽屉*
*Researched: 2026-04-26*
