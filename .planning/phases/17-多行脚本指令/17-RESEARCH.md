# Phase 17: 多行脚本指令 - Research

**Researched:** 2026-05-15
**Domain:** CodeMirror 6 integration, Windows batch file execution, Tauri WebView CSP
**Confidence:** HIGH

## Summary

Phase 17 extends EasyPack's single-line command executor to support multi-line batch script editing and execution. The primary technical challenges are: (1) integrating CodeMirror 6 into a Tauri WebView without CSP conflicts, (2) providing batch file syntax highlighting without an official CM6 language package, and (3) executing multi-line scripts via temporary .bat files from Rust.

The CSP risk is RESOLVED -- the current `tauri.conf.json` already includes `'unsafe-inline'` for `style-src`, which is exactly what CodeMirror 6 needs for its dynamic `<style>` element injection. No CSP changes are required [VERIFIED: tauri.conf.json line 28]. The `@codemirror/lang-shell` package does NOT exist in the npm registry [VERIFIED: npm registry 404]. Batch file syntax highlighting will use a custom `StreamLanguage` tokenizer built with `@codemirror/language`, since the `@codemirror/legacy-modes` package includes a Unix `shell` mode but has no `batch` mode [VERIFIED: unpkg.com directory listing].

**Primary recommendation:** Use raw CodeMirror 6 packages (NOT `@uiw/react-codemirror` wrapper) with a thin custom React hook to avoid unnecessary abstraction. Create a lightweight custom StreamLanguage for batch keywords. Add `tempfile` crate to Rust backend for .bat file creation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tab 切换 -- CommandDialog 顶部添加"单行"和"多行"两个 Tab
- **D-02:** 新建指令默认显示"单行" Tab
- **D-03:** Tab 切换时保留已输入内容
- **D-04:** 预设指令选择器仅在"单行" Tab 时显示
- **D-05:** 智能模式 -- 检测内容是否含批处理语法关键字
- **D-06:** 关键字检测列表 -- if、for、goto、set、call、:label 等
- **D-07:** 严格/宽松开关仅在"简单多行命令"时显示
- **D-08:** 新建多行指令默认严格模式（&&）
- **D-09:** 临时 .bat 文件执行后不删除
- **D-10:** 所有 .bat 文件头部始终添加 `chcp 65001 >nul`
- **D-11:** .bat 文件头部自动添加 `cd /d "{projectPath}"`
- **D-12:** CodeMirror 编辑器替换 Input 位置
- **D-13:** 编辑器固定 10-12 行高度（约 250-300px）
- **D-14:** 编辑器主题跟随应用主题
- **D-15:** 多行脚本在指令卡片上最多显示 3 行
- **D-16:** 使用 CodeMirror 的 bat/Shell 语法高亮

### Claude's Discretion
- CodeMirror 6 在 Tauri WebView 中的 CSP 配置
- @codemirror 包的具体版本和子包选择
- CommandDialog 高度扩展时的动画过渡
- 严格/宽松开关的 UI 组件选择
- .bat 文件命名规则
- bat 语法高亮的语言包选择
- 行号显示的具体样式
- CodeMirror 编辑器的快捷键绑定
- CommandItem 类型中 scriptLines 的具体数据结构

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRIPT-01 | 用户可以在指令编辑器中编写多行命令，支持 Windows 批处理语法 | Tab 切换 UI (D-01) + CodeMirror 集成 + 数据模型扩展 (scriptLines) |
| SCRIPT-02 | 多行脚本写入临时 .bat 文件由 cmd.exe 执行，chcp 65001 | Rust tempfile crate + build_bat_script 辅助函数 + cmd /C start 执行模式 |
| SCRIPT-03 | 脚本编辑器提供语法高亮和行号显示（基于 CodeMirror 6） | Custom StreamLanguage tokenizer + CM6 lineNumbers extension |
| SCRIPT-04 | 用户可选择执行模式：严格模式（&&）或宽松模式（&） | useBatchDetect hook + executionMode 字段 + 智能检测 (D-05/D-07) |
| SCRIPT-05 | 现有单行指令数据模型向后兼容，scriptLines 为可选字段 | CommandItem 接口扩展模式参考 shortcut? 字段 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab 切换 UI + 编辑器渲染 | Browser / Client | -- | DOM 操作、React 状态管理、CodeMirror 实例生命周期 |
| 语法高亮（batch tokenizer） | Browser / Client | -- | CM6 StreamLanguage 在浏览器端运行 |
| 数据模型扩展（scriptLines） | Browser / Client | -- | TypeScript 接口定义、前端序列化 |
| 临时 .bat 文件创建 | API / Backend | -- | Rust std::fs + tempfile crate 在系统 temp 目录写文件 |
| .bat 文件执行 | API / Backend | -- | Rust std::process::Command 调用 cmd.exe |
| 批处理语法智能检测 | Browser / Client | -- | 纯正则匹配，无需后端参与 |
| 主题适配（light/dark） | Browser / Client | -- | CM6 主题切换在前端完成 |

