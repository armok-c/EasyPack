# Pitfalls Research

**Domain:** Tauri 2.x Windows 桌面应用（项目快捷指令启动器）
**Researched:** 2026-04-10
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Shell 命令执行方式选错 -- Shell Plugin vs Rust Command

**What goes wrong:**
EasyPack 的核心功能是"在系统默认终端中执行 Shell 命令"。开发者容易直接使用 `tauri-plugin-shell` 的 JavaScript API (`Command.create()`) 来执行用户自定义的 `npm run build` 等命令。但这会导致三个严重问题：
1. 命令在 Tauri 进程内部以子进程方式运行，不会打开新的终端窗口（违背需求）
2. Shell Plugin 曾有 CVE-2025-31477 远程代码执行漏洞
3. 需要配置复杂的 scope 权限，每个命令都需要显式声明

**Why it happens:**
Tauri 官方文档的 Shell Plugin 页面排在搜索结果前列，开发者看到 `Command.create()` 就以为这是执行 shell 命令的正确方式，没有意识到 Tauri Shell Plugin 的设计目标是"在后台执行命令并捕获输出"，而不是"打开一个可见的终端窗口让用户看到命令执行过程"。

**How to avoid:**
在 Rust 后端使用 `std::process::Command` 调用 Windows 的 `start` 命令来在新的终端窗口中执行用户命令：

```rust
use std::process::Command as StdCommand;

// 在新的 cmd.exe 窗口中执行命令
StdCommand::new("cmd.exe")
    .args(["/C", "start", "cmd.exe", "/K", "cd /d <project_path> && <user_command>"])
    .spawn()
    .expect("failed to start terminal");
```

`/K` 参数保持终端窗口打开，`/C` 执行后关闭启动器进程。对于 Windows Terminal 用户，可以改用 `wt.exe` 命令。

如果确实需要通过 Shell Plugin 执行某些命令（如获取输出），必须在 capabilities 中显式配置 scope，严格限定允许执行的命令名和参数模式。

**Warning signs:**
- 前端 JavaScript 代码中出现了 `import { Command } from '@tauri-apps/plugin-shell'`
- capabilities 文件中出现了 `shell:allow-execute` 或 `shell:allow-spawn` 权限
- 命令执行后没有可见的终端窗口弹出

**Phase to address:**
Phase 1（核心架构搭建） -- 这是项目架构的基础决策，必须在第一步就确定命令执行方式。

---

### Pitfall 2: Tauri 2 权限/能力（Capabilities）模型配置遗漏

**What goes wrong:**
Tauri 2.x 使用全新的"权限（Permissions）+ 作用域（Scopes）+ 能力（Capabilities）"三层安全模型，取代了 Tauri 1.x 的 `allowlist`。开发者极易犯以下错误：
1. 混用 v1 的 `allowlist` 配置格式（在 Tauri 2 中完全无效）
2. 创建了 capabilities 文件但忘记声明某个插件需要的权限
3. 声明了权限但忘记配置对应的 scope（如 `fs:allow-exists` 需要 scope 才能工作）
4. capabilities 的 `windows` 字段与实际窗口 label 不匹配

任何一条都会导致运行时出现 `"Not allowed on this command"` 或 `"Permission denied"` 错误，但编译时不会报错。

**Why it happens:**
Tauri 2 的安全配置分散在多个位置：
- `src-tauri/capabilities/*.json` -- 能力定义（哪些窗口可以使用哪些权限）
- `src-tauri/tauri.conf.json` 中的 `plugins` 字段 -- 插件级别配置
- 每个 `#[tauri::command]` -- 命令级权限

这种碎片化的配置结构让开发者容易遗漏某个环节。社区反馈（Reddit 帖子"Tauri 2.0 Is A Nightmare to Learn"）普遍认为这是 Tauri 2 最令人困惑的部分。

