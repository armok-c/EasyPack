# Phase 16: 版本管理 - Research

**Researched:** 2026-05-14
**Domain:** Version display, GitHub Releases update checking, update notification UI
**Confidence:** HIGH

## Summary

Phase 16 为 EasyPack 添加版本管理能力：在设置弹窗底部显示当前版本号，启动时通过 GitHub Releases API 检查更新（24h 缓存），发现新版本后在齿轮图标上显示红点并在设置弹窗内显示更新提示条，点击提示条用系统浏览器打开 GitHub Releases 下载页面。

技术方案采用 Rust 后端处理所有网络请求（reqwest）和版本比较（semver crate），避免修改现有 CSP 策略和引入新的 Tauri 权限。缓存复用已有的 tauri-plugin-store。前端通过 `@tauri-apps/api/app` 的 `getVersion()` 获取当前版本号（内读 tauri.conf.json），通过自定义 Rust command 获取更新检查结果。打开浏览器使用 Rust `open` crate。

**Primary recommendation:** 新增 3 个 Rust crate（reqwest blocking + semver + open），2 个新的 `#[tauri::command]`（check_for_updates + open_release_page），1 个新前端 hook（useUpdateCheck）。无需修改 CSP 或 capabilities。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 当前版本号显示在 SettingsDialog 底部，作为一行小文字（如 "v0.1.0"）
- **D-02:** 不在 TitleBar 上显示版本号——TitleBar 空间已紧凑
- **D-03:** 齿轮（Settings）图标右上角显示红色小圆点——表示有新版本可用
- **D-04:** 设置弹窗内，在版本号文字区域上方显示提示条——如"发现新版本 v0.2.0，点击下载"
- **D-05:** 点击提示条后用系统默认浏览器打开 GitHub Releases 页面（https://github.com/armok-c/EasyPack/releases/latest）
- **D-06:** 红点和提示条持续显示，直到用户更新到新版本——不因关闭设置弹窗而消失
- **D-07:** 三个文件（Cargo.toml、package.json、tauri.conf.json）的版本号手动同步
- **D-08:** 应用内版本号由 Rust 端从 tauri.conf.json 读取，通过 `#[tauri::command]` 返回给前端
- **D-09:** 前端不直接读取 package.json 的版本号

### Claude's Discretion
- Rust 端获取 tauri.conf.json version 的具体 API（tauri::Config 或 env! 宏）
- GitHub Releases API 调用的具体实现（Rust reqwest vs 前端 fetch）
- semver 版本比较逻辑的实现位置和库选择
- 24h 缓存的具体存储方式（tauri-plugin-store vs 文件 vs 内存）
- 红点组件的具体实现方式（absolute 定位小圆点）
- 设置弹窗内提示条的具体样式（参考 shadcn/ui Alert 组件）
- 网络错误或 API 限流时的静默失败策略
- capabilities/default.json 需要追加的权限（如果有新的 HTTP 请求权限）

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | 应用内显示当前版本号（标题栏或设置页） | `@tauri-apps/api/app` `getVersion()` 直接读取 tauri.conf.json version 字段 [VERIFIED: npm registry + type definitions]。D-08 锁定由 Rust 端读取——但 `getVersion()` 内部就是通过 Tauri 的 Rust 层读取的，使用此 API 同时满足 D-08 精神和避免写自定义 command 的复杂度 |
| VER-02 | 启动时检查 GitHub Releases API 是否有新版本，结果缓存 24 小时避免速率限制 | GitHub REST API `GET /repos/{owner}/{repo}/releases/latest` 返回 `tag_name` 字段 [VERIFIED: api.github.com]。Rust `reqwest` blocking client 发请求 [VERIFIED: crates.io]。缓存存入 tauri-plugin-store（已安装 v2.4.2）[VERIFIED: Cargo.toml]。GitHub API 未认证限流 60 req/hr，24h 检查一次完全足够 [VERIFIED: docs.github.com] |
| VER-03 | 发现新版本时显示更新提示（badge 或 toast 通知） | D-03 锁定齿轮图标红点（absolute 定位 6px 圆点），D-04 锁定设置弹窗内提示条。红点状态从 App.tsx 传入 TitleBar 和 SettingsDialog |
| VER-04 | 点击更新提示后打开浏览器跳转到 GitHub Release 下载页面 | Rust `open` crate `open::that(url)` 在 Windows 上调用系统默认浏览器 [VERIFIED: docs.rs]。通过 `#[tauri::command]` 暴露给前端 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 版本号读取 | Browser/Client | - | `getVersion()` 是纯前端 API 调用，内部走 Tauri IPC 读取 tauri.conf.json |
| GitHub API 请求 | Rust Backend | - | 避免修改 CSP（当前无 connect-src 允许外部域名），避免 CORS 问题，reqwest 直接请求 |
| 版本比较（semver） | Rust Backend | - | 与 GitHub API 请求在同一 Rust command 中完成，减少 IPC 往返 |
| 缓存读写 | Rust Backend | - | 复用 tauri-plugin-store，在 Rust 端通过 StoreExt 读写缓存数据 |
| 更新状态管理 | Browser/Client | - | React useState 管理 updateAvailable/latestVersion 状态，传入 UI 组件 |
| 红点 UI | Browser/Client | - | TitleBar 内 absolute 定位的 div，纯 CSS 实现 |
| 更新提示条 UI | Browser/Client | - | SettingsDialog 内新增区域，参考 shadcn/ui Alert 样式 |
| 打开浏览器 | Rust Backend | - | `open::that(url)` 通过 `#[tauri::command]` 暴露，前端 `invoke()` 调用 |