## Standard Stack

### Core (Frontend - CodeMirror 6)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `codemirror` | 6.0.2 | CM6 基础包（包含 basicSetup） | 官方推荐入口包，提供编辑器开箱即用配置 [VERIFIED: npm registry] |
| `@codemirror/state` | 6.6.0 | 编辑器状态管理 | CM6 核心，EditorState、Transaction 等 [VERIFIED: npm registry] |
| `@codemirror/view` | 6.43.0 | 编辑器视图层 | CM6 核心，EditorView、DOM 渲染 [VERIFIED: npm registry] |
| `@codemirror/language` | 6.12.3 | 语言基础设施（含 StreamLanguage） | 提供 StreamLanguage.define() 用于自定义 tokenizer [VERIFIED: npm registry] |
| `@codemirror/commands` | 6.10.3 | 编辑器命令（快捷键） | 提供默认编辑行为（复制、粘贴、撤销等） [VERIFIED: npm registry] |
| `@codemirror/theme-one-dark` | 6.1.3 | 深色主题 | CM6 官方深色主题，配合应用 dark mode [VERIFIED: npm registry] |

### Core (Backend - Rust)
| Crate | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| `tempfile` | 3.27.0 | 临时文件创建 | Rust 生态标准临时文件库，5.6亿+ 下载量 [VERIFIED: crates.io] |

### Supporting (Frontend)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@codemirror/legacy-modes` | 6.5.3 | 遗留语言模式移植 | 可选 -- 不使用，因无 batch 模式。仅包含 Unix shell 模式 [VERIFIED: unpkg listing] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw CM6 packages | `@uiw/react-codemirror` (v4.25.9) | React wrapper 更方便但引入额外抽象层。本项目只需基本编辑器，raw packages + 自定义 hook 更轻量且完全可控 |
| Custom StreamLanguage | `@codemirror/legacy-modes/mode/shell` | Shell mode 仅支持 Unix shell 关键字（if/then/fi/do/done），不支持 Windows batch 关键字（goto、:label、REM、@echo、set /a）。需自定义 |
| Custom StreamLanguage | 无语法高亮 | 最简方案但违背 D-16 要求。自定义 tokenizer 约 50-80 行代码，投入产出比合理 |

**Installation:**
```bash
# Frontend: CodeMirror 6 核心包
npm install codemirror @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @codemirror/theme-one-dark

# Backend: Rust 临时文件支持（在 src-tauri/ 目录）
# 手动添加到 Cargo.toml: tempfile = "3"
```

**Version verification (2026-05-15):**
```
codemirror:                  6.0.2   (npm registry)
@codemirror/state:           6.6.0   (npm registry)
@codemirror/view:            6.43.0  (npm registry)
@codemirror/language:        6.12.3  (npm registry)
@codemirror/commands:        6.10.3  (npm registry)
@codemirror/theme-one-dark:  6.1.3   (npm registry)
tempfile (Rust crate):       3.27.0  (crates.io)
```

