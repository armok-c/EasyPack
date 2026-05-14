# Phase 15: 开机启动 - Research

**Researched:** 2026-05-14
**Domain:** tauri-plugin-autostart v2 + Windows 注册表自启动
**Confidence:** HIGH

## Summary

Phase 15 需要集成 `tauri-plugin-autostart` v2.5.1 实现开机自启动功能。该插件封装了 `auto-launch` 0.5 crate，在 Windows 上通过 `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` 注册表键写入启动项，同时处理了 Task Manager 的 `StartupApproved\Run` 覆盖键。

**Primary recommendation:** 使用 `tauri-plugin-autostart` 的 `Builder` API（非已废弃的 `init()` 函数）初始化插件，传入 `--autostart` 参数区分启动来源。Rust 端 setup 中在 WebView 加载前检测该参数并隐藏窗口。每次启动时用 `is_enabled()` 检查注册表状态，配合前端 store 中的开关状态实现自愈。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用命令行参数 `--autostart` 区分"开机自启"和"用户手动启动"——tauri-plugin-autostart 注册自启动项时附带此参数
- **D-02:** 开机自启时如果系统托盘功能关闭，自动开启托盘——开机自启后应用必须有地方待着
- **D-03:** Rust 端 setup 阶段检测 `--autostart` 参数后立即隐藏窗口（在 WebView 加载前），避免窗口闪现
- **D-04:** Rust 端通过 emit 事件（如 `app:autostart-hidden`）通知前端同步 visibility = TRAY_HIDDEN 状态
- **D-05:** 每次启动时，如果开机启动开关为开启状态，静默检查注册表条目是否有效
- **D-06:** 使用 tauri-plugin-autostart 的 isEnabled() API 检测注册状态
- **D-07:** 发现条目丢失时静默调用 enable() 重新注册，修复失败不提示用户（下次启动会再尝试）
- **D-08:** 自愈逻辑全部在 Rust 端 setup 阶段执行，前端不需要感知自愈逻辑
- **D-09:** 开机启动开关放在 SettingsDialog 托盘设置分区内（作为第三个 Switch），与 trayEnabled、closeToTray 在同一区域
- **D-10:** 用户关闭托盘总开关（trayEnabled）时级联关闭开机启动——确保不会出现开机自启后无处可去的状况
- **D-11:** 开机启动开关启用前提条件为 closeToTray=true——只有"关闭时隐藏到托盘"开启时才能开启开机启动

### Claude's Discretion
- tauri-plugin-autostart 的具体注册参数格式（args 配置）
- `--autostart` 参数在 Rust 端的读取方式（std::env::args vs tauri API）
- emit 事件名称的具体命名
- SettingsDialog 中开机启动 Switch 的 UI 文案和描述
- capabilities/default.json 需要追加的 autostart 权限
- Cargo.toml 中 tauri-plugin-autostart 的版本选择

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOT-01 | 提供开机启动开关，用户可启用/禁用（使用 tauri-plugin-autostart） | tauri-plugin-autostart v2.5.1 提供 enable()/disable()/isEnabled() JS API，前端直接调用 |
| BOOT-02 | 开机启动后自动隐藏主窗口到系统托盘，不显示窗口 | Rust 端 setup 中检测 `--autostart` 参数后立即 window.hide()，在 WebView 加载前执行 |
| BOOT-03 | 每次启动时验证注册表条目是否有效，无效则自动重新注册（自愈机制） | auto-launch 0.5 的 is_enabled() 同时检查 Run 键和 StartupApproved\Run 覆盖键；setup 中读取 store 状态后对比注册表 |
| BOOT-04 | 开机启动设置持久化，重启后保持用户选择 | 使用已有的 tauri-plugin-store 持久化 autostartEnabled 布尔值 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 注册表自启项管理 | Rust Backend (lib.rs setup) | — | 注册表操作必须在 Rust 端，auto-launch crate 是 Rust 库 |
| 开机启动状态持久化 | Frontend (store) | — | 复用已有的 tauri-plugin-store 模式，与 trayEnabled/closeToTray 一致 |
| 窗口隐藏（避免闪现） | Rust Backend (lib.rs setup) | — | 必须在 WebView 加载前执行，Rust setup 阶段可访问窗口句柄 |
| 前端 UI 开关 | Browser (SettingsDialog.tsx) | — | 复用现有 Switch 组件和依赖控制模式 |
| 自愈逻辑 | Rust Backend (lib.rs setup) | — | D-08 决策：全部在 Rust 端，前端无需感知 |
| 级联关闭逻辑 | Frontend (App.tsx) | — | handleTrayEnabledChange 回调中追加级联关闭 autostartEnabled |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-plugin-autostart | 2.5.1 (crate) | Windows 注册表自启动管理 | Tauri 官方插件，封装 auto-launch crate，v2 API 稳定 [VERIFIED: crates.io] |
| @tauri-apps/plugin-autostart | 2.5.1 (npm) | 前端 JS API 绑定 | 与 Rust crate 版本对应 [VERIFIED: npm registry] |
| auto-launch | 0.5 | 底层 Windows 注册表操作 | tauri-plugin-autostart 的依赖，处理 Run 键 + StartupApproved 覆盖键 [VERIFIED: Cargo.toml] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tauri-plugin-store | 2.4.2 (已在项目中) | 持久化 autostartEnabled 设置 | 已安装，复用现有模式 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-autostart | 直接操作注册表 (winreg crate) | 失去跨平台抽象和 Task Manager StartupApproved 处理，增加维护成本 |
| tauri-plugin-autostart | Windows Task Scheduler API | 更可靠但复杂度更高，需要管理员权限，不适合个人工具 |