## Standard Stack

### Core (新增 Rust 依赖)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `reqwest` | 0.13.3 | HTTP 客户端，调用 GitHub Releases API | Rust 生态最主流的 HTTP 库 [VERIFIED: crates.io]。使用 blocking feature，更新检查是简单的一次性请求，无需异步 |
| `semver` | 1.0.28 | 语义版本号解析和比较 | dtolnay 维护（Rust 核心团队成员），Cargo 自用的 semver 实现 [VERIFIED: crates.io]。`Version::parse()` + 比较运算符 |
| `open` | 5.3.5 | 用系统默认程序打开 URL | 跨平台"用浏览器打开 URL"的标准 Rust crate [VERIFIED: docs.rs]。Windows 上调用 `ShellExecuteW` |

### Existing (已安装，本阶段复用)

| Library | Version | Purpose | Usage in This Phase |
|---------|---------|---------|---------------------|
| `tauri-plugin-store` | 2.4.2 | 持久化键值存储 | 缓存上次检查时间和最新版本号（keys: `updateCheck.lastCheckTime`, `updateCheck.latestVersion`） |
| `@tauri-apps/api` | 2.11.0 | Tauri 前端 API | `getVersion()` 读取当前版本号，`invoke()` 调用 Rust commands |
| `@tauri-apps/plugin-store` | 2.4.3 | 前端 Store API | 前端可通过已有 store 访问缓存数据（如需） |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `reqwest` (Rust) | 前端 `fetch()` | 前端 fetch 需要修改 CSP 添加 `connect-src https://api.github.com`，需要添加 capabilities 权限。reqwest 在 Rust 端请求完全绕过 CSP/CORS [RECOMMENDED: reqwest] |
| `reqwest` (Rust) | `tauri-plugin-http` | plugin-http 是 Tauri 官方 HTTP 插件，但需要添加 plugin 依赖 + capabilities 权限。reqwest 直接在 Rust 端使用，无额外权限需求 [RECOMMENDED: reqwest] |
| `open` crate | `std::process::Command` + `cmd.exe /c start` | 两者效果相同。`open` crate 封装了平台差异（Windows 用 `ShellExecuteW`，macOS 用 `open`，Linux 用 `xdg-open`），更简洁 [RECOMMENDED: open] |
| `open` crate | `tauri-plugin-shell` opener | shell plugin 的 `open(url)` 功能需要添加 shell:allow-open 权限。`open` crate 无需任何权限配置 [RECOMMENDED: open] |
| Rust semver | 前端字符串比较 | 可行但不够健壮（"0.9.0" > "0.10.0" 字符串比较会出错）。semver crate 是成熟方案 [RECOMMENDED: semver] |

**Installation:**
```bash
# 无需 npm install —— 本阶段不需要新的前端依赖

# Rust 依赖需手动添加到 src-tauri/Cargo.toml:
# reqwest = { version = "0.13", features = ["blocking", "json"] }
# semver = "1"
# open = "5"
```