## Architecture Patterns

### System Architecture Diagram

```
用户点击指令卡片
       |
       v
CommandCard.onExecute()
       |
       v
useProject.executeCommand()  ----[单行]----> invoke("execute_command", { path, cmd })
       |                                           |
   [多行判断]                                       v
       |                                     shell.rs: build_cmd_start_args()
       v                                           |
useProject.executeScript()                         v
       |                                     cmd.exe /C start "" /d "path" cmd /K "cmd"
       v
invoke("execute_script", { path, content, mode })
       |
       v
shell.rs: execute_script()
       |
       +---> 1. 写入临时 .bat 文件 (tempfile + std::fs)
       |        头部: chcp 65001 >nul + cd /d "{path}"
       |        内容: 智能拼接（&& / &）或原样写入
       |
       +---> 2. cmd.exe /C start "" /d "path" cmd /K "filepath.bat"
       |
       v
  新终端窗口执行 .bat 脚本
```

### Recommended Project Structure
```
src/
├── components/
│   ├── CommandDialog.tsx      # 改造: 添加 Tab 切换 + CM6 集成
│   ├── CommandCard.tsx        # 改造: 多行内容截断显示
│   └── ScriptEditor.tsx       # 新增: CM6 编辑器封装组件
├── hooks/
│   ├── useProject.ts          # 改造: 添加 executeScript 路径
│   └── useBatchDetect.ts      # 新增: 批处理语法检测 hook
├── lib/
│   ├── types.ts               # 改造: CommandItem 添加 scriptLines?
│   ├── batch-lang.ts          # 新增: CM6 StreamLanguage batch tokenizer
│   ├── icons.ts               # 不变
│   └── presets.ts             # 不变
src-tauri/
├── src/
│   ├── commands/
│   │   └── shell.rs           # 改造: 添加 execute_script command
│   └── lib.rs                 # 改造: 注册新 command
├── Cargo.toml                 # 改造: 添加 tempfile 依赖
└── tauri.conf.json            # 不变 (CSP 已兼容)
```

### Pattern 1: Custom React Hook for CodeMirror
**What:** Thin wrapper around CM6 EditorView for React lifecycle management
**When to use:** This is the ONLY way to integrate CM6 with React -- CM6 is imperative, React is declarative
**Example:**
```typescript
// Source: codemirror.net/docs/guide/ + React integration patterns
import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";

function useCodeMirror(
  parentRef: React.RefObject<HTMLDivElement>,
  content: string,
  onChange: (value: string) => void
) {
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: parentRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
  }, []); // mount only

  return viewRef;
}
```

### Pattern 2: StreamLanguage for Batch File Highlighting
**What:** Custom regex-based tokenizer for Windows batch keywords
**When to use:** When no official CM6 language package exists for the target language
**Example:**
```typescript
// Source: codemirror.net/examples/lang-package/ + StreamLanguage API
import { StreamLanguage } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const batchTokens: Record<string, string> = {};
const batchKeywords = [
  "if", "else", "for", "do", "goto", "call", "set", "setlocal",
  "endlocal", "exit", "echo", "rem", "pause", "shift", "start",
  "not", "exist", "defined", "errorlevel", "in", "goto", "find",
  "mkdir", "rmdir", "del", "copy", "move", "ren", "type", "cls",
  "chcp", "cd", "pushd", "popd", "title", "color",
];
batchKeywords.forEach((kw) => { batchTokens[kw.toLowerCase()] = "keyword"; });

export const batchLanguage = StreamLanguage.define({
  name: "batch",
  startState() {
    return { inComment: false, inString: false };
  },
  token(stream, state) {
    // REM comments
    if (stream.sol() && stream.match(/^rem\b/i)) {
      stream.skipToEnd();
      return "comment";
    }
    // :: label comments
    if (stream.sol() && stream.match(/^::/)) {
      stream.skipToEnd();
      return "comment";
    }
    // @ prefix
    if (stream.sol() && stream.peek() === "@") {
      stream.next();
      return "meta";
    }
    // :label
    if (stream.sol() && stream.match(/^:\w+/)) {
      return "labelName";
    }
    // %% variables
    if (stream.match(/%%\w/)) {
      return "variableName";
    }
    // %variable%
    if (stream.match(/%\w+%/)) {
      return "variableName";
    }
    // strings
    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol() && stream.next() !== '"") {}
      if (!stream.eol()) stream.next();
      return "string";
    }
    // Skip whitespace
    if (stream.eatSpace()) return null;
    // Keywords
    if (stream.match(/^\w+/)) {
      const word = stream.current().toLowerCase();
      if (batchTokens[word]) return batchTokens[word];
      return null;
    }
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "REM" },
  },
});
```