**How to avoid:**
1. 在项目创建后立即创建 `src-tauri/capabilities/default.json`，一次性声明所有需要的权限
2. 使用 `$schema` 字段引用 `../gen/schemas/desktop-schema.json` 获取 IDE 自动补全
3. 每次添加新插件时，立即在 capabilities 中添加对应的权限集（如 `"store:default"`、`"fs:default"`）
4. 为 Store 插件需要的文件路径正确配置 scope
5. 确保 `windows` 数组包含实际使用的窗口 label（通常是 `["main"]`）

典型的 capabilities 文件结构：
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default"
  ]
}
```

**Warning signs:**
- 运行时控制台出现 `"Not allowed"` 或 `"Permission denied"` 错误
- capabilities 目录为空或不存在
- `tauri.conf.json` 中出现了 `allowlist` 字段（这是 v1 的配置）
- 插件功能间歇性工作（某些权限有了，某些没有）

**Phase to address:**
Phase 1（核心架构搭建） -- 权限模型是 Tauri 2 应用的基础，任何功能开发都依赖于正确的权限配置。

---

### Pitfall 3: Windows 路径处理错误

**What goes wrong:**
EasyPack 需要用户输入本地项目路径（如 `D:\Projects\my-app`），然后将该路径传递给 Shell 命令。Windows 路径有多个容易踩的坑：
1. Rust 的 `PathBuf` 在 Windows 上使用反斜杠，但 JSON 中反斜杠需要转义（`\\`）
2. 前端 JavaScript 传给后端的路径可能使用正斜杠，Rust 的 `PathBuf::join` 不会自动规范化斜杠
3. 路径中包含空格（如 `C:\Program Files` 或 `D:\My Projects\app`）在传给 `cmd.exe` 时如果缺少引号会导致命令截断
4. Windows 有 260 字符路径长度限制（传统 API），中文用户名可能导致路径超长

**Why it happens:**
开发者习惯了 Unix 路径的简单性，容易忽略 Windows 路径的特殊性。Rust 的 `std::path` 模块虽然提供了跨平台抽象，但 `PathBuf::join` 不会规范化已有路径中的斜杠，且传给 `cmd.exe` 时需要手动处理引号。

**How to avoid:**
1. 在 Rust 后端始终使用 `std::path::PathBuf` 处理路径，不要手动拼接字符串
2. 传递路径给 `cmd.exe` 时始终用双引号包裹：`format!("\"{}\"", path.display())`
3. 前端传递路径给后端时，使用 Tauri IPC 的结构化参数（而非字符串拼接）
4. 使用 `dunce::canonicalize()` 替代 `std::fs::canonicalize()` 来获取规范路径（避免 `\\?\` 前缀）
5. 对路径中的中文和空格做专门的测试用例

```rust
use std::path::PathBuf;

// 正确：使用 PathBuf 拼接
let project_path = PathBuf::from(r"D:\Projects\my-app");

