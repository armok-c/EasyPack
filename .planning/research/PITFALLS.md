# Domain Pitfalls: EasyPack v1.1

**Domain:** Tauri 2.x + React 19 Windows 桌面应用 -- 在已有 MVP 基础上增加新功能
**Researched:** 2026-04-15
**Overall confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or user-facing breakage.

---

### Pitfall 1: Windows cmd.exe 路径引号与参数转义导致 0x80070002

**What goes wrong:**
当前 `shell.rs` 使用 `StdCommand::new("cmd").args(["/C", "start", "cmd", "/K", &full_command])` 传递命令。`full_command` 是一个拼接字符串如 `cd /d "D:\Projects\app" && npm run build`。Rust 的 `std::process::Command` 在 Windows 上会对 `.args()` 传入的每个参数自动执行 MSVCRT 转义（添加反斜杠和引号），导致：

1. 已被双引号包裹的路径被二次转义，变成 `\"D:\Projects\app\"` -- Windows 报 `0x80070002`（ERROR_FILE_NOT_FOUND）
2. 包含 `&`、`|`、`>` 的 shell_command 被 Rust 转义后失去 cmd.exe 的特殊语义（`&&` 变成普通字符）
3. 中文路径在多层转义后变成乱码

这是 Rust 的已知长期问题（rust-lang/rust#29494，2015 年至今仍 open）。

**Why it happens:**
`std::process::Command::args()` 在 Windows 上会按 MSVCRT 规则为每个参数添加引号和反斜杠转义。但 `cmd /C` 和 `cmd /K` 不使用 MSVCRT 解析规则 -- 它们使用 cmd.exe 自己的解析器。两套规则的冲突导致双重转义。

**Consequences:**
- 所有项目点击指令卡片均无法执行（0x80070002）
- 路径含空格或中文的项目执行失败
- `&&` 连接的多条命令只执行第一条

**Prevention:**
使用 `raw_arg()` 方法（Rust 1.62+ 稳定），绕过 Rust 的自动转义，将命令作为原始字符串传递给 cmd.exe：

```rust
use std::os::windows::process::CommandExt;
use std::process::Command as StdCommand;

// 正确方案：raw_arg() 绕过 MSVCRT 转义
fn execute_in_terminal(project_path: &str, shell_command: &str) -> Result<(), String> {
    let full_command = format!("cd /d \"{}\" && {}", project_path, shell_command);

    // Windows Terminal 优先
    let wt_result = StdCommand::new("wt")
        .raw_arg("new-tab")
        .raw_arg("cmd")
        .raw_arg("/K")
        .raw_arg(&full_command)
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // 回退 cmd.exe
    StdCommand::new("cmd")
        .raw_arg("/C")
        .raw_arg("start")
        .raw_arg("cmd")
        .raw_arg("/K")
        .raw_arg(&full_command)
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    Ok(())
}
```

关键点：
- `raw_arg()` 只在 Windows 上生效，Unix 上等价于 `.arg()`
- 将整个 `cd /d "path" && command` 作为一个 `raw_arg` 传入 `cmd /K`，让 cmd.exe 自行解析
- 不要将 `cd /d` 和 `&& command` 分成多个 `.args()` -- 每个都会被独立转义

**Detection:**
- 运行时错误包含 `0x80070002` 或 `ERROR_FILE_NOT_FOUND`
- 项目路径含空格时命令执行失败
- `shell_command` 中含 `&` 或 `|` 时行为异常

**Phase to address:** Phase 1（v1.1 第一个功能 -- 修复核心命令执行错误）