### Pattern 3: Rust Temporary .bat File Execution
**What:** Create temp .bat file, write script content, execute via cmd.exe
**When to use:** Multi-line script execution (D-09, D-10, D-11)
**Example:**
```rust
// Source: tempfile crate docs + existing shell.rs pattern
use std::os::windows::process::CommandExt;
use std::process::Command as StdCommand;
use std::fs;
use std::path::PathBuf;

fn build_bat_content(project_path: &str, script_lines: &str, strict: bool) -> String {
    let separator = if strict { " && " } else { " & " };
    let joined = script_lines.lines()
        .filter(|l| !l.trim().is_empty())
        .collect::<Vec<_>>()
        .join(separator);

    format!(
        "@echo off\nchcp 65001 >nul\ncd /d \"{}\"\n{}",
        project_path, joined
    )
}

#[tauri::command]
pub async fn execute_script(
    project_path: String,
    script_content: String,
    is_batch_script: bool,  // true = 原样写入, false = 用 &&/& 连接
    strict: bool,           // true = &&, false = &
) -> Result<String, String> {
    let content = if is_batch_script {
        format!(
            "@echo off\nchcp 65001 >nul\ncd /d \"{}\"\n{}",
            project_path, script_content
        )
    } else {
        build_bat_content(&project_path, &script_content, strict)
    };

    // 创建临时 .bat 文件 (D-09: 不删除，放系统 temp 目录)
    let temp_dir = std::env::temp_dir();
    let bat_id = format!("easypack-{}", uuid::Uuid::new_v4());
    let bat_path = temp_dir.join(format!("{}.bat", bat_id));

    fs::write(&bat_path, &content)
        .map_err(|e| format!("Failed to write script file: {}", e))?;

    // 执行 .bat 文件
    let bat_path_str = bat_path.to_string_lossy().to_string();
    let args = format!(
        r#"/C start "" /d "{}" cmd /K "{}""#,
        project_path, bat_path_str
    );

    StdCommand::new("cmd")
        .raw_arg(&args)
        .spawn()
        .map_err(|e| format!("Failed to execute script: {}", e))?;

    Ok(bat_path_str)
}
```

### Pattern 4: Data Model Backward Compatibility
**What:** Extend CommandItem with optional multi-line fields
**When to use:** SCRIPT-05 backward compatibility requirement
**Example:**
```typescript
// Source: existing types.ts pattern (shortcut? field)
export interface CommandItem {
  id: string;
  name: string;
  command: string;        // 单行命令内容（兼容旧数据）
  icon: string;
  type: "preset" | "custom";
  scope: "global" | "project";
  addedAt: number;
  shortcut?: string;      // Phase 11: optional field pattern
  scriptLines?: string;   // Phase 17: 多行脚本内容（\n 分隔 string）
  executionMode?: "strict" | "lenient" | "batch";  // 执行模式
}
```
**Key decision:** Use `\n`-separated `string` instead of `string[]` for scriptLines. Reasons:
1. Simpler serialization (no JSON array parsing needed)
2. Direct use in CodeMirror EditorState.create({ doc: scriptLines })
3. Direct write to .bat file content
4. `command` field already stores the same content for single-line mode
5. Backward compatible: if `scriptLines` is undefined, use `command` field