// 传给 cmd.exe 时加引号
let quoted_path = format!("\"{}\"", project_path.display());
```

**Warning signs:**
- 路径中包含空格的目录无法正确执行命令
- 路径显示为 `\\?\D:\...` 格式（canonicalize 的副作用）
- 中文路径出现乱码或命令执行失败
- 开发环境正常但用户环境出错（用户目录含空格/中文）

**Phase to address:**
Phase 2（项目管理和命令执行核心功能） -- 路径处理是核心功能的基础，需要在实现时立即处理。

---

### Pitfall 4: 数据持久化策略选错或实现不当

**What goes wrong:**
EasyPack 需要保存项目列表和自定义指令到本地。常见的错误有：
1. 使用 WebView 的 `localStorage`（5MB 限制，且 Rust 端无法访问，清除浏览器缓存可能丢失）
2. 使用 `tauri-plugin-store` 但忘记调用 `save()`（默认不自动保存，只有优雅退出时才保存；强制关闭应用会丢失数据）
3. 自行用 `std::fs` 读写 JSON 文件但没有做原子写入（写入过程中崩溃导致文件损坏为空文件）
4. 将数据存储在应用安装目录下（更新/卸载时会丢失）

**Why it happens:**
`localStorage` 最简单，开发者顺手就用了，但它是 WebView 层的存储，有大小限制且不受 Rust 端控制。`tauri-plugin-store` 的默认行为是"优雅退出时自动保存"，但用户强制关闭进程（任务管理器、断电）会导致数据丢失。自行实现文件写入时，直接 `fs::write()` 覆盖原文件是非原子操作。

**How to avoid:**
根据 EasyPack 的数据特点（项目列表 + 自定义指令，数据量小），推荐方案：

**方案 A（推荐）：tauri-plugin-store + autoSave**
```javascript
import { load } from '@tauri-apps/plugin-store';
const store = await load('easypack-data.json', { autoSave: 100 }); // 100ms 防抖自动保存
await store.set('projects', projectsList);
```
- 设置 `autoSave` 参数，确保数据变更后 100ms 自动写入磁盘
- 数据存储在 `C:\Users\<User>\AppData\Roaming\<bundle-identifier>\` 下，不受应用更新影响
- 在 capabilities 中添加 `"store:default"` 权限

**方案 B（更稳健）：Rust 端使用 atomic write**
```rust
use std::fs;
use std::path::PathBuf;

fn atomic_write_json(path: &PathBuf, data: &serde_json::Value) -> std::io::Result<()> {
    let temp_path = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(data)?;
    fs::write(&temp_path, &json)?;
    fs::rename(&temp_path, path)?; // rename 在同一磁盘上是原子操作
    Ok(())
}
```

无论选哪种方案：
- 启动时检测数据文件是否存在/有效，损坏时提供降级处理（重建默认配置）
- 考虑保留备份文件（`data.json.bak`）
- 不要将数据文件放在应用安装目录下

**Warning signs:**
- 用户反馈添加的项目/指令在重启后丢失
- 数据文件内容为空 JSON（`{}` 或空文件）
- 应用启动时因无法解析 JSON 而崩溃
- 数据文件位于 `C:\Program Files\` 下（需要管理员权限才能写入）

**Phase to address:**
Phase 2（数据持久化功能） -- 数据持久化在实现项目管理和指令管理功能时同步完成。

---

### Pitfall 5: Rust 异步命令中使用借用类型导致编译失败

**What goes wrong:**
Tauri 2 的异步命令（`async fn`）中不能使用借用参数（如 `&str`、`State<'_, T>`），这会导致编译错误：
```
error: `async fn` with `&str` argument is not supported
```

或者更隐蔽的问题：使用 `std::sync::Mutex` 保护的状态在 `.await` 点上持有锁，导致死锁。

**Why it happens:**
Tauri 的异步命令在独立的 tokio 任务上执行。借用参数的生命周期无法安全地跨越 `.await` 点，因此 Tauri 不支持在 async 命令中使用借用类型。`std::sync::Mutex` 在 `.await` 期间持有锁会阻塞整个操作系统线程，而 tokio 运行时可能在该线程上调度其他任务，造成死锁。

**How to avoid:**
1. async 命令中使用 `String` 代替 `&str`，使用 owned 类型代替借用类型
2. 异步代码中需要访问共享状态时，使用 `tokio::sync::Mutex` 而不是 `std::sync::Mutex`
3. 锁的持有时间尽量短：获取锁、复制数据、立即释放锁，不要跨 `.await` 持有

```rust
// 错误：async 命令中使用借用类型
#[tauri::command]
async fn bad_command(name: &str) -> String {  // 编译失败
    name.to_string()
}

// 正确：使用 owned 类型
#[tauri::command]
async fn good_command(name: String) -> String {
    name
}

// 正确：异步环境中的共享状态
use tokio::sync::Mutex;

#[tauri::command]
async fn with_state(state: tauri::State<'_, Mutex<Vec<String>>>) -> Vec<String> {
    let data = state.lock().await;
    data.clone()  // 克隆后立即释放锁
}
```

