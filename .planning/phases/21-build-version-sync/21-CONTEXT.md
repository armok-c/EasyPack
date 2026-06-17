# Phase 21: 打包版本号更新 - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

构建时自动将 `package.json` 的 `version` 字段同步到 `src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml`。通过一个零依赖 Node.js 脚本在 `beforeBuildCommand` 阶段执行，确保打包产物的版本号与项目版本号一致。
</domain>

<decisions>
## Implementation Decisions

### 实现机制
- **D-01:** 通过修改 `tauri.conf.json` 的 `beforeBuildCommand` 拦截构建 —— `"node scripts/sync-version.js && npm run build"`
- **D-02:** 同步后保留更新后的版本号（不还原），下次发布只需改 `package.json` 一处
- **D-03:** 零依赖 Node.js 脚本实现（`fs.readFileSync` + `JSON.parse` + `JSON.stringify` + `fs.writeFileSync`）
- **D-04:** 对 JSON 文件（tauri.conf.json）只替换 `version` 字段值，保留所有其他字段和 2 空格缩进格式

### 同步范围
- **D-05:** 同时同步三个文件：`package.json`(源) → `tauri.conf.json`(目标) + `Cargo.toml`(目标)
- **D-06:** Cargo.toml 用正则 `/^version\s*=\s*"[^"]*"/m` 匹配替换，不引入 TOML 解析库
- **D-07:** 版本号原样复制，不做 semver 格式校验（信任 `package.json` 本身由 `npm version` 命令保证）
- **D-08:** 目标文件当前版本已与源相同时跳过写入，避免无意义的文件修改

### 错误处理
- **D-09:** `package.json` 不存在/无法解析 → `process.exit(1)` 终止构建，输出明确错误信息
- **D-10:** `tauri.conf.json` 或 `Cargo.toml` 不存在/不可写 → `process.exit(1)` 终止构建
- **D-11:** `Cargo.toml` 中 `version` 字段缺失 → `process.exit(1)` 终止构建
- **D-12:** 成功时输出变更摘要到 stdout（如 "Version synced: 2.0.0 → tauri.conf.json, Cargo.toml"）；失败时输出到 stderr

### Claude's Discretion
无 —— 所有决策均由用户明确选择。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 构建配置
- `src-tauri/tauri.conf.json` — Tauri 构建配置，`version` 字段和 `beforeBuildCommand` 是本次修改目标
- `package.json` — 版本号唯一来源（`version` 字段），`scripts` 区定义构建命令
- `src-tauri/Cargo.toml` — Rust crate 配置，`version` 字段需同步

### 需求文档
- `.planning/REQUIREMENTS.md` — VER-05 完整需求描述
- `.planning/ROADMAP.md` — Phase 21 成功标准和里程碑上下文

### 现有版本管理代码
- `src-tauri/src/commands/update.rs` — 已有版本检查和更新提示逻辑（`check_for_updates` 从 `app.config().version` 读取版本），同步后的版本号直接影响此功能
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 无现有可复用组件 —— 这是一个全新的构建脚本

### Established Patterns
- **零外部依赖原则：** 项目中已有 Node.js 脚本遵循零依赖模式（如无额外 npm 包的脚本），sync-version.js 遵循同一惯例
- **beforeBuildCommand 模式：** `tauri.conf.json` 已有 `"beforeBuildCommand": "npm run build"`，本次在其前追加脚本调用

### Integration Points
- `tauri.conf.json` → `build.beforeBuildCommand` — 构建钩子入口
- `tauri.conf.json` → `version` — Tauri 打包使用的版本号字段
- `Cargo.toml` → `[package].version` — Rust crate 版本，与 bundle 版本可能被用于不同的元数据
- `src-tauri/src/commands/update.rs:22` — `check_for_updates` 读取 `app.config().version` 与 GitHub Releases API 对比，同步后的版本直接影响更新检查逻辑
</code_context>

<specifics>
## Specific Ideas

- 脚本位于 `scripts/sync-version.js`，是新增目录和文件
- 输出示例：`Version synced: 2.0.1 → tauri.conf.json, Cargo.toml`（发生变更时）
- 版本相同时无输出（跳过）
- 失败示例：`Error: Cannot read package.json: ENOENT` → exit(1)

</specifics>

<deferred>
## Deferred Ideas

None — 讨论严格限制在 Phase 21 范围内。
</deferred>

---

*Phase: 21-打包版本号更新*
*Context gathered: 2026-06-17*