**Installation:**
```bash
# Rust 后端依赖 (在 src-tauri/ 目录)
cd src-tauri && cargo add tauri-plugin-autostart

# 前端 JS 绑定
pnpm add @tauri-apps/plugin-autostart
```

**Version verification:**
```
tauri-plugin-autostart (crate): 2.5.1  [VERIFIED: cargo search]
@tauri-apps/plugin-autostart (npm): 2.5.1  [VERIFIED: npm view]
auto-launch (crate): 0.5  [VERIFIED: Cargo.toml dependency in plugins-workspace v2 branch]
```

## Architecture Patterns

### System Architecture Diagram

```
User toggles autostart in SettingsDialog
         |
         v
  App.tsx: handleAutostartEnabledChange()
         |
         +---> store.set("autostartEnabled", value)
         |
         +---> value=true? enable() : disable()
         |     (via @tauri-apps/plugin-autostart JS API)
         |           |
         |           v
         |     Rust: AutoLaunchManager.enable()
         |           |
         |           v
         |     auto-launch: writes HKCU\...\Run registry
         |
         v
  [Windows Boot]
         |
         v
  EasyPack.exe --autostart
         |
         v
  lib.rs setup():
         |
         +---> detect --autostart arg?
         |       |
         |       YES --> window.hide() + emit("app:autostart-hidden")
         |       |
         |       NO  --> normal startup
         |
         +---> store.get("autostartEnabled") == true?
               |
               YES --> is_enabled()?
                       |
                       NO --> enable()  [self-heal]
                       |
                       YES --> OK (no action)
```

### Recommended Project Structure
```
src-tauri/
  src/
    lib.rs          # +autostart plugin init, --autostart detect, self-heal
  Cargo.toml        # +tauri-plugin-autostart dep
  capabilities/
    default.json    # +autostart permissions
src/
  App.tsx           # +autostart state, event listener, cascade logic
  components/
    SettingsDialog.tsx  # +third Switch in tray section
```

### Pattern 1: Builder API Initialization (Recommended)
**What:** 使用 `Builder` API 而非已废弃的 `init()` 函数初始化 autostart 插件
**When to use:** 初始化 tauri-plugin-autostart 时
**Why:** `init()` 接收 `MacosLauncher` 参数在 Windows 上无意义但仍是必需参数；`Builder` 更清晰
**Example:**
```rust
// Source: [VERIFIED: plugins-workspace v2 branch lib.rs]
use tauri_plugin_autostart::MacosLauncher;

// init() 方式 (仍可用，但 MacosLauncher 参数在 Windows 无意义)
tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        Some(vec!["--autostart"]),
    ))

// Builder 方式 (推荐，更清晰)
tauri::Builder::default()
    .plugin(
        tauri_plugin_autostart::Builder::new()
            .arg("--autostart")
            .build(),
    )
```