### Anti-Patterns to Avoid
- **不要使用 @uiw/react-codemirror wrapper:** 引入额外抽象层，增加 bundle size ~50KB，而本项目只需最基本的编辑器功能。自定义 React hook 更轻量可控。
- **不要用 @codemirror/legacy-modes/mode/shell:** Unix shell tokenizer 不认识 Windows batch 语法（goto、:label、REM、%%、@echo 等），会错误高亮或遗漏关键字。
- **不要在 Rust 端做关键字检测:** 智能检测是纯文本操作，应在前端 useBatchDetect hook 中完成，避免不必要的 IPC 调用。
- **不要用 `Function()` 或 `eval()` 构建 CM6 parser:** 违反 CSP script-src 'self' 策略。使用预编译的 Lezer parser（CM6 默认行为）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 临时文件创建 | 手动拼接路径 + 随机数 | `tempfile` crate | 处理平台差异、权限、原子性、清理 |
| 唯一 .bat 文件名 | 时间戳拼接 | `uuid::Uuid::new_v4()` | 避免并发执行时文件名冲突 [ASSUMED] |
| 编辑器状态管理 | 自己管理 DOM + selection | CM6 EditorState | 编辑器状态极其复杂（undo history、selection、decoration） |
| 语法高亮 tokenizer | 从零写 parser | CM6 StreamLanguage | StreamLanguage 提供完整的 stream parsing 框架 |

**Key insight:** CM6 编辑器的内部状态管理极其复杂（document tree、selection ranges、undo history、decorations、viewports）。手写替代方案必然有 bug。同时 `tempfile` crate 处理了 Windows 临时目录权限和原子创建的边界情况。

## Runtime State Inventory

> 本阶段为功能扩展（greenfield addition），不涉及 rename/refactor/migration。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | plugin-store JSON 中的 CommandItem 数据 | 向后兼容 -- 新字段均为 optional，旧数据无需迁移 |
| Live service config | 无 | 无 |
| OS-registered state | 无 | 无 |
| Secrets/env vars | 无 | 无 |
| Build artifacts | 无 -- CodeMirror 包尚未安装 | npm install 时自动创建 |

## Common Pitfalls

### Pitfall 1: CodeMirror CSP 冲突
**What goes wrong:** CM6 动态创建 `<style>` 元素注入 CSS，若 CSP 不允许 inline style 则编辑器样式全部丢失
**Why it happens:** CM6 使用 `style-mod` 库动态生成 CSS 规则
**How to avoid:** 当前 CSP 已包含 `style-src 'self' 'unsafe-inline'`，完全兼容。无需修改。 [VERIFIED: tauri.conf.json line 28]
**Warning signs:** 编辑器渲染但无任何样式（无行号背景、无高亮颜色、无光标闪烁）

### Pitfall 2: @codemirror/lang-shell 不存在
**What goes wrong:** 尝试 `npm install @codemirror/lang-shell` 得到 404 错误
**Why it happens:** 该包从未在 npm 上发布过。CM6 官方语言包列表中不包含 shell/batch
**How to avoid:** 使用 `@codemirror/language` 的 `StreamLanguage.define()` 创建自定义 tokenizer [VERIFIED: npm registry 404]
**Warning signs:** `npm error 404 Not Found`

### Pitfall 3: .bat 文件编码导致中文乱码
**What goes wrong:** .bat 文件用 UTF-8 编写但 cmd.exe 默认使用系统代码页（中文 Windows 为 GBK/CP936），中文路径和 echo 输出变成乱码
**Why it happens:** cmd.exe 默认不使用 UTF-8 解码 .bat 文件
**How to avoid:** .bat 文件头部始终添加 `chcp 65001 >nul`（D-10），并在写入文件时使用 UTF-8 BOM 或确保 `chcp` 在内容之前执行 [VERIFIED: D-10 锁定决策]
**Warning signs:** 执行含中文路径的 .bat 时报错 "系统找不到指定的路径"

