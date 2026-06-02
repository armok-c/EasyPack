# Domain Pitfalls: EasyPack v2.0

**Domain:** Tauri 2.x + React 19 Windows 桌面应用 -- 在 v1.2 基础上增加多行脚本、版本管理、快捷键面板、悬浮窗改进、开机启动、多配置文件管理
**Researched:** 2026-05-13
**Overall confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, security vulnerabilities, or user-facing breakage.

---

### Pitfall 1: 多行脚本命令注入导致任意代码执行（安全漏洞）

**What goes wrong:**
当前 `execute_command` 使用 `raw_arg()` 将单行命令直接拼接进 `cmd /C start "" ... cmd /K "..."` 字符串。多行脚本扩展后，如果用户输入包含引号转义字符（`"`）、命令分隔符（`&`、`|`、`&&`、`||`）、换行符注入（`\n`），或子 shell 调用（`$(...)`），攻击者可以通过精心构造的输入突破命令边界，执行任意系统命令。

即使 EasyPack 是个人工具，如果未来支持导入/导出配置文件，恶意配置文件中可以嵌入注入脚本。XSS 漏洞（WebView 中的第三方内容）也可以通过 Tauri 的 `invoke` 触发 shell 命令执行，形成 XSS -> RCE 攻击链。

**Why it happens:**
当前 `build_cmd_start_args` 将用户输入的 `shell_command` 直接嵌入双引号包裹的字符串中：

```rust
format!(r#"/C start "" /d "{}" cmd /K "{}""#, project_path, shell_command)
```

如果 `shell_command` 包含 `"` 字符，就可以闭合引号并注入任意命令。例如：`git pull" & net user hacker Pass123 /add & echo "` 会执行三个命令而非一个。

多行脚本让问题更严重，因为用户脚本天然包含 `&`、`&&`、`|`、`if`、`for` 等 cmd.exe 控制流语法，不能简单过滤这些字符。

**Consequences:**
- 任意系统命令执行（删除文件、安装恶意软件、建立反向 shell）
- 导入恶意配置文件时自动执行嵌入的注入脚本
- Bishop Fox 安全研究已证明 Tauri 应用的 XSS -> Shell -> RCE 攻击路径

**How to avoid:**
1. **改用临时 .bat/.cmd 文件执行多行脚本** -- 将多行脚本内容写入临时文件，然后用 `cmd /K` 执行该文件。这样脚本内容是文件数据而非命令行参数，彻底消除注入向量。

```rust
use std::io::Write;
use tempfile::NamedTempFile;

fn execute_multiline_script(project_path: &str, script_lines: &[String]) -> Result<(), String> {
    // 将脚本写入临时文件
    let mut temp = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    for line in script_lines {
        writeln!(temp, "{}", line)
            .map_err(|e| format!("Failed to write script: {}", e))?;
    }
    let temp_path = temp.into_temp_path();
    let temp_str = temp_path.to_string_lossy().to_string();

    // 执行临时文件
    let args = format!(
        r#"/C start "" /d "{}" cmd /K "{}""#,
        project_path, temp_str
    );
    StdCommand::new("cmd")
        .raw_arg(&args)
        .spawn()
        .map_err(|e| format!("Failed to execute: {}", e))?;
    Ok(())
}
```

2. **单行命令继续使用现有方案**，但验证不包含未闭合的引号和换行符
3. **配置导入时校验脚本内容** -- 对导入的 JSON 中的脚本字段进行安全审计，至少标记或警告包含危险模式的脚本
4. **CSP 保持严格** -- 当前 CSP（`script-src 'self'`）是正确防御 XSS 的基础，不能放松

**Warning signs:**
- 脚本内容中包含未匹配的 `"` 字符
- 脚本内容包含换行符（`\n`、`\r\n`）但命令模式标记为"单行"
- 导入的配置文件中包含异常长的脚本内容或可疑命令模式（`powershell`、`cmd /c`、`curl`、`wget`）

**Phase to address:** 多行脚本 Phase（在第一个多行脚本实现中就必须使用临时文件方案，不允许在命令行参数中拼接多行内容）

---

### Pitfall 2: 临时脚本文件的编码问题导致中文路径/命令乱码