**Warning signs:**
- 编译错误提到 "borrowed type in async command"
- 应用运行时偶尔冻结/无响应（死锁）
- `std::sync::Mutex` 出现在 async 函数中

**Phase to address:**
Phase 1（核心架构搭建） -- 在编写第一批 Tauri 命令时就需要遵循这些规则。

---

### Pitfall 6: generate_handler! 宏遗漏命令注册

**What goes wrong:**
创建了 `#[tauri::command]` 函数但忘记在 `generate_handler!` 宏中注册，或者多次调用 `invoke_handler()` 只保留最后一次注册（后面的覆盖前面的），导致前端 `invoke()` 调用时找不到命令。

**Why it happens:**
Tauri 的 `#[tauri::command]` 宏只是标记函数为可调用命令，但实际注册发生在 `tauri::Builder::default().invoke_handler(tauri::generate_handler![...])` 中。宏只接受一个数组，多次调用 `.invoke_handler()` 只有最后一次生效。

**How to avoid:**
将所有命令集中注册在 `lib.rs`（或 `main.rs`）的一个 `generate_handler!` 调用中：

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_projects,
            commands::add_project,
            commands::remove_project,
            commands::execute_command,
            commands::get_commands,
            commands::add_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

将命令函数放在独立模块（如 `src-tauri/src/commands.rs`）中集中管理，方便检查是否遗漏。

**Warning signs:**
- 前端调用 `invoke('command_name')` 时抛出 `Command not found` 错误
- 代码中有多个 `.invoke_handler()` 调用
- 新添加的命令偶尔工作偶尔不工作（可能被后续注册覆盖）