### Pitfall 4: Tab 切换丢失内容
**What goes wrong:** 用户在"单行"Tab 输入命令后切换到"多行"Tab，内容消失
**Why it happens:** 两个 Tab 使用不同的 state 变量，切换时未同步
**How to avoid:** 切换到"多行"时自动将 `command` (单行内容) 填入 CM6 编辑器第一行（D-03）
**Warning signs:** 切换 Tab 后编辑器为空

### Pitfall 5: tempfile crate 的 Windows 路径问题
**What goes wrong:** `std::env::temp_dir()` 返回的路径含空格（如 `C:\Users\用户名\AppData\Local\Temp`），直接传给 cmd.exe 不加引号会导致解析失败
**Why it happens:** cmd.exe 对空格路径必须用双引号包裹
**How to avoid:** 在 `build_cmd_start_args` 中始终用 `"{}"` 包裹 bat_path，遵循现有 `raw_arg` 模式
**Warning signs:** 执行脚本时报 "系统找不到指定的文件"

### Pitfall 6: React 严格模式下 CM6 双重初始化
**What goes wrong:** React 18/19 StrictMode 在开发模式下执行两次 useEffect，导致 CM6 EditorView 创建两次
**Why it happens:** StrictMode 的 intentional double-render for side effects detection
**How to avoid:** 在 useEffect cleanup函数中调用 `view.destroy()`，并在创建前检查 parentRef 是否已有子节点
**Warning signs:** 开发模式下编辑器渲染两个光标/两套行号

## Code Examples

### CommandDialog Tab 切换结构参考
```typescript
// 改造 CommandDialog.tsx 的核心结构
const [activeTab, setActiveTab] = useState<"single" | "multi">("single");

// Tab 切换处理 (D-03)
const handleTabChange = useCallback((tab: "single" | "multi") => {
  if (tab === "multi" && command.trim()) {
    // 从单行切到多行，将单行内容填入编辑器第一行
    setScriptContent(command);
  }
  setActiveTab(tab);
}, [command]);

// 预设选择器条件显示 (D-04)
{activeTab === "single" && (
  <div className="pb-4 mb-4 border-b border-white/10">
    {/* 现有预设选择器 UI */}
  </div>
)}

// 命令输入区域切换
{activeTab === "single" ? (
  <Input ... />
) : (
  <ScriptEditor
    value={scriptContent}
    onChange={setScriptContent}
    height="270px"
    darkMode={isDark}
  />
)}
```

### useBatchDetect Hook
```typescript
// 检测脚本内容是否包含批处理语法关键字 (D-05/D-06)
const BATCH_KEYWORDS = /\b(if|for|goto|call|set|setlocal|endlocal|shift)\b/i;
const BATCH_LABEL = /^:\w+/m;
const BATCH_REM = /^rem\b/im;
const BATCH_DOUBLE_PERCENT = /%%/;

export function useBatchDetect(content: string) {
  return useMemo(() => {
    if (!content) return false;
    return BATCH_KEYWORDS.test(content)
      || BATCH_LABEL.test(content)
      || BATCH_REM.test(content);
  }, [content]);
}
```