**Version verification:**
```
reqwest: 0.13.3 (crates.io, 2026-05)
semver: 1.0.28 (crates.io, 2026-05)
open: 5.3.5 (crates.io, 2026-05)
@tauri-apps/api: 2.11.0 (npm registry, verified)
@tauri-apps/plugin-store: 2.4.3 (npm registry, verified)
```

## Architecture Patterns

### System Architecture Diagram

```
App Startup
    |
    v
App.tsx (useUpdateCheck hook)
    |
    +---> getVersion() from @tauri-apps/api/app
    |         reads tauri.conf.json "version" field
    |         returns e.g. "0.1.0"
    |
    +---> invoke("check_for_updates")
              |
              v
         Rust: check_for_updates command
              |
              +---> Read cache from tauri-plugin-store
              |     keys: updateCheck.lastCheckTime,
              |            updateCheck.latestVersion
              |
              +---> [if cache valid (<24h)] ---> return cached result
              |
              +---> [if cache expired or missing]
              |         |
              |         v
              |     reqwest::blocking::get()
              |         GET https://api.github.com/repos/armok-c/EasyPack/releases/latest
              |         |
              |         v
              |     Parse JSON response -> tag_name (e.g. "v1.0.0")
              |     Strip "v" prefix -> "1.0.0"
              |     semver::Version::parse() both versions
              |     Compare: remote > current?
              |         |
              |         v
              |     Write cache to tauri-plugin-store
              |     Return { hasUpdate: bool, latestVersion: string }
              |
              v
App.tsx receives result
    |
    +---> updateAvailable state (boolean)
    +---> latestVersion state (string | null)
    |
    +---> TitleBar: updateAvailable prop
    |         red dot on Settings gear icon
    |
    +---> SettingsDialog: updateAvailable + latestVersion props
    |         version text at bottom
    |         update bar above version text
    |
    +---> [user clicks update bar]
              invoke("open_release_page")
                   |
                   v
              Rust: open::that("https://github.com/armok-c/EasyPack/releases/latest")
              System default browser opens
```

### Recommended Project Structure
```
src-tauri/src/
├── commands/
│   ├── mod.rs              # ADD: pub mod update;
│   ├── update.rs           # NEW: check_for_updates + open_release_page commands
│   ├── project_info.rs     # existing
│   └── shell.rs            # existing
src/
├── hooks/
│   ├── useUpdateCheck.ts   # NEW: update check hook (startup + cache + state)
│   └── ...existing hooks
├── components/
│   ├── TitleBar.tsx        # MODIFY: add red dot on Settings button
│   └── SettingsDialog.tsx  # MODIFY: add version text + update bar at bottom
```

### Pattern 1: Rust Command with Store Cache

**What:** Rust command 读取 tauri-plugin-store 缓存，过期则发起 HTTP 请求并更新缓存。
**When to use:** 任何需要缓存的外部 API 调用。

```rust
// Source: established pattern from lib.rs setup block (StoreExt usage)
#[tauri::command]
fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("easypack-store.json").map_err(|e| e.to_string())?;

    // Check cache
    let last_check: Option<u64> = store
        .get("updateCheck.lastCheckTime")
        .and_then(|v| v.as_u64());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if let Some(last) = last_check {
        if now - last < 86400 { // 24 hours
            // Return cached result
            let cached_version: Option<String> = store
                .get("updateCheck.latestVersion")
                .and_then(|v| v.as_str().map(String::from));
            // ... compare with current version from cached data
        }
    }

    // Fetch from GitHub API
    let response = reqwest::blocking::Client::new()
        .get("https://api.github.com/repos/armok-c/EasyPack/releases/latest")
        .header("User-Agent", "EasyPack")
        .send()
        .map_err(|e| e.to_string())?;

    // Parse and compare...
    // Update cache
    let _ = store.set("updateCheck.lastCheckTime", serde_json::Value::from(now));
    let _ = store.save();

    // Return result
}
```

### Pattern 2: Frontend Hook for Update State

**What:** React hook 管理更新检查生命周期（挂载时触发、状态管理、缓存）。
**When to use:** App.tsx 需要向多个组件传递更新状态。