**What goes wrong:**
如果多行脚本使用临时 .bat 文件方案（Pitfall 1 的推荐方案），文件编码必须与 cmd.exe 的活跃代码页一致。Windows cmd.exe 默认使用系统代码页（中文 Windows 为 GBK/CP936，英文为 CP437），而非 UTF-8。

如果临时文件用 UTF-8 写入（Rust 的默认行为），而 cmd.exe 用 GBK 读取，则：
1. 脚本中的中文注释或中文字符串变为乱码
2. 项目路径中的中文目录（如 `D:\用户\项目`）无法正确解析
3. `cd` 到中文路径失败，后续命令在错误目录执行

**Why it happens:**
Rust 的 `std::fs::File` + `write!` 默认输出 UTF-8 字节流。cmd.exe 按 `chcp` 指定的代码页（默认 GBK）解释 .bat 文件内容。编码不匹配导致乱码。

**Consequences:**
- 中文路径的项目中多行脚本完全无法工作
- 用户以为是脚本逻辑错误，实际是编码问题
- 难以调试（乱码在终端中显示但不影响退出码）

**How to avoid:**
1. **在临时 .bat 文件开头插入 `chcp 65001`** -- 切换 cmd.exe 到 UTF-8 模式，然后文件可以用 UTF-8 编码写入

```rust
fn write_script_file(lines: &[String]) -> Result<NamedTempFile, String> {
    let mut temp = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    // 切换 cmd 到 UTF-8 代码页
    writeln!(temp, "chcp 65001 >nul")
        .map_err(|e| format!("Failed to write: {}", e))?;
    for line in lines {
        writeln!(temp, "{}", line)
            .map_err(|e| format!("Failed to write: {}", e))?;
    }
    Ok(temp)
}
```

2. **使用 UTF-8 BOM（Byte Order Mark）** -- cmd.exe 会识别 UTF-8 BOM（`EF BB BF`）并自动切换到 UTF-8 模式。但 `chcp 65001` 更可靠。
3. **写入文件时使用 GBK 编码** -- 需要 `encoding_rs` crate，但这不支持所有 Unicode 字符
4. **推荐方案**：`chcp 65001 >nul` 前缀 + UTF-8 无 BOM 写入，最简单可靠

**Warning signs:**
- 多行脚本在英文路径项目中正常但中文路径项目中失败
- 终端输出中文乱码
- `cd` 命令返回 "系统找不到指定的路径"

**Phase to address:** 多行脚本 Phase（编码方案必须与临时文件方案同步设计）

---

### Pitfall 3: GitHub API 无认证请求的 60 次/小时速率限制

**What goes wrong:**
版本管理的"检查更新"功能需要调用 GitHub Releases API（`https://api.github.com/repos/{owner}/{repo}/releases/latest`）。如果每次启动都调用此 API，且不使用认证 token，速率限制为每 IP 每小时 60 次。

如果用户在办公室或 VPN 环境中，多个开发者共享同一出口 IP，60 次限额会被所有开发者共享，很快耗尽。这导致版本检查失败，用户看到网络错误。

更严重的是：如果在 UI 中提供了"检查更新"按钮，用户可能反复点击，每次点击消耗一次配额。

**Why it happens:**
GitHub REST API 对无认证请求按 IP 地址限制，不区分单个用户。EasyPack 是个人工具，嵌入 GitHub token 不合理（会暴露在二进制文件中），但无认证限制确实很紧。

**Consequences:**
- 版本检查功能在共享网络环境中完全不可用
- 429 Too Many Requests 错误影响用户体验
- 用户可能误以为是应用 bug

**How to avoid:**
1. **本地缓存版本信息** -- 成功获取后缓存到本地（tauri-plugin-store），24 小时内不重复请求
2. **启动时静默检查，失败不报错** -- 版本检查是辅助功能，不应阻塞正常使用
3. **手动检查按钮加冷却** -- "检查更新"按钮点击后禁用 5 分钟
4. **解析 rate limit 响应头** -- 从 `X-RateLimit-Remaining` 获取剩余配额，显示给用户
5. **不使用 Personal Access Token** -- EasyPack 是开源个人工具，不应要求用户配置 GitHub token

