---
phase: 16-版本管理
plan: 01
status: completed
requirements_completed:
  - VER-01
  - VER-02
  - VER-04
commit: 4beabaf
---

# Plan 01: Rust 后端版本检查命令

## 完成内容

- 新增 `src-tauri/src/commands/update.rs`，包含两个 Tauri command：
  - `check_for_updates(app)` — 通过 GitHub Releases API 检查更新，24h 缓存，semver 比较
  - `open_release_page()` — 在系统默认浏览器打开 GitHub Releases 页面
- `Cargo.toml` 添加 `reqwest`（blocking+json）、`semver`、`open` 依赖
- `mod.rs` 导出 `update` 模块，`lib.rs` 注册两个 command 到 invoke_handler

## 验证结果

- `cargo check` 编译通过
- 24h 缓存逻辑使用 `updateCheck.lastCheckTime` / `updateCheck.latestVersion` store key
- 404、网络错误、API 限流均静默返回 `has_update: false`