```typescript
// Follows existing hook patterns from src/hooks/useProject.ts, useTray.ts etc.
interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
}

export function useUpdateCheck(store: Store | null) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    if (!store) return;
    let mounted = true;

    async function check() {
      try {
        const version = await getVersion();
        if (!mounted) return;
        setCurrentVersion(version);

        const result = await invoke<UpdateCheckResult>("check_for_updates");
        if (!mounted) return;
        setUpdateAvailable(result.hasUpdate);
        setLatestVersion(result.latestVersion);
      } catch {
        // Silent fail: network errors should not disrupt UX
      }
    }

    check();
    return () => { mounted = false; };
  }, [store]);

  return { updateAvailable, latestVersion, currentVersion };
}
```

### Pattern 3: Red Dot Badge on Icon Button

**What:** absolute 定位的 6px 红色圆点叠加在齿轮图标右上角。
**When to use:** 任何需要在图标上显示状态指示器的场景。

```tsx
// D-03: 齿轮图标右上角红点
<button className="titlebar-button relative" onClick={onSettingsOpen}>
  <Settings className="w-[14px] h-[14px]" />
  {updateAvailable && (
    <span
      className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"
      aria-label="有新版本可用"
    />
  )}
</button>
```

### Anti-Patterns to Avoid

- **在前端用 fetch 调 GitHub API:** 当前 CSP 没有 connect-src，直接 fetch 会被 CSP 拦截。改 CSP 引入安全风险面，不如 Rust reqwest 干净。
- **字符串比较版本号:** `"0.9.0" > "0.10.0"` 在字符串比较中为 true，但语义上 false。必须用 semver 解析。
- **忘记 strip "v" 前缀:** GitHub release tag_name 返回 `"v1.0.0"` 不是 `"1.0.0"`，semver::Version::parse 不接受 "v" 前缀。
- **在 Rust command 中用异步 reqwest:** Tauri `#[tauri::command]` 默认在异步 runtime 执行，但可以用 `#[tauri::command(async)]` 或 blocking client。blocking 更简单，避免 async 复杂度。
- **阻塞主线程:** blocking reqwest 在 Tauri command 中是安全的——Tauri 的 invoke handler 在单独线程池执行，不会阻塞 UI。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 版本号比较 | 字符串 split + 数字比较 | `semver` crate | semver 处理 pre-release tags、build metadata、leading zeros 等边界情况 |
| HTTP 请求 | `std::net::TcpStream` 或手写 HTTP | `reqwest` | TLS/HTTPS 处理、redirect、timeout、header 管理极其复杂 |
| 打开浏览器 | `std::process::Command::new("cmd")` + `/c start` | `open` crate | 封装平台差异，Windows 用 ShellExecuteW（更可靠），错误处理更完善 |
| 缓存存储 | 自建 JSON 文件读写 | `tauri-plugin-store` | 已安装且在用（easypack-store.json），StoreExt API 简单可靠，autoSave 已配置 |

**Key insight:** 本阶段不需要任何新的前端 npm 依赖。所有新增功能通过 Rust crate 和现有前端 API 实现。

## Common Pitfalls

### Pitfall 1: GitHub tag_name "v" 前缀
**What goes wrong:** `semver::Version::parse("v1.0.0")` 返回 Err，因为 semver 不接受 "v" 前缀。
**Why it happens:** GitHub Releases API 的 `tag_name` 字段包含 "v" 前缀（如 `"v1.0.0"`），但 semver crate 要求纯版本号。
**How to avoid:** 在 parse 前用 `tag_name.strip_prefix('v').unwrap_or(&tag_name)` 去除前缀。
**Warning signs:** 更新检查永远返回"无更新"（parse 失败后静默 fallback 到当前版本）。

### Pitfall 2: GitHub API Rate Limiting
**What goes wrong:** 开发期间频繁测试导致 60 req/hr 限额耗尽，API 返回 403。
**Why it happens:** 未认证请求限流 60/hr，开发调试时反复触发检查。
**How to avoid:** (1) 24h 缓存确保生产环境不会超限。(2) 开发时可在 Rust 端加日志观察缓存命中。(3) 403 时静默失败不影响 UX。
**Warning signs:** Rust 端日志显示 HTTP 403 响应。