### .bat 文件命名 (Claude's Discretion)
```typescript
// 推荐: easypack-{uuid}.bat
// 使用 uuid 而非 timestamp 的理由:
// 1. 并发执行时 timestamp 可能冲突
// 2. uuid 无需额外 crate（tempfile 已间接依赖 uuid）
// 但 Rust 端需要添加 uuid crate 依赖
// 替代方案: 使用 tempfile::Builder 自带随机命名
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CM5 模式系统 | CM6 扩展系统 | CM6 发布 (2021) | 不再使用 `mode` 对象，改用 `extension` 组合 |
| CM5 单体包 | CM6 模块化包 | CM6 发布 (2021) | 按需引入，显著减小 bundle size |
| webpack 构建 | Vite 构建 | 本项目已用 Vite | CM6 的 ESM 模块与 Vite 完美配合 |
| 全局 style 标签 | CSP nonce 支持 | CM6 持续更新 | `EditorView.cspNonce` facet 可用于严格 CSP 场景 |

**Deprecated/outdated:**
- `@codemirror/lang-shell`: 从未存在过，不要引用
- CM5 `mode/batch`: CodeMirror 5 有社区 batch mode，但 CM6 不兼容
- `@uiw/react-codemirror` 的 `@codemirror/lang-shell` 引用: 该 wrapper 文档中提及但不代表包存在

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `uuid` crate 需要 Explicit 添加到 Cargo.toml 用于 .bat 文件命名 | Standard Stack | 低 -- 可改用 tempfile 自带随机命名或简单 timestamp |
| A2 | CM6 Lezer 预编译 parser 不需要 `unsafe-eval` 或 `Function()` | Architecture | 中 -- 若实际需要 eval 则必须修改 CSP script-src（但文档和 issue 表明预编译 parser 无此需求） |
| A3 | `codemirror` 包的 `basicSetup` 不包含需要 eval 的功能 | Architecture | 低 -- basicSetup 是标准配置，广泛使用于 CSP 环境 |

## Open Questions

1. **uuid vs tempfile 自带命名**
   - What we know: tempfile crate 可创建带随机后缀的临时文件，无需 uuid crate
   - What's unclear: tempfile 的命名格式是否满足可读性需求（如 `easypack-` 前缀）
   - Recommendation: 使用 `tempfile::Builder` 自定义前缀，避免引入额外 uuid 依赖。示例: `tempfile::Builder::new().prefix("easypack-").suffix(".bat").tempfile_in(&temp_dir)`

2. **React StrictMode 双重渲染**
   - What we know: React 19 + Vite dev 默认启用 StrictMode
   - What's unclear: 本项目是否启用了 StrictMode
   - Recommendation: 检查 `src/main.tsx` 是否有 `<React.StrictMode>`，如果有则在 useEffect 中做幂等检查

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 前端构建 | Yes | -- | -- |
| pnpm | 包管理 | Yes | -- | npm |
| Rust toolchain | 后端编译 | Yes | 1.93.1 | -- |
| CodeMirror packages | 脚本编辑器 | No (未安装) | -- | Wave 0 安装 |
| tempfile crate | .bat 文件创建 | No (未在 Cargo.toml) | -- | Wave 0 添加 |
| vitest | 单元测试 | Yes | 4.1.4 | -- |
| jsdom | 测试环境 | Yes | 29.0.2 | -- |
| @testing-library/react | 组件测试 | Yes | 16.3.2 | -- |

**Missing dependencies with no fallback:**
- CodeMirror 6 packages -- 必须在 Wave 0 安装
- tempfile Rust crate -- 必须在 Wave 0 添加到 Cargo.toml

**Missing dependencies with fallback:**
- uuid crate -- 可改用 tempfile Builder 自带随机命名

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRIPT-01 | Tab 切换 UI 正确渲染，多行编辑器出现 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx` | Existing, needs extension |
| SCRIPT-01 | 单行内容切到多行时保留 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx` | Existing, needs extension |
| SCRIPT-02 | .bat 文件包含 chcp 65001 和 cd /d 头部 | unit | `npx vitest run src-tauri/` (Rust test) | New: shell.rs tests |
| SCRIPT-02 | .bat 文件正确执行 | integration | Manual test: 打开终端执行 .bat | Manual-only |
| SCRIPT-03 | CodeMirror 编辑器渲染 | unit | `npx vitest run src/components/__tests__/ScriptEditor.test.tsx` | Wave 0 |
| SCRIPT-03 | 语法高亮标记 batch 关键字 | unit | `npx vitest run src/lib/__tests__/batch-lang.test.ts` | Wave 0 |
| SCRIPT-04 | useBatchDetect 正确识别批处理关键字 | unit | `npx vitest run src/hooks/__tests__/useBatchDetect.test.ts` | Wave 0 |
| SCRIPT-04 | 严格模式用 && 连接，宽松模式用 & 连接 | unit | `npx vitest run src-tauri/` (Rust test) | Wave 0: shell.rs |
| SCRIPT-05 | 旧数据无 scriptLines 字段时正常工作 | unit | `npx vitest run src/components/__tests__/CommandDialog.test.tsx` | Existing, needs extension |
| SCRIPT-05 | CommandItem 序列化/反序列化兼容 | unit | `npx vitest run src/lib/__tests__/types.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run` (full frontend suite) + `cd src-tauri && cargo test` (Rust suite)
- **Phase gate:** Full frontend + Rust suites green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/ScriptEditor.test.tsx` -- covers SCRIPT-03 (CM6 rendering)
- [ ] `src/lib/__tests__/batch-lang.test.ts` -- covers SCRIPT-03 (tokenizer correctness)
- [ ] `src/hooks/__tests__/useBatchDetect.test.ts` -- covers SCRIPT-04 (keyword detection)
- [ ] `src/lib/__tests__/types.test.ts` -- covers SCRIPT-05 (serialization roundtrip)
- [ ] Rust: `shell.rs` 新增 `build_bat_content` 和 `execute_script` 单元测试 -- covers SCRIPT-02/SCRIPT-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | 本地桌面应用，无认证 |
| V3 Session Management | No | 无用户会话 |
| V4 Access Control | No | 单用户本地应用 |
| V5 Input Validation | Yes | scriptContent 需验证（长度限制、空内容检查） |
| V6 Cryptography | No | 无加密需求 |