**Phase to address:**
Phase 1（核心架构搭建） -- 在搭建项目结构时建立良好的命令注册模式。

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 使用 localStorage 代替 tauri-plugin-store | 快速实现，无需配置权限 | 5MB 限制，Rust 端无法访问，清除浏览器缓存会丢失 | 仅用于非关键的 UI 偏好（如侧边栏展开状态） |
| 硬编码命令路径（如 `npm`） | MVP 快速交付 | 用户环境不同（pnpm/yarn/bun），命令执行失败 | MVP 阶段可接受，但需在后续迭代中支持用户自定义 |
| 在 `lib.rs` 中写所有命令代码 | 减少文件数量 | 随功能增长文件膨胀，维护困难 | 仅限 3 个以内命令时 |
| 不做路径验证直接传给 cmd.exe | 实现简单 | 路径注入风险，空格/中文路径崩溃 | 永远不可接受 |
| 使用 `String` 作为错误类型 | 快速实现错误处理 | 丢失错误上下文，前端无法区分错误类型 | MVP 阶段可接受，后续应使用自定义错误枚举 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| tauri-plugin-store | 创建 Store 后不调用 `save()` 或未设置 `autoSave` | 使用 `autoSave: 100` 参数，数据变更后自动保存 |
| tauri-plugin-store | Store 数据文件放在了应用安装目录 | 数据自动保存在 `AppData/Roaming/<identifier>/` 下，无需手动指定路径 |
| Windows cmd.exe | 命令参数包含空格但不加引号 | 始终用 `format!("\"{}\"", path)` 包裹路径参数 |
| Windows Terminal | 假设所有用户都用 cmd.exe | 优先检测 `wt.exe`（Windows Terminal），回退到 `cmd.exe` |
| WebView2 | 假设 WebView2 已安装 | Windows 10/11 通常已预装，但 Windows Server 可能缺失；Tauri 安装程序可配置自动安装 WebView2 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 同步命令阻塞主线程 | UI 冻结，窗口无响应 | 所有涉及 IO 的命令使用 `async fn` | 首次执行命令时 |
| `std::sync::Mutex` 在 async 命令中 | 间歇性死锁，应用完全冻结 | 使用 `tokio::sync::Mutex` 或缩短锁持有时间 | 并发请求时 |
| Store 频繁 `save()` | 磁盘 IO 频繁，UI 卡顿 | 使用 `autoSave` 防抖参数，不要每次 `set()` 后手动 `save()` | 指令列表频繁变更时 |
| 大量项目列表全量渲染 | DOM 节点过多，滚动卡顿 | 虚拟列表或分页渲染（EasyPack 规模小，短期不会触发） | 超过 100+ 项目时 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 直接将用户输入拼接到 cmd.exe 命令字符串 | 命令注入（用户输入 `; del /s /q C:\` 类似的指令） | 验证命令格式，使用参数化传递而非字符串拼接，限制允许的命令范围 |
| capabilities 中使用通配符权限（如 `shell:allow-execute` 无 scope） | 任意命令可被执行 | 最小权限原则，每个权限显式声明，使用 scope 限制参数 |
| 不验证项目路径合法性 | 路径遍历攻击，可能访问系统敏感目录 | 验证路径存在且是目录，使用 `canonicalize()` 规范化后检查 |
| 禁用 CSP（`disable_csp: true`） | WebView 中的 XSS 可以执行任意代码 | 保持 CSP 启用，按需放宽特定指令 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 命令执行失败无反馈 | 用户不知道命令是否执行了，或者执行失败了 | 在 Rust 端捕获 `spawn` 错误，通过事件通知前端显示错误提示 |
| 添加项目时不验证路径是否存在 | 用户添加错误路径，后续命令全部失败 | 添加时验证路径存在且为目录，不存在则提示用户 |
| 删除项目无确认对话框 | 误删项目配置，自定义指令全部丢失 | 删除前弹出确认对话框 |
| 自定义指令不支持环境变量 | 用户无法使用 `{{project_path}}` 等动态变量 | 支持模板变量替换（如 `%PROJECT_PATH%`），使命令可以在不同项目中复用 |
| 侧边栏项目列表过多时无搜索 | 用户在 20+ 项目中难以找到目标 | 超过一定数量后提供搜索/过滤功能 |

## "Looks Done But Isn't" Checklist

- [ ] **命令执行:** 点击指令卡片后终端确实打开了，且工作目录正确为所选项目路径 -- 验证命令在新终端窗口的当前目录
- [ ] **命令执行:** 包含空格的路径（如 `D:\My Projects\app`）能正确执行 -- 验证路径引号包裹
- [ ] **命令执行:** 中文路径的项目能正确执行命令 -- 验证 UTF-8 编码传递
- [ ] **数据持久化:** 强制关闭应用（任务管理器杀进程）后数据不丢失 -- 验证 autoSave 配置
- [ ] **数据持久化:** JSON 文件被意外清空/损坏时应用不崩溃 -- 验证降级处理
- [ ] **权限配置:** 生产构建（`tauri build`）后所有功能正常工作 -- 验证 capabilities 在 release 模式生效
- [ ] **项目路径:** 项目目录被移动或删除后应用不崩溃 -- 验证路径有效性检查
- [ ] **Window Subsystem:** 生产构建的 exe 不会弹出控制台窗口 -- 验证 `#![windows_subsystem = "windows"]` 配置

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 从 Shell Plugin 切换到 Rust Command | MEDIUM | 1. 将前端 `Command.create()` 调用改为 `invoke()` 调用 Rust 命令；2. 在 Rust 端实现 `std::process::Command` 调用；3. 移除 Shell Plugin 依赖 |
| 修复 Capabilities 配置 | LOW | 1. 检查 `src-tauri/capabilities/` 目录下的 JSON 文件；2. 确认每个插件权限已声明；3. 运行时测试验证 |
| 修复路径处理 | MEDIUM | 1. 审查所有路径拼接代码，替换为 `PathBuf` 操作；2. 添加路径引号包裹；3. 添加测试用例覆盖空格/中文路径 |
| 从 localStorage 迁移到 Store 插件 | MEDIUM | 1. 安装并配置 tauri-plugin-store；2. 编写数据迁移逻辑（首次启动时从 localStorage 读取并写入 Store）；3. 替换所有读写调用 |
| 修复 async 命令借用类型问题 | LOW | 1. 将 `&str` 改为 `String`；2. 将 `std::sync::Mutex` 改为 `tokio::sync::Mutex`（如需跨 await） |
| 恢复损坏的数据文件 | LOW | 1. 启动时检查 JSON 文件有效性；2. 无效时尝试加载 `.bak` 备份；3. 均无效时重置为默认配置并提示用户 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shell 命令执行方式选错 | Phase 1（架构搭建） | 在新终端窗口中成功执行 `echo hello`，工作目录正确 |
| Capabilities 权限配置遗漏 | Phase 1（架构搭建） | `tauri build` 后安装运行，所有功能正常 |
| Windows 路径处理错误 | Phase 2（项目/命令管理） | 包含空格和中文的路径都能正确执行命令 |
| 数据持久化策略选错 | Phase 2（数据持久化） | 强制杀进程后重启，数据完整 |
| async 命令借用类型 | Phase 1（架构搭建） | 编译通过且无死锁 |
| generate_handler! 遗漏注册 | Phase 1（架构搭建） | 所有命令都能被前端成功调用 |
| 命令注入安全风险 | Phase 2（命令执行） | 尝试注入恶意命令被拦截 |
| 数据文件损坏防护 | Phase 2（数据持久化） | 手动清空 JSON 文件后应用正常启动并使用默认配置 |