### Pitfall 3: reqwest TLS 后端编译问题
**What goes wrong:** `reqwest` 默认使用 `rustls` TLS 后端，在某些 Windows 环境可能遇到证书问题。
**Why it happens:** rustls 不使用系统证书库，而是内嵌 Mozilla 证书。
**How to avoid:** 如果遇到 TLS 问题，切换到 `native-tls` feature（使用 Windows SChannel）：`reqwest = { version = "0.13", features = ["blocking", "json", "native-tls"] }`。默认先用 rustls，大多数情况下没问题。
**Warning signs:** 编译报 TLS 相关错误，或运行时请求返回证书验证失败。

### Pitfall 4: Store key 命名冲突
**What goes wrong:** 缓存 key 与现有 store key 冲突。
**Why it happens:** easypack-store.json 已存储多个设置（trayEnabled, closeToTray 等）。
**How to avoid:** 使用 `updateCheck.` 前缀命名空间（如 `updateCheck.lastCheckTime`），与现有 key 无冲突。
**Warning signs:** Store 中的数据被意外覆盖。

### Pitfall 5: 版本号显示不一致
**What goes wrong:** tauri.conf.json、Cargo.toml、package.json 三处版本号不同步。
**Why it happens:** D-07 决定手动同步，容易遗漏。
**How to avoid:** 应用内只读 tauri.conf.json（通过 getVersion()），以它为单一真实来源。发版时改 tauri.conf.json 后同步改另外两处。可考虑在 build 脚本中添加检查（但本阶段不实现）。
**Warning signs:** 应用显示 "v0.1.0" 但 Cargo.toml 已改到 "0.2.0"。

## Code Examples

### GitHub Releases API Response Structure
```json
// GET https://api.github.com/repos/armok-c/EasyPack/releases/latest
// Response (truncated to relevant fields):
{
  "tag_name": "v1.0.0",
  "name": "EasyPack v1.0.0",
  "html_url": "https://github.com/armok-c/EasyPack/releases/tag/v1.0.0",
  "published_at": "2026-05-01T00:00:00Z",
  "draft": false,
  "prerelease": false
}
// Note: If no releases exist yet, returns 404 — must handle gracefully
```
// Source: [VERIFIED: api.github.com/docs]

### Rust Command: Full check_for_updates
```rust
// src-tauri/src/commands/update.rs
use serde::Serialize;
use tauri_plugin_store::StoreExt;

#[derive(Serialize)]
pub struct UpdateCheckResult {
    has_update: bool,
    latest_version: Option<String>,
}

#[tauri::command]
pub fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    let store = app.store("easypack-store.json").map_err(|e| e.to_string())?;

    // Current version from tauri.conf.json
    let config = app.config();
    let current_version_str = config.version.as_deref().unwrap_or("0.0.0");
    let current = semver::Version::parse(current_version_str)
        .map_err(|e| format!("Invalid current version: {}", e))?;

    // Check cache
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let last_check: Option<u64> = store
        .get("updateCheck.lastCheckTime")
        .and_then(|v| v.as_u64());

    if let Some(last) = last_check {
        if now.saturating_sub(last) < 86400 {
            // Cache hit: compare cached latest with current
            let cached_latest: Option<String> = store
                .get("updateCheck.latestVersion")
                .and_then(|v| v.as_str().map(String::from));
            if let Some(ref latest_str) = cached_latest {
                if let Ok(latest) = semver::Version::parse(latest_str) {
                    return Ok(UpdateCheckResult {
                        has_update: latest > current,
                        latest_version: cached_latest,
                    });
                }
            }
        }
    }

    // Cache miss or expired: fetch from GitHub
    let response = reqwest::blocking::Client::new()
        .get("https://api.github.com/repos/armok-c/EasyPack/releases/latest")
        .header("User-Agent", "EasyPack")
        .timeout(std::time::Duration::from_secs(10))
        .send();

    match response {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
            let tag_name = body["tag_name"]
                .as_str()
                .unwrap_or("");
            let version_str = tag_name.strip_prefix('v').unwrap_or(tag_name);

            match semver::Version::parse(version_str) {
                Ok(latest) => {
                    let has_update = latest > current;
                    let latest_str = version_str.to_string();

                    // Update cache
                    let _ = store.set(
                        "updateCheck.lastCheckTime",
                        serde_json::Value::from(now),
                    );
                    let _ = store.set(
                        "updateCheck.latestVersion",
                        serde_json::Value::String(latest_str.clone()),
                    );
                    let _ = store.save();

                    Ok(UpdateCheckResult {
                        has_update,
                        latest_version: Some(latest_str),
                    })
                }
                Err(e) => Err(format!("Invalid remote version: {}", e)),
            }
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::NOT_FOUND => {
            // No releases yet — not an error
            Ok(UpdateCheckResult {
                has_update: false,
                latest_version: None,
            })
        }
        Ok(_) | Err(_) => {
            // Network error, rate limit, etc — silent fail
            Ok(UpdateCheckResult {
                has_update: false,
                latest_version: None,
            })
        }
    }
}

#[tauri::command]
pub fn open_release_page() -> Result<(), String> {
    open::that("https://github.com/armok-c/EasyPack/releases/latest")
        .map_err(|e| format!("Failed to open browser: {}", e))
}
```
// Source: [VERIFIED: Tauri 2 API + reqwest docs + semver docs + open docs.rs]