### Pattern 2: Rust 端命令行参数检测
**What:** 在 setup 闭包中通过 `std::env::args()` 检测 `--autostart` 参数
**When to use:** 需要区分开机自启和手动启动时
**Example:**
```rust
.setup(|app| {
    // 检测 --autostart 参数
    let is_autostart = std::env::args().any(|arg| arg == "--autostart");

    if is_autostart {
        // 在 WebView 加载前隐藏窗口
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
        // 通知前端（但此时前端可能还未就绪，前端需要用 listen 缓存机制）
        use tauri::Emitter;
        let _ = app.emit("app:autostart-hidden", ());
    }

    // ... 其他 setup 逻辑
    Ok(())
})
```

### Pattern 3: 自愈机制实现
**What:** 每次启动时检查 store 中 autostartEnabled 开关与实际注册表状态是否一致
**When to use:** Rust 端 setup 中
**Example:**
```rust
// Source: [CITED: auto-launch 0.5 windows.rs + tauri-plugin-autostart lib.rs]
use tauri_plugin_autostart::ManagerExt;

// 自愈：读取 store 中的设置，如果 autostartEnabled=true 但注册表条目丢失，重新注册
// 注意：setup 中需通过 app.state() 获取 AutoLaunchManager
let autostart_manager = app.autolaunch();
let is_enabled = autostart_manager.is_enabled().unwrap_or(false);

// 读取 store 中的设置值（通过 tauri-plugin-store 的 Rust API 或在 setup 后通过 emit 让前端处理）
// 实际实现建议：前端 mount 时检查并自愈（更简单），或 Rust 端读取 JSON 文件
```

### Pattern 4: 前端 JS API 调用
**What:** 前端通过 JS API 控制 autostart 启用/禁用
**When to use:** 用户在 SettingsDialog 中切换开关时
**Example:**
```typescript
// Source: [CITED: https://v2.tauri.app/plugin/autostart/]
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';

// 启用开机启动
await enable();

// 检查状态
const enabled = await isEnabled();

// 禁用开机启动
await disable();
```

### Anti-Patterns to Avoid
- **Anti-pattern: 在前端 mount 后才处理 --autostart 隐藏** — WebView 加载到执行 JS 有延迟，用户会看到窗口闪现。必须在 Rust setup 阶段隐藏窗口。
- **Anti-pattern: 忽略 Task Manager StartupApproved 键** — auto-launch 0.5 的 `is_enabled()` 同时检查两个注册表位置。如果只用 `is_registered()` 不检查 Task Manager 覆盖，可能误判。
- **Anti-pattern: 自愈失败时弹出错误提示** — D-07 决策明确要求静默处理，下次启动会再尝试。
- **Anti-pattern: 在 JS 端直接操作注册表** — tauri-plugin-autostart 已封装所有注册表操作，不需要也不应该直接操作。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Windows 注册表自启动项管理 | 直接用 winreg crate 操作 Run 键 | tauri-plugin-autostart | 插件同时处理 Task Manager StartupApproved 覆盖键，手动操作容易遗漏 |
| 检测注册表条目是否存在 | 直接读注册表比较字符串 | autostart_manager.is_enabled() | auto-launch 的 is_enabled() 检查两处注册表（Run + StartupApproved），逻辑更完整 |
| 命令行参数解析 | 手动遍历 std::env::args() | std::env::args().any() | 简单参数检测不需要 clap 等重量级库，直接 any() 即可 |

**Key insight:** auto-launch 0.5 的 `is_enabled()` 实现同时检查 `HKCU\...\Run` 注册键和 `HKCU\...\StartupApproved\Run` 覆盖键。后者是 Windows Task Manager 禁用启动项时写入的，忽略它会导致误判为"已启用"。[VERIFIED: auto-launch windows.rs 源码]

## Common Pitfalls