**Sources:**
- [rust-lang/rust#29494 -- Command does not escape arguments as expected on Windows](https://github.com/rust-lang/rust/issues/29494) -- HIGH confidence
- [Stack Overflow: cmd /C doesn't work in Rust when command includes spaces](https://stackoverflow.com/questions/44757893/cmd-c-doesnt-work-in-rust-when-command-includes-spaces) -- HIGH confidence
- [Microsoft Learn: cmd command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd) -- HIGH confidence
- [SS64: CMD escape characters](https://ss64.com/nt/syntax-esc.html) -- HIGH confidence

---

### Pitfall 2: Frameless Window 丢失窗口阴影和可调整大小的边框

**What goes wrong:**
设置 `decorations: false` 后，Windows 会同时移除：
1. 标题栏（预期行为）
2. 窗口阴影（导致窗口看起来像浮在桌面上的白色方块）
3. 可拖拽调整大小的边框区域（用户无法从窗口边缘拖拽改变大小）
4. Windows 11 的圆角

这不是 Tauri 的 bug，而是 Windows 的原生行为 -- 窗口装饰（decorations）包含了阴影、圆角和调整大小的边框区域。移除装饰就移除了所有这些。

**Why it happens:**
开发者看到 `decorations: false` 的文档示例，以为只移除标题栏，不知道 Windows 的窗口装饰是一个不可分割的整体。很多人在实现无边框窗口后才发现在 Windows 上无法调整窗口大小。

**Consequences:**
- 用户无法通过拖拽窗口边缘来调整大小（严重影响 UX）
- 窗口没有阴影，在深色桌面上看不清边界
- Windows 11 上窗口变成直角，与系统风格不协调
- 双击标题栏区域不会最大化/还原窗口

**Prevention:**

方案 A（推荐）：Tauri 2 的 `shadow` 选项 + 自定义 resize 边框

```json
// tauri.conf.json
{
  "app": {
    "windows": [{
      "decorations": false,
      "shadow": true
    }]
  }
}
```

Tauri 2 在 Windows 上支持 `shadow: true` 配合 `decorations: false`，会重新添加系统阴影。但要注意 Issue #8632 报告了在某些 Windows 版本上阴影+透明窗口冲突的问题。

对于 resize，Tauri 2 改进了 `data-tauri-drag-region` 的行为（拖拽时仍然可以从顶部边缘 resize），但对于左右和底部边缘，需要使用 CSS 实现不可见的 resize 区域：

```tsx
// 在窗口四周添加不可见的 resize 边框
<div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
  {/* 四个边 */}
  <div className="absolute top-0 left-0 right-0 h-1 pointer-events-auto cursor-n-resize"
       onMouseDown={handleResize("n")} />
  <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-auto cursor-s-resize"
       onMouseDown={handleResize("s")} />
  <div className="absolute left-0 top-0 bottom-0 w-1 pointer-events-auto cursor-w-resize"
       onMouseDown={handleResize("w")} />
  <div className="absolute right-0 top-0 bottom-0 w-1 pointer-events-auto cursor-e-resize"
       onMouseDown={handleResize("e")} />
  {/* 四个角 */}
  <div className="absolute top-0 left-0 w-3 h-3 pointer-events-auto cursor-nw-resize"
       onMouseDown={handleResize("nw")} />
  {/* ... 其他三个角 */}
</div>
```

但 Tauri 2 已经在 Windows 上提供了原生的 resize 支持（即使 decorations: false），只要你没有用 `data-tauri-drag-region` 完全覆盖窗口边缘。所以实际可能不需要手动实现 CSS resize 边框 -- 需要实际测试确认。

方案 B（更简单）：Tauri 2 的 `titleBarStyle: "Overlay"` 模式

这是 Tauri 2 新增的选项，保留原生窗口装饰但让标题栏透明，可以在上面放置自定义内容。但由于本项目仅 Windows 平台，且需要完全自定义标题栏外观，方案 A 更合适。

关键测试矩阵：

| 场景 | 需验证 |
|------|--------|
| decorations: false + shadow: true | 阴影是否正常渲染 |
| 从窗口四边拖拽 | 是否能正常 resize |
| 从窗口四角拖拽 | 是否能正常 resize |
| 最大化/还原 | 双击拖拽区域是否切换 |
| 最小化后再恢复 | 窗口是否保持正确大小 |
| Windows 10 vs Windows 11 | 圆角/阴影行为差异 |
| 窗口未聚焦时拖拽 | Issue #11605 报告的已知 bug |

**Detection:**
- 设置 `decorations: false` 后窗口无法从边缘拖拽调整大小
- 窗口没有阴影，和桌面背景融为一体
- 用户反馈"窗口看起来很奇怪"

**Phase to address:** Phase 2（无边框窗口 + 自定义标题栏）

**Sources:**
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- HIGH confidence
- [Issue #8632: Transparent window with shadow only works when resized](https://github.com/tauri-apps/tauri/issues/8632) -- HIGH confidence
- [Issue #2549: Resizing glitch on custom titlebar click](https://github.com/tauri-apps/tauri/issues/2549) -- MEDIUM confidence
- [Issue #11605: Can't drag unfocused window with data-tauri-drag-region](https://github.com/tauri-apps/tauri/issues/11605) -- HIGH confidence
- [Issue #7900: Feature request for data-tauri-drag-resize-region](https://github.com/tauri-apps/tauri/issues/7900) -- MEDIUM confidence

---

### Pitfall 3: 文件夹大小计算在大型目录上阻塞 UI

**What goes wrong:**
为项目显示文件夹大小需要递归遍历整个目录树。`node_modules` 目录通常包含 20,000-80,000 个文件，deep tree 结构。如果使用同步方式或在 Tauri 主线程上计算，会导致：
1. UI 冻结 2-10 秒（取决于磁盘速度和文件数量）
2. 如果同时计算多个项目，问题成倍放大
3. Windows 上文件系统 I/O 本身就比 Linux 慢（NTFS 的元数据操作开销大）

**Why it happens:**
开发者通常先用简单的递归实现来计算文件夹大小，测试时用小目录一切正常。但 `node_modules`、`.git`、`target`（Rust）、`venv`（Python）等目录的文件数量是数量级级别的增长。

**Consequences:**
- 打开应用时所有项目同时计算大小，UI 卡死数秒
- 用户以为应用崩溃了
- 如果计算逻辑运行在 Tauri 主线程上，连窗口拖拽都无法响应

**Prevention:**

1. **必须在独立线程上计算** -- 使用 `tokio::task::spawn_blocking` 或 `std::thread::spawn`，绝不能在 async Tauri 命令中直接做文件系统遍历（async executor 线程也被阻塞）

```rust
#[tauri::command]
async fn get_folder_size(path: String) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        calculate_folder_size(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn calculate_folder_size(path: &str) -> Result<u64, String> {
    // 使用 walkdir crate 进行高效遍历
    use walkdir::WalkDir;
    let total: u64 = WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum();
    Ok(total)
}
```

2. **跳过已知的大型目录** -- 排除 `node_modules`、`.git`、`target`、`__pycache__`、`.venv`、`dist`、`.cache` 等目录。这可以将计算时间从 10 秒降到 0.5 秒以内

3. **懒加载而非全量计算** -- 只在用户选中项目时计算该项目的文件夹大小，不要启动时计算所有项目

4. **缓存结果** -- 计算结果缓存一段时间（如 5 分钟），避免频繁重复计算。监听文件系统变化刷新缓存是可选的优化

5. **使用 `jwalk` 或 `walkdir + rayon` 进行并行遍历** -- 对于特别大的目录，并行遍历可以提速 2-4 倍

**Detection:**
- 项目数 > 5 时应用启动变慢
- 选中某个大型项目时 UI 冻结
- DevTools 的 Performance 面板显示 Long Task

**Phase to address:** Phase 4（文件夹大小 + Git 分支显示）

**Sources:**
- [walkdir crate](https://crates.io/crates/walkdir) -- HIGH confidence
- [jwalk crate -- parallel directory walk](https://crates.io/crates/jwalk) -- HIGH confidence
- [rudu -- parallel directory size analysis](https://crates.io/crates/rudu) -- MEDIUM confidence
- [Tauri async command blocking -- GitHub Discussion #4191](https://github.com/orgs/tauri-apps/discussions/4191) -- HIGH confidence
- [Tauri + Rust Performance Under Pressure](https://medium.com/@srish5945/tauri-rust-speed-but-heres-where-it-breaks-under-pressure-fef3e8e2dcb3) -- MEDIUM confidence

---

### Pitfall 4: 自定义标题栏拖拽区域内的交互元素无法点击

**What goes wrong:**
在设置了 `data-tauri-drag-region` 属性的元素内部，所有子元素（按钮、输入框、链接等）的鼠标事件会被拖拽行为拦截。用户无法点击标题栏区域的最小化/最大化/关闭按钮。

**Why it happens:**
`data-tauri-drag-region` 的实现是在鼠标按下时启动窗口拖拽。这个行为在父元素上注册，子元素的点击事件被拖拽行为覆盖。这是 Tauri 的已知行为。

**Consequences:**
- 窗口控制按钮（最小化/最大化/关闭）无法点击
- 标题栏内的任何交互元素都不可用
- 用户只能通过 Alt+F4 或任务栏关闭窗口

**Prevention:**
1. 在标题栏上使用 `data-tauri-drag-region`，但在按钮元素上**不要**设置该属性 -- 子元素没有 `data-tauri-drag-region` 时，点击事件会正常传递
2. 确保按钮元素的 `pointer-events` 不是 `none`
3. 使用双击拖拽区域切换最大化/还原：

```tsx
function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleDoubleClick = async () => {
    await appWindow.toggleMaximize();
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="flex items-center h-8 select-none"
    >
      <span data-tauri-drag-region className="flex-1 px-3 text-sm">
        EasyPack
      </span>
      {/* 按钮不设置 data-tauri-drag-region */}
      <button onClick={() => appWindow.minimize()}>_</button>
      <button onClick={() => appWindow.toggleMaximize()}>[]</button>
      <button onClick={() => appWindow.close()}>X</button>
    </header>
  );
}
```

4. 验证：确保按钮的 `mousedown` 事件没有冒泡到拖拽区域。如果仍有问题，在按钮上显式调用 `e.stopPropagation()`

**Detection:**
- 标题栏按钮点击无反应
- 点击按钮时窗口移动了（说明拖拽拦截了点击）
- 按钮在标题栏外单独放置时可以正常点击

**Phase to address:** Phase 2（无边框窗口 + 自定义标题栏）

**Sources:**
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- HIGH confidence
- [Issue #2017: webkit-app-region:drag for Tauri](https://github.com/tauri-apps/tauri/issues/2017) -- HIGH confidence

---

### Pitfall 5: Git 分支检测在非 Git 目录上失败或性能低下

**What goes wrong:**
为项目显示 Git 分支名需要检测目录是否是 Git 仓库并获取当前分支。常见错误：

1. 在非 Git 目录上调用 `git rev-parse --abbrev-ref HEAD`，命令失败但没有优雅处理 -- 显示错误信息或空白
2. 每次选中项目都执行 `git` 子进程，进程创建开销在 Windows 上约 50-100ms
3. 使用 `libgit2`（`git2` crate）但忘记处理 ".git 不存在" 的情况，导致 panic
4. 在 detached HEAD 状态下 `head.shorthand()` 返回 `None`，显示空白

**Why it happens:**
开发者通常只考虑了正常的 Git 仓库场景，忽略了：
- 用户添加的项目可能不是 Git 仓库（个人工具项目、空目录等）
- Git worktree、submodule、bare repo 等特殊情况
- Windows 上进程创建开销比 Linux 大 10 倍

**Consequences:**
- 非 Git 项目显示错误信息或空白，用户困惑
- 频繁的 `git` 子进程调用导致性能问题
- detached HEAD 状态显示异常

**Prevention:**

推荐方案（轻量级）：直接读取 `.git/HEAD` 文件

```rust
fn get_git_branch(path: &str) -> Option<String> {
    let git_head = std::path::Path::new(path).join(".git").join("HEAD");
    let content = std::fs::read_to_string(&git_head).ok()?;
    // content 示例: "ref: refs/heads/main\n" 或 "a1b2c3d4...\n" (detached HEAD)
    if let Some(ref_path) = content.strip_prefix("ref: refs/heads/") {
        Some(ref_path.trim().to_string())
    } else {
        // detached HEAD -- 显示短 hash
        Some(content.trim().chars().take(7).collect())
    }
}
```

优势：
- 零进程创建开销（纯文件读取）
- 非 Git 目录返回 `None`，优雅降级（不显示 Git 分支）
- 7 个字符的短 hash 足够辨识 detached HEAD

不推荐 `git2` crate 的原因：引入 C 依赖（libgit2），构建复杂度增加，对于只需读取分支名的场景过重。

不推荐 `git rev-parse` 的原因：Windows 上每次进程创建约 50-100ms，如果项目多且有缓存失效会累积。

缓存策略：
- 首次选中项目时读取并缓存
- 不需要监听文件变化（Git 分支切换不频繁）
- 如果需要实时更新，可以用 5 秒轮询或 focus 事件刷新

**Detection:**
- 非 Git 项目显示 "Error" 或空白
- 切换项目时有明显的延迟（>100ms）
- detached HEAD 状态显示异常

**Phase to address:** Phase 4（文件夹大小 + Git 分支显示）

---

## Moderate Pitfalls

### Pitfall 6: 模态窗在小窗口尺寸下内容被截断

**What goes wrong:**
shadcn/ui 的 `Dialog` 组件默认使用固定宽度（如 `sm:max-w-[480px]`）。当 Tauri 窗口被缩小到接近最小宽度（当前 minWidth: 600px）时，模态窗可能超出窗口范围，导致部分内容不可见且无法滚动到。

**Why it happens:**
当前 `CommandDialog` 设置了 `sm:max-w-[480px]`，在小窗口下 480px 的模态窗加上两侧边距可能超出窗口宽度。更关键的是垂直方向 -- 如果模态窗内容（表单 + 图标选择器 + 预览 + 按钮）高度超过窗口高度，底部按钮会被截断。

**Prevention:**
1. 使用 `max-w-[calc(100vw-2rem)]` 替代固定宽度，确保模态窗永远不超出窗口
2. 对模态窗内容区域设置 `max-h-[calc(100vh-8rem)] overflow-y-auto`，使内容可滚动
3. 设置 DialogContent 的 `min-width` 和 `min-height`，在窗口过小时显示滚动条
4. 使用 `@media (max-height: 500px)` 处理极端矮窗口的情况

```tsx
<DialogContent className="sm:max-w-[480px] max-w-[calc(100vw-2rem)]
  max-h-[calc(100vh-4rem)] flex flex-col">
  <DialogHeader>...</DialogHeader>
  <div className="flex-1 overflow-y-auto py-4 space-y-4">
    {/* 表单内容 */}
  </div>
  <DialogFooter className="flex-shrink-0">...</DialogFooter>
</DialogContent>
```

**Detection:**
- 将窗口缩小到 minWidth x minHeight，打开指令编辑弹窗
- 底部按钮被截断或不可见
- 图标选择器超出窗口范围

**Phase to address:** Phase 3（模态窗自适应大小）

---

### Pitfall 7: 项目图标自动识别读取不存在的文件导致报错

**What goes wrong:**
自动识别项目图标需要扫描项目目录中的特定文件（`package.json` 的 icon 字段、`favicon.ico`、`public/icon.png`、`app-icon.png` 等）。常见错误：
1. 扫描不存在的文件，每次都触发文件系统错误
2. 读取 `package.json` 解析 icon 路径后，该路径指向的文件不存在
3. 图标文件格式不支持（SVG 在 WebView2 中需要特殊处理）
4. 并行扫描多个位置但错误处理不一致

**Why it happens:**
项目类型多样（Node.js、Rust、Python、Go...），没有统一的图标位置约定。开发者倾向于先列出所有可能的位置然后逐一尝试，但没有对"文件不存在"做优雅降级。

**Prevention:**
1. 先检测项目类型（`package.json` 存在 -> Node.js 项目，`Cargo.toml` -> Rust 项目等），再按类型查找图标
2. 所有文件检测用 `std::fs::exists()` 或 `std::fs::metadata()` -- 不要用 `std::fs::read()` 然后检查错误
3. 图标查找顺序应有优先级，找到第一个就停止
4. 对 SVG 图标做格式验证，不支持时跳过
5. 查找结果缓存，不要每次渲染都扫描文件系统

```rust
fn detect_project_icon(project_path: &str) -> Option<String> {
    let path = Path::new(project_path);

    // Node.js 项目
    if path.join("package.json").exists() {
        // 优先查找 public/icon.png, then public/favicon.ico
        for candidate in &["public/icon.png", "public/favicon.ico", "favicon.ico"] {
            let full = path.join(candidate);
            if full.exists() {
                return Some(full.to_string_lossy().to_string());
            }
        }
    }

    // Rust / Tauri 项目
    if path.join("src-tauri").exists() {
        for candidate in &["src-tauri/icons/icon.png", "src-tauri/icons/128x128.png"] {
            let full = path.join(candidate);
            if full.exists() {
                return Some(full.to_string_lossy().to_string());
            }
        }
    }

    None // 没找到图标，使用默认
}
```

**Detection:**
- 控制台频繁出现 "file not found" 错误
- 非标准项目结构的图标检测卡顿
- SVG 图标显示为空白或报错

**Phase to address:** Phase 3（项目图标自动识别）

---

### Pitfall 8: 预设指令系统命令格式不准确

**What goes wrong:**
v1.1 的预设指令系统将改为双下拉框选择（python/pip/git/rust/npm），用户选择工具后自动填充命令。如果预设命令不准确，用户会直接执行错误命令：

1. `npm run build` 在没有 `build` script 的项目上报错
2. `pip install -r requirements.txt` 在非 Python 项目上执行
3. `cargo build --release` 在非 Rust 项目上执行
4. `python main.py` 但实际入口是 `app.py` 或 `manage.py`
5. `npm run dev` 但实际 script 名是 `start` 或 `serve`

**Why it happens:**
不同项目的 script 名称不统一。即使都是 Node.js 项目，有的用 `npm run build`，有的用 `npm run prod`，有的用 `npm run compile`。预设系统无法猜中所有变体。

**Consequences:**
- 用户信任预设命令，执行后报错，降低信任度
- 预设变成"还要手动改"的鸡肋功能

**Prevention:**
1. **先检测后推荐** -- 读取 `package.json` 的 `scripts` 字段，只推荐实际存在的 script：
   ```rust
   // 读取 package.json，检查 scripts 字段
   fn get_npm_scripts(project_path: &str) -> Vec<(String, String)> {
       let pkg_path = Path::new(project_path).join("package.json");
       // 解析 JSON，提取 scripts 对象的 key
       // 返回 [("build", "npm run build"), ("dev", "npm run dev"), ...]
   }
   ```

2. **提供合理的默认值，但允许用户修改** -- 预设只是模板，用户可以编辑命令字符串

3. **显示命令预览** -- 在下拉框选择后显示完整的命令字符串，让用户确认

4. **不存在的命令灰显** -- 如果 `npm run build` 的 `build` script 不存在，灰显并提示 "该项目无 build script"

5. **不要硬编码命令列表** -- 预设应该是动态的，基于项目类型和配置文件内容生成

**Detection:**
- 用户选择预设后执行报错
- 预设命令与项目实际 script 不匹配
- 用户反馈"预设没用，每次都要手动改"

**Phase to address:** Phase 5（预设指令系统）

---

### Pitfall 9: "打开文件夹" 功能在不同 Windows 版本上行为不一致

**What goes wrong:**
添加"打开文件夹"按钮需要在系统文件管理器中打开项目目录。常见的实现问题：

1. 使用 `explorer.exe <path>` 但路径含空格时被截断
2. 使用 `shell.open(path)` 但在 Windows Server 上没有默认文件管理器
3. 路径中的 `/` 和 `\` 混用导致打开失败

**Why it happens:**
`explorer.exe` 的命令行解析有自己的规则。如果路径含空格且未正确引用，explorer 会将空格后的部分当作参数。Windows 上使用正斜杠的路径在某些 API 中不被识别。

**Prevention:**
使用 Tauri 官方的 `tauri-plugin-opener` 插件（v2 专用），它封装了平台差异：

```rust
// Rust 端
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
async fn open_folder(path: String, app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .reveal_item_in_folder(&path)
        .map_err(|e| e.to_string())
}
```

如果不想加新依赖，在 Rust 端用 `std::process::Command` 调用 `explorer.exe`，但必须：
- 使用 `raw_arg()` 传递路径
- 确保路径使用反斜杠
- 路径含空格时用双引号包裹

```rust
StdCommand::new("explorer.exe")
    .raw_arg(&format!("\"{}\"", path))
    .spawn()
```

注意：`explorer.exe` 不使用 `cmd /C`，直接传入路径即可。但 `raw_arg` 仍然重要，因为 Rust 的 `.args()` 会给路径加额外的引号。

**Detection:**
- 含空格的路径打开失败或打开了错误的目录
- 在 Windows Server 上报错
- 路径含中文时打开乱码目录

**Phase to address:** Phase 3（指令切换按钮化 + 打开文件夹按钮）

**Sources:**
- [tauri-plugin-opener 官方文档](https://v2.tauri.app/plugin/opener/) -- HIGH confidence

---

## Minor Pitfalls

### Pitfall 10: 指令切换按钮样式与现有卡片风格不一致

**What goes wrong:**
将全局/项目指令切换从文字链接改为按钮样式时，新按钮的视觉风格可能与现有的圆角卡片设计不协调。常见问题：按钮大小、圆角半径、间距、hover 效果与 CommandCard 不一致。

**Prevention:**
- 提取 CommandCard 的样式常量（圆角 `rounded-xl`、间距 `gap-3`、hover `hover:bg-white/10`）为共享的 Tailwind 类
- 切换按钮使用 shadcn/ui 的 Button 组件，设置一致的 variant 和 size
- 设计稿中同时预览切换按钮和指令卡片，确保视觉协调

**Phase to address:** Phase 3（指令切换按钮化）

---

### Pitfall 11: 图标自动检测和文件夹大小计算在同一个选中动作中串行执行

**What goes wrong:**
选中项目时同时触发图标检测和文件夹大小计算，如果两者串行执行，延迟叠加。图标检测（读 package.json + 文件存在性检查）约 10-50ms，文件夹大小计算可能 100-2000ms，Git 分支读取约 1-5ms。串行总计可能让用户感觉"选中项目后卡了一下"。

**Prevention:**
- 图标检测和 Git 分支读取是快速操作，可以串行（总计 < 100ms）
- 文件夹大小计算必须异步、懒加载，不阻塞其他信息显示
- 先显示项目名和路径（即时），再显示 Git 分支（快速），最后显示文件夹大小（异步）
- 每个信息独立渲染、独立加载状态

```tsx
// 伪代码：分层加载
<div>
  <h2>{project.name}</h2>          {/* 即时 */}
  <p>{project.path}</p>             {/* 即时 */}
  <GitBranch path={project.path} /> {/* ~5ms */}
  <FolderSize path={project.path} />{/* 异步，显示 loading spinner */}
</div>
```

**Phase to address:** Phase 4（文件夹大小 + Git 分支显示）

---

### Pitfall 12: 预设指令删除后 ID 体系混乱

**What goes wrong:**
当前预设指令使用 `preset-{idx}` 作为 ID。v1.1 将默认指令从 4 个减少到 2 个（git pull + claude），其余改为下拉框选择。如果用户已有基于 `preset-0`、`preset-1`、`preset-2`、`preset-3` 的项目级覆盖数据，ID 映射会错乱（`preset-0` 从 "打包项目" 变成了 "git pull"）。

**Prevention:**
1. 使用语义化 ID 而非索引 ID：`preset-git-pull`、`preset-claude`，避免删除导致 ID 偏移
2. 数据迁移逻辑：首次启动时检测旧格式数据，映射到新 ID
3. 新增的预设使用 `preset-npm-build`、`preset-npm-dev`、`preset-cargo-build` 等命名 ID

**Phase to address:** Phase 5（预设指令系统）-- 需要在设计阶段就定义好 ID 策略

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| 修复命令执行（0x80070002） | Rust `.args()` 自动转义与 cmd.exe 冲突 | 使用 `raw_arg()` | CRITICAL |
| 无边框窗口 | 移除 decorations 后丢失 resize 能力和阴影 | `shadow: true` + 测试 resize 行为 | CRITICAL |
| 无边框窗口 | 标题栏按钮被拖拽区域拦截 | 按钮不设 `data-tauri-drag-region` | CRITICAL |
| 无边框窗口 | 双击标题栏不切换最大化 | 显式处理 `onDoubleClick` | MODERATE |
| 自定义标题栏 | Windows 10 vs 11 阴影/圆角行为不同 | 两个系统版本都测试 | MODERATE |
| 项目图标自动识别 | SVG 格式图标显示异常 | 偏好 PNG/ICO，SVG 做降级处理 | MODERATE |
| 项目图标自动识别 | 每次渲染都扫描文件系统 | 检测结果缓存到项目数据 | MODERATE |
| 模态窗自适应 | 小窗口下内容截断不可滚动 | `max-h` + `overflow-y-auto` | MODERATE |
| 打开文件夹 | 路径含空格/中文打开失败 | 使用 `raw_arg()` 或 tauri-plugin-opener | MODERATE |
| 文件夹大小计算 | node_modules 遍历阻塞 UI | `spawn_blocking` + 排除目录 | CRITICAL |
| Git 分支显示 | 非 Git 目录报错 | 优雅降级，返回 None 不显示 | MODERATE |
| 预设指令系统 | 命令与项目实际 scripts 不匹配 | 检测 package.json 动态生成 | MODERATE |
| 预设指令系统 | 旧 ID 格式迁移错乱 | 语义化 ID + 迁移逻辑 | MODERATE |

---

## Cross-Cutting Integration Pitfalls

These pitfalls arise from the interaction of multiple new features:

### Integration 1: 无边框窗口 + 模态窗

设置 `decorations: false` 后，shadcn/ui 的 `Dialog` 组件（基于 Radix UI）依赖 `position: fixed` 来居中弹窗。如果 `<html>` 或 `<body>` 上有 `transform`、`perspective` 或 `filter` 属性（可能因为 backdrop-blur 效果），`fixed` 定位会相对于该元素而非视口，导致弹窗位置偏移。

**Prevention:** 确保 `body` 上没有 `transform`/`filter` 属性。如果 `backdrop-blur` 导致问题，将 blur 效果放在子元素而非 body 上。

### Integration 2: 文件夹大小 + 预设指令

如果预设指令系统先检测项目类型（读 `package.json` / `Cargo.toml`），而文件夹大小也在扫描这些文件，两者可以复用检测结果：已知是 Node.js 项目就排除 `node_modules`，已知是 Rust 项目就排除 `target`。

### Integration 3: 无边框窗口 + 键盘导航

当前键盘导航（Tab 切换 sidebar/main zone）需要确保自定义标题栏按钮不在 Tab 序列中干扰现有导航流。标题栏按钮应该使用 `tabIndex={-1}` 或独立的 focus trap。

---

## v1.0 遗留 Pitfalls（仍适用）

以下 pitfall 来自 v1.0 研究文档，在 v1.1 开发中仍然适用：

### Existing 1: Capabilities 权限配置遗漏

添加新功能（opener 插件、可能的 fs 插件）需要在 capabilities 中声明对应权限。每次添加新 Tauri 插件时必须同步更新 `src-tauri/capabilities/default.json`。

### Existing 2: Rust async 命令使用 owned 类型

所有新增的 Tauri 命令（`get_folder_size`、`get_git_branch`、`open_folder`、`detect_icon`）必须使用 `String` 而非 `&str` 作为参数类型。

### Existing 3: generate_handler! 宏遗漏注册

新增的 Rust 命令必须注册到 `lib.rs` 的 `generate_handler!` 宏中。

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 命令执行 raw_arg 修复 | LOW | 替换 `.args()` 为 `.raw_arg()`，重跑测试 |
| 无边框窗口 resize 丢失 | MEDIUM | 调整 shadow 配置 + 添加 CSS resize 边框（如需要） |
| 标题栏按钮被拖拽拦截 | LOW | 确认按钮元素无 `data-tauri-drag-region`，添加 `stopPropagation` |
| 文件夹大小阻塞 UI | MEDIUM | 将同步代码改为 `spawn_blocking` + 添加排除目录列表 |
| Git 分支非 Git 目录报错 | LOW | `Option<String>` 返回值 + UI 条件渲染 |
| 预设 ID 迁移错乱 | MEDIUM | 数据迁移逻辑 + 新 ID 体系 |
| 模态窗截断 | LOW | CSS max-height + overflow 调整 |

---

## Sources

### v1.1 新增 Sources

- [rust-lang/rust#29494 -- Command argument escaping on Windows](https://github.com/rust-lang/rust/issues/29494) -- HIGH confidence
- [Stack Overflow: cmd /C with spaces in Rust](https://stackoverflow.com/questions/44757893/cmd-c-doesnt-work-in-rust-when-command-includes-spaces) -- HIGH confidence
- [Microsoft Learn: cmd.exe reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd) -- HIGH confidence
- [SS64: CMD escape characters](https://ss64.com/nt/syntax-esc.html) -- HIGH confidence
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- HIGH confidence
- [Issue #8632: Transparent + shadow rendering bug](https://github.com/tauri-apps/tauri/issues/8632) -- HIGH confidence
- [Issue #11605: data-tauri-drag-region unfocused window bug](https://github.com/tauri-apps/tauri/issues/11605) -- HIGH confidence
- [Issue #7900: Feature request for drag-resize-region](https://github.com/tauri-apps/tauri/issues/7900) -- MEDIUM confidence
- [Issue #2549: Resize glitch on custom titlebar edge click](https://github.com/tauri-apps/tauri/issues/2549) -- MEDIUM confidence
- [Issue #2017: webkit-app-region drag support](https://github.com/tauri-apps/tauri/issues/2017) -- HIGH confidence
- [Issue #4733: Frameless removes rounded corners (expected behavior)](https://github.com/tauri-apps/tauri/issues/4733) -- HIGH confidence
- [Tauri async command blocking discussion #4191](https://github.com/orgs/tauri-apps/discussions/4191) -- HIGH confidence
- [walkdir crate](https://crates.io/crates/walkdir) -- HIGH confidence
- [jwalk crate -- parallel directory traversal](https://crates.io/crates/jwalk) -- HIGH confidence
- [rudu -- parallel directory size analysis](https://crates.io/crates/rudu) -- MEDIUM confidence
- [tauri-plugin-opener 官方文档](https://v2.tauri.app/plugin/opener/) -- HIGH confidence
- [Stack Overflow: How to get current git branch](https://stackoverflow.com/questions/6245570/how-do-i-get-the-current-branch-name-in-git) -- HIGH confidence

### v1.0 继承 Sources

- [Tauri v2 Shell Plugin](https://v2.tauri.app/plugin/shell/) -- HIGH confidence
- [Tauri v2 Store Plugin](https://v2.tauri.app/plugin/store/) -- HIGH confidence
- [Tauri v2 Security](https://v2.tauri.app/security/) -- HIGH confidence
- [CVE-2025-31477: Shell Plugin RCE](https://github.com/tauri-apps/plugins-workspace/security/advisories/GHSA-c9pr-q8gx-3mgp) -- HIGH confidence

---

*Pitfalls research for: EasyPack v1.1 -- Adding features to existing Tauri 2 + React 19 desktop app*
*Researched: 2026-04-15*