## Sources

- [Tauri v2 Shell Plugin 官方文档](https://v2.tauri.app/plugin/shell/) -- HIGH confidence
- [Tauri v2 Calling Rust 官方文档](https://v2.tauri.app/develop/calling-rust/) -- HIGH confidence
- [Tauri v2 Store Plugin 官方文档](https://v2.tauri.app/plugin/store/) -- HIGH confidence
- [Tauri v2 Security 官方文档](https://v2.tauri.app/security/) -- HIGH confidence
- [Tauri v2 CSP 官方文档](https://v2.tauri.app/security/csp/) -- HIGH confidence
- [CVE-2025-31477: Shell Plugin RCE 漏洞](https://www.sentinelone.com/vulnerability-database/cve-2025-31477/) -- HIGH confidence
- [GHSA-c9pr-q8gx-3mgp: Shell Plugin Scope Validation Bypass](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-c9pr-q8gx-3mgp) -- HIGH confidence
- [Terminal Window Flashing - Tauri Discussion #11446](https://github.com/orgs/tauri-apps/discussions/11446) -- MEDIUM confidence
- [Tauri v2 Capabilities Overview](https://v2.tauri.app/learn/security/using-plugin-permissions/) -- HIGH confidence
- [Persistent State in Tauri Apps - Aptabase](https://aptabase.com/blog/persistent-state-tauri-apps) -- HIGH confidence
- [fs permissions require scope - GitHub Issue #3536](https://github.com/tauri-apps/tauri-docs/issues/3536) -- HIGH confidence
- [Tauri 2.0 Learning Curve - Reddit](https://www.reddit.com/r/tauri/comments/1h4nee8/tauri_20_is_a_nightmare_to_learn/) -- MEDIUM confidence
- [Tauri State Management 官方文档](https://v2.tauri.app/develop/state-management/) -- HIGH confidence
- [Windows CREATE_NO_WINDOW - Tauri Issue #5104](https://github.com/tauri-apps/tauri/issues/5104) -- HIGH confidence
- [Sidecar 官方文档](https://v2.tauri.app/develop/sidecar/) -- HIGH confidence
- [WebView2 Runtime Issues - Tauri Issue #13926](https://github.com/tauri-apps/tauri/issues/13926) -- MEDIUM confidence
- [Rust PathBuf Portability](https://medium.com/rustaceans/handling-paths-portably-with-std-path-pathbuf-across-oses-96dd5f39f) -- HIGH confidence

---
*Pitfalls research for: Tauri 2.x Windows Desktop Application (EasyPack)*
*Researched: 2026-04-10*