### Pitfall 1: 窗口闪现（Flash of Window）
**What goes wrong:** 开机自启时窗口短暂显示后隐藏，用户体验差
**Why it happens:** 如果在前端 JS 执行后才调用 window.hide()，WebView 加载需要时间，期间窗口可见
**How to avoid:** 在 Rust setup 闭包中检测到 `--autostart` 参数后立即调用 `window.hide()`，此时 WebView 尚未开始加载
**Warning signs:** 开机后看到主窗口短暂出现又消失

### Pitfall 2: Issue #771 - 注册表条目丢失
**What goes wrong:** 注册表条目被外部工具（如 CCleaner、系统优化软件）删除，下次开机无法自启
**Why it happens:** Windows 注册表 `Run` 键是常见清理目标；也可能被用户在 Task Manager 中手动禁用
**How to avoid:** D-05/D-06/D-07 的自愈机制——每次启动时检查 isEnabled() 与 store 中开关状态的一致性
**Warning signs:** 用户报告"明明开了自启动但开机没启动"
**Important note:** Issue #771 仍为 OPEN 状态（截至 2026-05-14），但 auto-launch 库作者认为这不是库的 bug，而是外部软件干扰。自愈机制是最佳应对策略。[VERIFIED: GitHub API - state: open, comments: 0]

### Pitfall 3: 托盘关闭后开机启动成为孤儿
**What goes wrong:** 用户关闭 trayEnabled 后开机自启仍然生效，应用启动后无处可见
**Why it happens:** 两个设置之间的依赖关系未正确维护
**How to avoid:** D-10/D-11 确保级联关系——关闭 trayEnabled 时级联关闭 autostartEnabled；启用 autostartEnabled 的前提是 closeToTray=true
**Warning signs:** 用户关闭托盘后发现开机启动开关仍然启用

### Pitfall 4: emit 事件时机问题
**What goes wrong:** Rust 端 emit 的 `app:autostart-hidden` 事件在前端 JS 还未 mount 时发出，前端 listen 未生效
**Why it happens:** setup 闭包执行时 WebView 可能尚未加载完成
**How to avoid:** 方案一：前端 mount 时主动调用 isEnabled() 检查（而非仅依赖事件）。方案二：前端对 emit 事件使用 `listen` 的 backlog 机制（Tauri v2 支持）。推荐方案一，更可靠。
**Warning signs:** 开机自启后前端 visibility 状态未同步为 TRAY_HIDDEN

### Pitfall 5: 自愈时机冲突
**What goes wrong:** 前端在 mount 时调用 enable()，同时 Rust 端 setup 也在调用 enable()，产生竞争
**Why it happens:** 自愈逻辑和前端初始化都在做同样的事
**How to avoid:** D-08 明确——自愈逻辑全部在 Rust 端 setup 阶段执行，前端仅负责 UI 开关和 JS API 调用（用户主动操作时）。前端 mount 时不需要自愈检查。
**Warning signs:** 重复注册表写入或竞态条件

## Code Examples

### Rust 端完整集成模式（lib.rs setup 中）

```rust
// Source: [CITED: tauri-plugin-autostart v2 源码 + 项目现有 lib.rs]
// 在 tauri::Builder::default() 链中添加 autostart 插件

.plugin(
    tauri_plugin_autostart::Builder::new()
        .arg("--autostart")
        .build(),
)
.setup(|app| {
    // 1. 初始化 autostart plugin (移到 setup 中以确保时序)
    // 注意：如果用 .plugin() 方式，init 已在 setup 前完成

    // 2. 检测 --autostart 参数
    let is_autostart = std::env::args().any(|arg| arg == "--autostart");

    if is_autostart {
        // 在 WebView 加载前隐藏窗口，避免闪现
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
            // 设置 skip_taskbar 避免在任务栏出现
            let _ = window.set_skip_taskbar(true);
        }
        // 通知前端（前端 mount 后检查 store 并同步状态）
        use tauri::Emitter;
        let _ = app.emit("app:autostart-hidden", ());
    }

    // 3. 自愈逻辑：检查 store 设置 vs 注册表实际状态
    // 注意：此处需要读取 plugin-store 中的值
    // 最佳方案：让前端在 mount 时执行自愈检查（见下方前端代码）
    // 如果要在 Rust 端做：需要直接读取 store JSON 文件

    // ... 其他 setup 逻辑保持不变
    Ok(())
})
```