```typescript
const VERSION_CACHE_KEY = "latestVersion";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function checkForUpdates(): Promise<VersionInfo | null> {
  // 检查缓存
  const cached = await store.get<{ version: string; checkedAt: number }>(VERSION_CACHE_KEY);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/{owner}/{repo}/releases/latest",
      { headers: { "Accept": "application/vnd.github+json" } }
    );
    if (response.status === 403 || response.status === 429) {
      return null; // rate limited, silent fail
    }
    // ... parse response
  } catch {
    return null; // network error, silent fail
  }
}
```

**Warning signs:**
- `fetch` 返回 403 或 429 状态码
- `X-RateLimit-Remaining` 响应头为 0
- 多人报告版本检查失败

**Phase to address:** 版本管理 Phase（必须在第一次 API 调用实现时就包含缓存逻辑）

---

### Pitfall 4: 开机启动注册在 Windows 更新或用户配置变更后丢失

**What goes wrong:**
`tauri-plugin-autostart` 在 Windows 上使用 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 注册表键实现开机启动。已知存在以下问题：

1. **注册条目在重启后消失** -- GitHub issue #771 报告了 autostart 注册在一次重启后消失的 bug
2. **Windows 更新清理注册表** -- 某些 Windows 11 更新会清理 `Run` 键中指向已移动/重命名路径的条目。如果 EasyPack 在更新后安装路径变化，开机启动失效
3. **用户通过任务管理器禁用** -- Windows 任务管理器的"启动"选项卡允许用户禁用开机启动项，但用户可能忘记自己曾经禁用过

**Why it happens:**
注册表 `Run` 键的持久性不如 Windows 服务或任务计划程序。Windows 安全更新和系统维护可能会清理它认为"可疑"或"过时"的启动项。

**Consequences:**
- 用户开启了开机启动但实际没有生效
- 用户报告"开机启动不工作"，难以复现和调试
- 间歇性问题，不是每次都发生

**How to avoid:**
1. **启动时验证注册状态** -- 每次应用启动时检查 autostart 是否仍有效注册，如果失效且 UI 开关显示已开启，自动重新注册

```typescript
// 启动时验证
async function verifyAutostartEnabled(): Promise<boolean> {
  const enabled = await isEnabled();
  const uiSetting = await store.get<boolean>("autostartEnabled");
  if (uiSetting && !enabled) {
    // UI 显示已开启但实际未注册，自动修复
    await enable();
  }
  return isEnabled();
}
```

2. **UI 开关状态与实际注册状态分离** -- UI 记录"用户意图"，启动时同步"实际状态"
3. **不使用 HKLM（需要管理员权限）** -- 保持 HKCU 即可，普通用户权限足够
4. **文档说明已知限制** -- 在设置页面添加提示："某些 Windows 更新可能重置开机启动设置"

**Warning signs:**
- `isEnabled()` 返回 false 但 store 中记录为 true
- 用户重启后 EasyPack 未自动启动
- 注册表中找不到 EasyPack 的 Run 条目

**Phase to address:** 开机启动 Phase（enable/disable 逻辑必须包含自修复机制）

---

### Pitfall 5: 配置文件导入的任意脚本注入（安全漏洞）

**What goes wrong:**
多配置文件管理功能支持导入/导出 JSON 配置文件。导出的 JSON 中包含自定义指令的 `command` 字段，这些字段是多行脚本。如果恶意构造的配置文件被导入：

1. 恶意脚本通过导入流程进入用户的指令列表
2. 用户不知情地执行了来自外部来源的脚本
3. 配合自动化执行功能（如果未来添加），可能形成静默攻击链

即使 EasyPack 是个人工具，用户可能从社区或同事那里获取"推荐配置"，其中可能无意或有意包含危险命令。

**Why it happens:**
JSON 导入通常只验证结构是否合法（有 name、command 字段），不验证内容是否安全。命令内容对应用来说是"不透明"的字符串 -- 用户自己写 `rm -rf /` 是合法的，但从外部导入就不一定了。

**Consequences:**
- 社交工程攻击：分享"高效开发配置"实际包含恶意脚本
- 数据丢失：恶意脚本删除项目文件
- 凭据泄露：脚本可能读取 .env 文件并发送到远程服务器

**How to avoid:**
1. **导入时安全审查** -- 扫描导入的命令内容，标记危险模式