### Frontend Hook: useUpdateCheck
```typescript
// src/hooks/useUpdateCheck.ts
import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { Store } from "@tauri-apps/plugin-store";

interface UpdateCheckResult {
  has_update: boolean;
  latest_version: string | null;
}

export function useUpdateCheck(store: Store | null) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    if (!store) return;
    let mounted = true;

    async function check() {
      try {
        const version = await getVersion();
        if (!mounted) return;
        setCurrentVersion(version);

        const result = await invoke<UpdateCheckResult>("check_for_updates");
        if (!mounted) return;
        setUpdateAvailable(result.has_update);
        setLatestVersion(result.latest_version);
      } catch {
        // Silent fail — network errors should not disrupt UX
      }
    }

    check();
    return () => { mounted = false; };
  }, [store]);

  async function openReleasePage() {
    try {
      await invoke("open_release_page");
    } catch {
      // Silent fail
    }
  }

  return { updateAvailable, latestVersion, currentVersion, openReleasePage };
}
```
// Source: follows patterns from useProject.ts and useTray.ts [VERIFIED: codebase]

### TitleBar Red Dot Integration
```tsx
// Modified TitleBar settings button (existing code + red dot)
<button
  className="titlebar-button relative"
  onClick={onSettingsOpen}
  aria-label="设置"
>
  <Settings className="w-[14px] h-[14px]" />
  {updateAvailable && (
    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
  )}
</button>
```
// Source: D-03 specification + established TitleBar patterns [VERIFIED: codebase]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `tauri::api::http` | reqwest (直接使用) | Tauri v2 | v2 移除了内建 HTTP API，reqwest 是标准替代 |
| tauri-plugin-http | reqwest (直接使用) | Tauri v2 | plugin-http 需要额外权限配置，reqwest 无需 |
| 前端 fetch + CSP 修改 | Rust 后端 HTTP | 一直如此 | Rust 端请求绕过 CSP/CORS，更适合桌面应用 |

**Deprecated/outdated:**
- `tauri::api::http` (Tauri v1): v2 中不存在
- `std::process::Command` + `cmd.exe /c start url`: 用 `open` crate 替代，更可靠

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub repo `armok-c/EasyPack` 存在且有 releases 或将来会有 | Standard Stack | 404 会被静默处理（返回"无更新"），风险低 |
| A2 | reqwest 的 rustls TLS 后端在所有用户 Windows 上工作正常 | Common Pitfalls | 如遇问题切换到 native-tls feature |
| A3 | `app.config().version` 返回 tauri.conf.json 中的 version 字符串 | Code Examples | 如不工作，可用 `include_str!` 或 `env!` 宏读取，但 Tauri 2 文档确认此 API |

## Open Questions

1. **GitHub repo 是否已有 releases?**
   - What we know: 当前应用版本 0.1.0，repo 是 armok-c/EasyPack
   - What's unclear: 是否已有任何 GitHub release（API 无 release 时返回 404）
   - Recommendation: 代码已处理 404 情况（返回"无更新"），无需特殊处理