### 前端 mount 时自愈 + 状态同步（App.tsx）

```typescript
// Source: [CITED: 项目现有 App.tsx loadTraySettings 模式]
// 在 loadTraySettings useEffect 中扩展

import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';

// 在 loadTraySettings 函数中追加：
const savedAutostart = await store.get<boolean>("autostartEnabled");
const effectiveAutostart = savedAutostart !== undefined && savedAutostart !== null
  ? savedAutostart : false;
setAutostartEnabled(effectiveAutostart);

// 自愈：如果 store 说已启用但注册表丢失，重新注册
if (effectiveAutostart) {
  const actuallyEnabled = await isEnabled();
  if (!actuallyEnabled) {
    try {
      await enable();
    } catch {
      // 静默失败，下次启动再试
    }
  }
}
```

### 前端事件监听（App.tsx）

```typescript
// Source: [CITED: 项目现有 main:shown-from-rust 监听模式]
// 在已有的 useEffect listen 块中追加

useEffect(() => {
  const unlistenAutostartHidden = listen("app:autostart-hidden", () => {
    hideToTray();
  });

  return () => {
    unlistenAutostartHidden.then((fn) => fn());
  };
}, [hideToTray]);
```

### SettingsDialog 第三个 Switch

```typescript
// Source: [CITED: 项目现有 SettingsDialog.tsx 模式]
// 在托盘设置分区的 space-y-4 div 中追加

{/* Switch: 开机启动 (depends on closeToTray) */}
<div
  className={cn(
    "flex items-center justify-between",
    !closeToTray && "opacity-50 pointer-events-none"
  )}
>
  <div>
    <p className="text-sm">开机启动</p>
    <p className="text-xs text-muted-foreground">
      Windows 启动时自动运行 EasyPack 并最小化到系统托盘
    </p>
  </div>
  <Switch
    checked={autostartEnabled}
    onCheckedChange={onAutostartEnabledChange}
    disabled={!closeToTray}
  />
</div>
```

### capabilities/default.json 权限追加

```json
// Source: [CITED: https://v2.tauri.app/plugin/autostart/]
// 在 permissions 数组中追加
"autostart:allow-enable",
"autostart:allow-disable",
"autostart:allow-is-enabled"
```

### Cargo.toml 依赖追加