```typescript
const DANGEROUS_PATTERNS = [
  /curl\s+.*\|\s*(ba)?sh/,       // 远程脚本执行
  /powershell.*-enc/,              // 编码的 PowerShell 命令
  /reg\s+(add|delete)/,           // 注册表修改
  /net\s+(user|localgroup)/,      // 用户管理
  /certutil/,                      // 证书工具（常被滥用）
  /bitsadmin/,                     // 下载工具
  /rundll32/,                      // DLL 执行
];

function auditCommands(commands: CommandItem[]): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  for (const cmd of commands) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(cmd.command)) {
        warnings.push(`指令 "${cmd.name}" 包含潜在危险操作: ${cmd.command}`);
      }
    }
  }
  return { safe: warnings.length === 0, warnings };
}
```

2. **导入前确认对话框** -- 显示导入内容摘要，包含命令数量和任何警告，要求用户确认
3. **不自动执行导入的命令** -- 导入只添加到配置，不触发执行
4. **导出文件包含校验信息** -- 添加内容哈希，导入时验证文件完整性

**Warning signs:**
- 导入的配置文件中命令字段包含 `curl | sh`、`powershell -enc`、`reg add` 等模式
- 配置文件来源不明确
- 导入文件大小异常（可能包含大量 base64 编码的恶意载荷）

**Phase to address:** 多配置文件 Phase（导入功能必须在第一版就包含安全审查）

---

### Pitfall 6: 配置切换时的竞态条件导致数据损坏

**What goes wrong:**
多配置文件切换需要：(1) 保存当前配置状态，(2) 加载新配置状态，(3) 更新 UI。如果这些步骤不是原子操作，快速切换配置时可能出现：

1. 保存操作 A 写了一半，切换到配置 B，B 的加载操作读到 A 的半写状态
2. 快速双击切换按钮导致两次切换请求并发执行
3. React 状态更新和 tauri-plugin-store 的异步写入不同步 -- React state 已切换到配置 B，但 store 还在写配置 A 的数据

**Why it happens:**
tauri-plugin-store 的 `set()` 和 `get()` 是异步操作（返回 Promise），没有事务支持。React 的 `setState` 是批处理的。两个异步操作序列交叉执行时，无法保证顺序。

**Consequences:**
- 配置数据损坏 -- 两个配置的数据混在一起
- 丢失最近的自定义指令配置
- 用户需要手动修复配置文件

**How to avoid:**
1. **切换锁机制** -- 使用与 `useFloatWindow` 相同的 `operationLock` Promise-chain mutex 模式

```typescript
const switchLock = useRef(Promise.resolve());

function switchProfile(newProfileId: string) {
  switchLock.current = switchLock.current.then(async () => {
    // Step 1: 保存当前配置（完整快照）
    await saveCurrentProfile();

    // Step 2: 加载新配置（完整替换）
    await loadProfile(newProfileId);

    // Step 3: 更新 React state（一次性批量更新）
    setProfileState(newProfileId);
  });
}
```

2. **快照式保存** -- 保存配置时写入完整的配置快照（而非增量更新），避免部分写入
3. **写入后验证** -- 保存后立即读回验证，确保数据完整

**Warning signs:**
- 快速点击切换时 UI 闪烁或显示混合数据
- store 文件中出现重复或缺失的 key
- 切换后自定义指令列表为空或不完整

**Phase to address:** 多配置文件 Phase（切换锁机制是核心设计，不能延后）

---

### Pitfall 7: 可折叠悬浮窗的窗口尺寸约束在 Tauri v2 中的怪异行为

**What goes wrong:**
v1.2 的悬浮窗使用固定尺寸（220x300）。v2.0 要让悬浮窗可折叠（折叠后只显示项目名+图标的小条）。这涉及动态调整窗口尺寸（`setWindowSize`），在 Tauri v2 的无边框窗口中可能出现：

1. **Windows DWM 最小窗口尺寸限制** -- Windows 对无边框窗口有最小尺寸限制（通常 ~4px 高度），但某些 Windows 版本上设为极小尺寸时窗口会被系统隐藏
2. **`setWindowSize` 触发 `onResized` 事件** -- 尺寸变化触发的事件可能与折叠动画的 JS 逻辑冲突
3. **`alwaysOnTop` + 极小窗口在某些 Windows 版本上被 DWM 忽略** -- 窗口可能被其他窗口覆盖而非浮在最上层
4. **折叠态窗口接收不到鼠标点击** -- 极小窗口的 hit test 区域太小，点击穿透到下层窗口