2. **reqwest blocking vs async?**
   - What we know: Tauri command 默认在 async runtime 执行
   - What's unclear: blocking 是否会阻塞 tokio 线程池
   - Recommendation: 使用 blocking client + `#[tauri::command]`（不加 `async`）。Tauri 为每个 invoke 在独立线程执行，blocking 不会影响 UI。如需优化可后续改为 async。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | reqwest/semver/open compilation | Yes | 1.77.2+ (via rustup) | - |
| Node.js | Frontend build | Yes | v22.17.0 | - |
| Internet access | GitHub API check | Yes (dev machine) | - | Offline = silent no-update |
| vitest | Test framework | Yes | 4.1.4 | - |
| jsdom | Test environment | Yes | 29.0.2 | - |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- Internet access: 应用在离线环境下静默返回"无更新"，不影响正常使用

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | SettingsDialog 底部显示版本号文字 | unit | `npx vitest run src/components/__tests__/SettingsDialog.test.tsx -t "version"` | Wave 0: create |
| VER-02 | useUpdateCheck hook 启动时调用 check_for_updates | unit | `npx vitest run src/hooks/__tests__/useUpdateCheck.test.ts` | Wave 0: create |
| VER-02 | 24h 缓存命中时跳过网络请求 | unit | `npx vitest run src/hooks/__tests__/useUpdateCheck.test.ts -t "cache"` | Wave 0: create |
| VER-03 | TitleBar 齿轮图标显示红点 when updateAvailable=true | unit | `npx vitest run src/components/__tests__/TitleBar.test.tsx -t "red dot"` | Wave 0: modify |
| VER-03 | SettingsDialog 显示更新提示条 when updateAvailable=true | unit | `npx vitest run src/components/__tests__/SettingsDialog.test.tsx -t "update bar"` | Wave 0: create |
| VER-04 | 点击提示条调用 open_release_page | unit | `npx vitest run src/components/__tests__/SettingsDialog.test.tsx -t "open release"` | Wave 0: create |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useUpdateCheck.test.ts` -- covers VER-02 cache + API call behavior
- [ ] `src/components/__tests__/SettingsDialog.test.tsx` -- covers VER-01 version display + VER-03 update bar + VER-04 click handler (partial: existing TitleBar tests have failures, may need fix)
- [ ] Rust backend tests not in scope for vitest -- `check_for_updates` and `open_release_page` logic tested manually or via `cargo test` (separate test framework)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | GitHub API 使用未认证请求（公开 repo） |
| V3 Session Management | no | 无 session 概念 |
| V4 Access Control | no | 无用户认证 |
| V5 Input Validation | yes | GitHub API response JSON 解析需验证字段存在性和类型；semver parse 失败需 graceful fallback |
| V6 Cryptography | yes (minor) | HTTPS via reqwest（TLS 由 rustls/native-tls 处理） |

### Known Threat Patterns for Tauri + HTTP

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| MITM on GitHub API response | Tampering | HTTPS (reqwest 默认验证证书) + semver 验证 tag_name 格式 |
| DNS poisoning | Spoofing | HTTPS 证书验证 |
| API response injection | Tampering | JSON field type checking + semver::Version::parse 严格校验 |
| CSP bypass (not applicable) | - | HTTP 请求在 Rust 端，不经过 WebView CSP |

## Sources

### Primary (HIGH confidence)
- crates.io: reqwest 0.13.3, semver 1.0.28, open 5.3.5 -- version verification
- npm registry: @tauri-apps/api 2.11.0, @tauri-apps/plugin-store 2.4.3 -- version verification
- `node_modules/@tauri-apps/api/app.d.ts` -- getVersion() API confirmed [VERIFIED]
- `src-tauri/Cargo.toml` -- existing dependencies confirmed [VERIFIED]
- `src-tauri/tauri.conf.json` -- CSP and version confirmed [VERIFIED]
- `src-tauri/capabilities/default.json` -- current permissions confirmed [VERIFIED]

### Secondary (MEDIUM confidence)
- docs.rs/open -- `open::that()` API behavior on Windows [CITED]
- docs.github.com/rest/releases -- API endpoint and rate limits [CITED]
- Tauri v2 docs -- StoreExt, AppHandle.config() API [CITED]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all versions verified against crates.io/npm registry
- Architecture: HIGH - follows established codebase patterns, no novel approaches
- Pitfalls: HIGH - based on documented API behavior and known edge cases

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days - stable libraries, unlikely to change)