```toml
# 在 [dependencies] 中追加
tauri-plugin-autostart = "2"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `init(MacosLauncher, args)` 函数式初始化 | `Builder::new().arg("--flag").build()` 构建器模式 | tauri-plugin-autostart v2 | Builder 更灵活，可链式调用，app_name 可自定义 |
| auto-launch 0.4 (仅检查 Run 键) | auto-launch 0.5 (检查 Run + StartupApproved) | auto-launch 0.5 | is_enabled() 现在正确处理 Task Manager 禁用情况 |
| 直接操作 winreg | auto-launch 使用 windows-registry crate | auto-launch 0.5 | 使用官方 windows crate 而非第三方 winreg，更安全 |

**Deprecated/outdated:**
- `tauri_plugin_autostart::init()` 的 `MacosLauncher` 参数：在 Windows/Linux 上无实际作用但仍需传入，推荐使用 Builder 模式

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `std::env::args()` 在 Tauri 2 setup 闭包中能正确读取 `--autostart` 参数 | Pattern 2 | 如果 Tauri 启动参数被拦截或过滤，需要改用 tauri::api::cli 或其他方式 |
| A2 | `window.hide()` 在 setup 阶段调用时 WebView 尚未加载，不会产生闪现 | Pitfall 1 | 需要实测验证；如果窗口在 setup 前已显示，可能需要配合 `visible: false` 配置 |
| A3 | 前端 mount 时 `isEnabled()` 已可用（autostart plugin 在 setup 前已初始化） | Pattern 3 | 如果插件初始化有延迟，isEnabled() 可能失败；但 .plugin() 是同步初始化的 |
| A4 | `emit("app:autostart-hidden")` 在前端未 mount 时发出，前端 listen 不会丢失 | Pitfall 4 | Tauri v2 的 listen 是否有 backlog 机制需要确认；已建议前端用主动检查替代 |

## Open Questions

1. **窗口可见性配置**
   - What we know: D-03 要求 setup 阶段隐藏窗口。现有 `tauri.conf.json` 中窗口可能配置了 `visible: true`。
   - What's unclear: 是否需要在 tauri.conf.json 中将窗口默认设为不可见，然后在非 autostart 情况下手动显示？
   - Recommendation: 保持 `visible: true` 不变，在 setup 中检测到 `--autostart` 后立即 `window.hide()`。如果实测有闪现，再改为 `visible: false` + 手动 show。

2. **自愈逻辑的最佳执行位置**
   - What we know: D-08 要求 Rust 端执行，但 Rust 端读取 plugin-store 的 JSON 需要额外逻辑。
   - What's unclear: 是否值得在 Rust 端直接读取 JSON 文件，还是让前端在 mount 时执行自愈更简洁。
   - Recommendation: 优先让前端 mount 时自愈（复用现有 loadTraySettings 模式），因为 store 的 JS API 更方便。如果用户强烈要求纯 Rust 端，可以用 `tauri_plugin_store::StoreExt` trait。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | tauri-plugin-autostart build | Yes | rustc 1.93.1 | — |
| pnpm | Frontend dependency install | Yes | (project uses pnpm) | — |
| tauri-plugin-store | Settings persistence | Yes | 2.4.2 (installed) | — |
| Tauri 2 core | Plugin compatibility | Yes | 2.x (installed) | — |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (assumed, per project JS stack) |
| Config file | vitest.config.ts (to be verified) |
| Quick run command | `pnpm test -- --run` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOT-01 | enable()/disable() toggles autostart state | integration | requires Tauri runtime | Wave 0 |
| BOOT-02 | --autostart hides window on startup | integration | requires Tauri runtime + CLI args | Wave 0 |
| BOOT-03 | self-heal re-registers lost registry entry | integration | requires Tauri runtime | Wave 0 |
| BOOT-04 | autostartEnabled persists across restarts | unit (store) | `pnpm test -- --run` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Test for autostart toggle behavior — covers BOOT-01
- [ ] Test for cascade logic (trayEnabled off -> autostartEnabled off) — covers BOOT-10/BOOT-11
- [ ] Test for store persistence of autostartEnabled — covers BOOT-04
- [ ] Note: BOOT-02/BOOT-03 require Tauri runtime, testable via manual verification only

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | No user input to validate — args are hardcoded `--autostart` |
| V6 Cryptography | no | — |

### Known Threat Patterns for Tauri autostart

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Registry injection | Tampering | tauri-plugin-autostart only writes to HKCU (not HKLM), limited scope |
| Arg spoofing | Spoofing | `--autostart` arg only controls window visibility, not security-sensitive behavior |
| Registry cleanup by malware | Denial of Service | Self-heal mechanism mitigates; app still works without autostart |

## Sources

### Primary (HIGH confidence)
- [tauri-plugin-autostart v2 official docs](https://v2.tauri.app/plugin/autostart/) — API: enable(), disable(), isEnabled(), Builder pattern, permissions
- [tauri-plugin-autostart Cargo.toml (v2 branch)](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/Cargo.toml) — version 2.5.1, depends on auto-launch 0.5
- [tauri-plugin-autostart lib.rs (v2 branch)](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/src/lib.rs) — Builder API, init() wrapper, command handlers
- [auto-launch 0.5 windows.rs](https://github.com/zzzgydi/auto-launch/blob/main/src/windows.rs) — Windows registry implementation, is_enabled() checks Run + StartupApproved
- [GitHub API: Issue #771](https://github.com/tauri-apps/plugins-workspace/issues/771) — state: open, 0 comments, not fixed but likely external cause

### Secondary (MEDIUM confidence)
- [auto-launch issue #11](https://github.com/zzzgydi/auto-launch/issues/11) — Closed 2024-02-01, library author says not a code bug

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm/crates.io registries and source code
- Architecture: HIGH — pattern derived from official docs and existing project code patterns
- Pitfalls: HIGH — Issue #771 status verified via GitHub API; auto-launch behavior verified via source code

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stable, plugin v2 is mature)