**Why it happens:**
Windows 的 DWM（Desktop Window Manager）对窗口有内部最小尺寸管理和 Z-order 优化。极小的 topmost 窗口可能被 DWM 视为"无意义"而进行特殊处理。Tauri v2 在 Windows 上的窗口管理经过 webview2 层，某些 Win32 API 行为被中间层修改。

**Consequences:**
- 折叠后窗口"消失"（被 DWM 隐藏）
- 点击折叠态窗口没有反应
- 展开/折叠动画不平滑，有闪烁
- 多显示器上折叠/展开后窗口跳到错误位置

**How to avoid:**
1. **折叠态使用"足够大"的尺寸** -- 不追求极小（如 24px 高），而是保持 40-48px，确保 DWM 不做特殊处理
2. **折叠时使用 `setContentSize` 而非 `setWindowSize`** -- 保持窗口尺寸不变，只缩小内容区域并用 CSS 实现折叠动画。窗口本身始终是可点击的完整尺寸
3. **折叠态添加明显的视觉区域** -- 使用背景色或边框确保 DWM 不会隐藏窗口

```typescript
// 折叠：用 CSS 隐藏内容，保持窗口尺寸
async function collapseFloat() {
  await emitTo("float", "float:collapse", {});
  // 窗口尺寸保持不变（如 220x300），CSS 控制内容显示
}

// 或者：适度缩小窗口（不追求极小）
async function collapseFloat() {
  const win = await WebviewWindow.getByLabel("float");
  if (win) {
    await win.setSize(new LogicalSize(220, 48)); // 最小 48px
  }
}
```

4. **保留 v1.2 的 operationLock mutex 模式** -- 折叠/展开操作序列化，防止动画竞态

**Warning signs:**
- 折叠后 `is_visible()` 返回 true 但窗口不可见
- 点击折叠态窗口时 focus 事件不触发
- Windows 10 和 Windows 11 上行为不一致

**Phase to address:** 悬浮窗改进 Phase（折叠态尺寸方案在设计阶段就确定，不能先写代码再调试尺寸问题）

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 多行脚本用命令行拼接（不用临时文件） | 实现简单，少写一个函数 | 安全漏洞（命令注入），所有后续版本都需修补 | NEVER -- 必须从一开始就用临时文件 |
| 版本检查不用缓存 | 省去 store 读写 | 每次 API 调用消耗 rate limit，共享网络下极易耗尽 | NEVER -- 首次实现就必须缓存 |
| 配置切换不加锁 | 代码简单 | 数据损坏风险，后续修复需要重构整个切换流程 | NEVER -- 已有 operationLock 模式可复用 |
| 导入配置不做安全审查 | 开发快，用户"不会导入恶意文件" | 社区分享场景下的信任链断裂 | NEVER -- 必须有基础审查 |
| 临时文件不清理 | 少写清理逻辑 | 临时目录积累 .bat 文件，占用磁盘 | NEVER -- 必须在执行后或应用退出时清理 |
| 快捷键面板直接操作 tauri-plugin-global-shortcut | 简化状态管理 | 注册失败无回退，UI 状态与 OS 状态不一致 | 仅 MVP 原型阶段 |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Releases API | 每次启动调用，不缓存，不处理 429 | 本地缓存 24h，失败静默，解析 rate limit 响应头 |
| tauri-plugin-autostart | enable 后不验证，UI 状态与实际不一致 | 启动时调用 `isEnabled()` 验证，自修复机制 |
| tauri-plugin-store (多配置) | 多个 `await store.set()` 交叉执行 | mutex 序列化所有 store 写操作 |
| Windows cmd.exe (多行脚本) | 用命令行拼接传递多行内容 | 写入临时 .bat 文件，文件头加 `chcp 65001 >nul` |
| Windows Registry (autostart) | 假设注册一次永久有效 | 每次启动验证，处理注册丢失的情况 |
| Tauri WebviewWindow (悬浮窗折叠) | 折叠时 setWindowSize 到极小值 | 保持合理最小尺寸（>= 48px），或用 CSS 折叠内容 |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 多行脚本临时文件积累 | `%TEMP%` 目录 .bat 文件增多，磁盘占用 | 执行后删除或应用退出时批量清理 | 100+ 脚本执行/天 |
| 配置文件 JSON 膨胀 | store 加载变慢，启动延迟 | 按配置拆分文件，惰性加载非活跃配置 | 单配置 > 1MB JSON |
| 版本检查阻塞启动 | 启动时卡顿 2-3 秒 | 异步后台检查，不阻塞 UI 渲染 | 网络慢或 API 延迟 |
| 快捷键面板全量注册 | 面板打开/关闭时短暂卡顿 | 面板中不注册快捷键，只记录按键组合，确认后再注册 | 50+ 快捷键 |
| 悬浮窗频繁 resize 事件 | CPU 占用升高，动画卡顿 | debounce resize 处理，折叠/展开用 CSS 动画 | 快速连续折叠/展开 |