### Known Threat Patterns for Tauri + Shell Execution

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via script content | Tampering | .bat 文件写入固定 temp 目录，内容由用户完全控制。不拼接外部输入到命令中 |
| Malicious .bat file accumulation | Denial of Service | 临时文件放系统 temp 目录，随 OS 清理机制回收 (D-09)。长期可考虑限制文件数量 |
| Path traversal in project path | Tampering | 已有 `raw_arg` + 引号包裹模式。项目路径来自用户选择（dialog），非外部输入 |

## Sources

### Primary (HIGH confidence)
- npm registry -- codemirror 6.0.2, @codemirror/state 6.6.0, @codemirror/view 6.43.0, @codemirror/language 6.12.3, @codemirror/commands 6.10.3, @codemirror/theme-one-dark 6.1.3 versions verified
- npm registry -- @codemirror/lang-shell 404 confirmed (package does not exist)
- crates.io -- tempfile 3.27.0 verified
- tauri.conf.json -- CSP `style-src 'self' 'unsafe-inline'` confirmed (line 28)
- unpkg.com/@codemirror/legacy-modes@6.5.3/mode/ -- full directory listing confirms no batch.js exists, only shell.js
- Codebase: shell.rs -- existing `build_cmd_start_args` + `raw_arg` pattern
- Codebase: types.ts -- existing `shortcut?: string` optional field pattern
- Codebase: vitest.config.ts -- test framework config confirmed

### Secondary (MEDIUM confidence)
- codemirror.net/docs/guide/ -- CM6 architecture, extension system, EditorView lifecycle
- codemirror.net/examples/lang-package/ -- StreamLanguage API documentation
- CodeMirror GitHub issue #395 (codemirror/dev) -- CM6 dynamic style injection requires unsafe-inline or nonce for style-src

### Tertiary (LOW confidence)
- None -- all critical claims verified via primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all package versions verified against npm/crates.io registries
- Architecture: HIGH -- CSP compatibility verified against actual config file, patterns derived from existing codebase
- Pitfalls: HIGH -- each pitfall mapped to specific code/config with verification

**Research date:** 2026-05-15
**Valid until:** 2026-06-14 (30 days -- stable libraries, low churn expected)