## Security Mistakes

Domain-specific security issues for Tauri 2 desktop app with shell execution.

| Mistake | Risk | Prevention |
|---------|------|------------|
| 多行脚本用命令行参数拼接 | 命令注入 -> 任意代码执行 (CRITICAL) | 临时 .bat 文件 + `chcp 65001` |
| 配置导入无安全审查 | 恶意脚本通过"推荐配置"传播 (HIGH) | 危险模式扫描 + 确认对话框 |
| 临时 .bat 文件权限过宽 | 其他用户/进程可读取脚本内容 (LOW) | 使用 `%TEMP%` 默认权限（用户私有） |
| 版本检查不验证 TLS 证书 | MITM 攻击注入虚假版本信息 (MEDIUM) | `fetch` 默认验证 TLS，不使用自定义 agent |
| 配置导出包含敏感信息 | 暴露项目路径、自定义命令中的 token (MEDIUM) | 导出时警告用户检查敏感内容 |
| autostart 注册表路径可被篡改 | 攻击者替换启动路径指向恶意程序 (LOW) | HKCU 仅当前用户可写，风险较低 |
| XSS -> invoke -> RCE | WebView 中的恶意内容调用 execute_command (CRITICAL) | 严格 CSP + 不加载外部内容 + sanitize 输入 |

## UX Pitfalls

Common user experience mistakes for this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 多行脚本编辑器无语法高亮 | 用户难以区分命令、注释、控制流 | 至少支持 cmd.exe 关键字高亮（if/else/for/echo/rem） |
| 快捷键面板无搜索过滤 | 50+ 指令时找不到目标 | VS Code 风格搜索框 + 分类筛选 |
| 版本更新提示无 changelog | 用户不知道是否值得更新 | 显示版本号 + 主要变更摘要 |
| 开机启动开启无状态反馈 | 用户不确定是否成功 | 设置页面显示当前注册状态（已注册/未注册/异常） |
| 配置切换无确认 | 误触导致当前工作上下文丢失 | 切换前保存当前配置的提示 |
| 配置导入无预览 | 导入后发现内容不符预期 | 先显示导入预览，用户确认后应用 |
| 折叠悬浮窗展开位置跳变 | 多显示器上展开后窗口跑到主显示器 | 记录折叠前位置，展开时恢复到相同位置 |
| 多行脚本执行失败无反馈 | 终端一闪而过看不到错误 | 使用 `cmd /K`（已采用）保持终端打开 |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **多行脚本执行:** 临时文件创建成功 -- 验证文件编码（UTF-8 + chcp 65001）、中文路径项目下执行、临时文件清理
- [ ] **多行脚本编辑器:** UI 可输入多行 -- 验证脚本中的引号不影响命令拼接、换行符正确传递到 Rust 端、Ctrl+Enter 触发执行
- [ ] **版本检查:** API 调用返回数据 -- 验证 rate limit 处理、缓存逻辑、网络断开时不报错
- [ ] **版本比较:** 比较版本号大小 -- 验证 pre-release 版本（`2.0.0-beta.1` < `2.0.0`）、build metadata 忽略、v0.1.0 vs v1.0.0 比较正确
- [ ] **快捷键面板:** 显示所有指令的快捷键 -- 验证冲突检测跨配置文件生效、键盘布局差异、注册失败有 UI 反馈
- [ ] **悬浮窗折叠:** 窗口变小 -- 验证折叠态可点击、展开恢复正确位置、折叠态显示项目名+图标
- [ ] **开机启动:** 注册表写入成功 -- 验证重启后仍生效、UI 开关与实际状态同步、注册丢失自修复
- [ ] **配置导入:** JSON 解析成功 -- 验证安全审查、损坏文件的处理、版本兼容性（未来配置格式变更）
- [ ] **配置切换:** 切换后 UI 更新 -- 验证快速连续切换不损坏数据、切换后快捷键重新注册、悬浮窗状态同步
- [ ] **配置导出:** 生成 JSON 文件 -- 验证包含所有配置数据、导入导出往返一致、不包含敏感信息警告

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 命令注入已发生 | HIGH | 立即检查系统完整性，审计执行历史，修补漏洞（临时文件方案） |
| 编码乱码 | LOW | 在 .bat 文件开头添加 `chcp 65001 >nul`，重新执行 |
| GitHub API rate limit | LOW | 等待 1 小时重置，或添加缓存避免后续触发 |
| autostart 注册丢失 | LOW | 启动时自修复：检测 UI 设置 vs 实际注册状态，不一致则重新注册 |
| 配置切换数据损坏 | MEDIUM | 从最近一次完整的 store 备份恢复（如果有）；否则手动重建配置 |
| 悬浮窗折叠后消失 | LOW | 从托盘菜单重新创建悬浮窗（destroy + recreate） |
| 快捷键冲突 | LOW | 注销后重新注册，或用户更换快捷键组合 |
| 导入恶意配置 | HIGH | 审计已导入的命令内容，删除危险命令，检查系统是否已被篡改 |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 命令注入（多行脚本） | 多行脚本 Phase | 安全测试：输入包含引号、换行符、`&` 的脚本，验证不会执行额外命令 |
| 编码问题（多行脚本） | 多行脚本 Phase | 集成测试：中文路径项目 + 中文注释脚本执行成功 |
| GitHub API rate limit | 版本管理 Phase | 模拟测试：连续调用 10 次 checkForUpdates，只有 1 次实际 API 请求 |
| autostart 注册丢失 | 开机启动 Phase | 手动测试：开启 autostart -> 重启 -> 验证自动启动 -> 删除注册表项 -> 重启应用 -> 验证自修复 |
| 配置导入安全审查 | 多配置文件 Phase | 测试：导入包含 `curl \| sh` 的配置，验证被标记为危险 |
| 配置切换竞态 | 多配置文件 Phase | 压力测试：快速连续切换 20 次，验证所有配置数据完整 |
| 悬浮窗折叠尺寸 | 悬浮窗改进 Phase | 手动测试：Windows 10 + 11、150%/200% DPI、折叠/展开各 10 次 |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| 多行脚本执行 | 命令注入 | 临时 .bat 文件方案，不拼接命令行 | CRITICAL |
| 多行脚本编码 | 中文乱码 | `chcp 65001 >nul` 前缀 + UTF-8 写入 | CRITICAL |
| 多行脚本临时文件 | 文件积累 | 执行后删除或应用退出时批量清理 | MODERATE |
| GitHub API 版本检查 | Rate limit 耗尽 | 24h 本地缓存 + 失败静默 | HIGH |
| SemVer 比较 | pre-release 排序错误 | 使用成熟的 semver 库（如 `semver` crate 或 JS `semver` 包） | MODERATE |
| 快捷键面板 | 冲突检测不完整 | 检测范围包含所有配置文件的所有指令 | HIGH |
| 快捷键面板 | 键盘布局差异 | 显示物理键位而非逻辑键位，使用 `CommandOrControl` | MODERATE |
| 悬浮窗折叠 | 极小窗口被 DWM 隐藏 | 最小高度 >= 48px，或用 CSS 折叠 | HIGH |
| 悬浮窗折叠 | 多显示器位置跳变 | 记录折叠前位置，展开恢复 | MODERATE |
| 开机启动 | 注册表项丢失 | 启动时验证 + 自修复 | HIGH |
| 开机启动 | UAC 提示 | 使用 HKCU（不需管理员权限），确认 manifest 不请求提升 | MODERATE |
| 配置切换 | 竞态条件 | Promise-chain mutex 序列化 | CRITICAL |
| 配置导入 | 恶意脚本注入 | 危险模式扫描 + 确认对话框 | CRITICAL |
| 配置导出 | 敏感信息泄露 | 导出警告 + 可选排除敏感字段 | MODERATE |
| 数据迁移 | v1.x 配置格式不兼容 | 版本号标记 + 向后兼容的迁移函数 | HIGH |

## Sources

### v2.0 新增 Sources

- [Bishop Fox: Beyond Electron - Attacking Alternative Desktop Application Frameworks](https://bishopfox.com/blog/beyond-electron-attacking-alternative-desktop-application-frameworks) -- Tauri XSS -> Shell -> RCE 攻击路径 -- HIGH confidence
- [Radically Open Security: Tauri Security Audit](https://fossies.org/linux/tauri/audits/Radically_Open_Security-v1-report.pdf) -- 官方安全审计，shell 命令执行风险 -- HIGH confidence
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) -- 无认证 60 次/小时 -- HIGH confidence
- [Semantic Versioning 2.0.0](https://semver.org/) -- pre-release/build metadata 排序规则 -- HIGH confidence
- [Semantic Versioning: 10 Edge Cases](https://blog.abhimanyu-saharan.com/posts/semantic-versioning-10-edge-cases-you-can-t-afford-to-miss) -- 实际边界情况 -- MEDIUM confidence
- [tauri-plugin-autostart Issue #771: Registry entry removed after one boot](https://github.com/tauri-apps/plugins-workspace/issues/771) -- Windows 开机启动已知 bug -- HIGH confidence
- [Tauri v2 Autostart Plugin Docs](https://v2.tauri.app/plugin/autostart/) -- 官方文档 -- HIGH confidence
- [Tauri v2 Multi-Window Capabilities](https://v2.tauri.app/learn/security/capabilities-for-windows-and-platforms/) -- 多窗口权限配置 -- HIGH confidence
- [Tauri Issue #13070: Click-through transparent windows](https://github.com/tauri-apps/tauri/issues/13070) -- 点击穿透已知限制 -- HIGH confidence
- [Tauri Issue #8308: transparent not work in v2](https://github.com/tauri-apps/tauri/issues/8308) -- v2 透明窗口回退 -- HIGH confidence
- [StackOverflow: HKCU Run startup without UAC](https://stackoverflow.com/questions/17908789/how-to-add-an-item-to-registry-to-run-at-startup-without-uac) -- 注册表启动 + UAC 问题 -- HIGH confidence
- [WindowsForum: 4 Startup Methods Comparison](https://windowsforum.com/threads/how-to-run-apps-at-windows-11-startup-4-reliable-methods.389680/) -- 启动方法对比 -- MEDIUM confidence
- [cmd.exe CHCP 65001 for UTF-8](https://stackoverflow.com/questions/57131654/using-utf-8-encoding-chcp-65001-in-command-prompt-windows-powershell-window) -- cmd.exe UTF-8 编码方案 -- HIGH confidence
- [CmdHijack: cmd.exe argument confusion](https://hackingiscool.pl/cmdhijack-command-argument-confusion-with-path-traversal-in-cmd-exe/) -- cmd.exe 参数注入攻击 -- HIGH confidence
- [Tauri v2 Global Shortcuts: Silent failures on conflict](https://dev.to/hiyoyok/global-keyboard-shortcuts-in-tauri-v2-the-right-way-and-the-wrong-way-2h6d) -- 快捷键冲突静默失败 -- MEDIUM confidence
- [Tauri Issue #7156: Global shortcuts and keyboard layouts](https://github.com/tauri-apps/tauri/issues/7156) -- 键盘布局差异 -- HIGH confidence

### v1.2 继承 Sources

- [Tauri v2 Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/) -- HIGH confidence
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- HIGH confidence
- [Tauri v2 WebviewWindow API](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/) -- HIGH confidence
- [Windows RegisterHotKey API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey) -- HIGH confidence

---

*Pitfalls research for: EasyPack v2.0 -- 多行脚本、版本管理、快捷键面板、悬浮窗改进、开机启动、多配置文件管理*
*Researched: 2026-05-13*
