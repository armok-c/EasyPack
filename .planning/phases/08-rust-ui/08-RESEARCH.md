# Phase 8: Rust 后端扩展与快速 UI 修复 - Research

**Researched:** 2026-04-16
**Domain:** Tauri 2 Rust 后端命令 + 前端 UI 修复
**Confidence:** HIGH

## Summary

Phase 8 为 EasyPack 新增四个核心能力：(1) Rust 后端扫描项目目录自动识别图标文件（package.json/Cargo.toml/常见图标文件名）；(2) Rust 后端计算文件夹大小（排除 node_modules/.git/target 等大目录）并读取 Git 当前分支名；(3) 前端支持混合图标渲染（lucide 预设 + 自定义文件图标）；(4) 模态窗在窗口过小时可滚动不被截断。

关键技术发现：**`convertFileSrc` 需要在 `tauri.conf.json` 中显式启用 `assetProtocol` 并配置 scope**，当前项目未配置此项，这是 Phase 8 的必要前置步骤。文件夹大小计算可使用 Rust 标准库 `std::fs` 手动递归实现（零外部依赖），无需引入 `walkdir` crate。`.git/HEAD` 解析是纯文本读取，零依赖零开销。模态窗修复是纯 CSS（Tailwind）布局变更。

**Primary recommendation:** 两个新 Rust Tauri 命令（`scan_project_icons` + `get_project_info`）+ 修改 DialogContent 组件 + 配置 assetProtocol。无需新增 Rust crate 依赖。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 智能扫描方式 -- Rust 后端扫描项目目录中多种图标来源：package.json 的 icon 字段、Cargo.toml 的 icon/package.metadata.icon 字段、常见图标文件名。后端一次性扫描并返回候选列表给前端。
- **D-02:** 混合图标模式 -- lucide 预设图标和自定义文件图标共存。侧边栏渲染时根据图标类型分别处理。
- **D-03:** 手动触发扫描 -- 在 ProjectSettingsDialog 中增加"从项目导入"按钮，用户点击后调用 Rust 命令。不在打开模态时自动扫描。
- **D-04:** 选中时即时计算 -- 用户选中项目时调用 Rust 命令即时计算文件夹大小。
- **D-05:** 固定排除目录列表 -- 排除 node_modules, .git, target, dist, .next, .cache, build, __pycache__, .venv 等常见大目录。列表硬编码在 Rust 后端。
- **D-06:** 超时机制 -- 设置 5-10 秒超时，超时后返回部分结果或显示占位提示。
- **D-07:** 读取 .git/HEAD 文件 -- 直接读取项目目录下 `.git/HEAD` 文件，解析 `ref: refs/heads/xxx` 获取当前分支名。零依赖。
- **D-08:** 与文件夹大小一起返回 -- Git 分支信息和文件夹大小在同一个 Rust Tauri 命令中一起返回。
- **D-09:** 全局 max-height + 滚动 -- 在 DialogContent 基础样式中添加 `max-h-[90vh]`。
- **D-10:** Header/Footer 固定，内容区滚动 -- DialogContent 内部使用 `flex flex-col` 布局，中间内容区域 `flex-1 overflow-y-auto` 实现滚动。

### Claude's Discretion
- 智能扫描的具体文件名匹配规则和优先级排序
- 排除目录的完整列表和是否支持 glob 模式
- 超时的具体秒数（5s vs 10s）
- 文件图标在侧边栏中的渲染尺寸和 fallback 策略
- 项目信息返回结构体（Rust struct）的字段设计
- max-height 的具体值（90vh / 85vh / 80vh）
- 缓存策略的细节（是否需要、TTL 等）

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-07 | 用户可在项目设置图标模态中，从项目目录自动识别应用图标 | D-01: Rust `scan_project_icons` 命令扫描 package.json/Cargo.toml/常见图标文件名；D-03: 手动触发 |
| PROJ-08 | 用户可选择自定义图标文件路径（支持 .ico/.png/.svg） | D-02: `convertFileSrc` 渲染文件图标；tauri-plugin-dialog 的 `open()` + filters 支持 .ico/.png/.svg |
| PROJ-09 | 选中项目后显示文件夹大小（排除大目录） | D-04/D-05: Rust `get_project_info` 命令递归计算排除特定目录；D-06: 超时机制 |
| PROJ-10 | Git 仓库显示当前分支名 | D-07/D-08: 读取 `.git/HEAD` 解析分支名，与文件夹大小同一命令返回 |
| UI-09 | 模态窗根据窗口大小自适应，窗口过小时内容可滚动 | D-09/D-10: DialogContent 添加 `max-h-[90vh]` + `flex flex-col` 布局 |
</phase_requirements>

## Standard Stack

### Core（已安装，Phase 8 复用）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.x (Cargo) | 桌面应用框架 | 项目已安装，Tauri command 模式已建立 |
| serde | 1.x (Cargo, derive) | Rust<->JSON 序列化 | 项目已安装，新返回类型需要 derive(Serialize) |
| serde_json | 1.x (Cargo) | JSON 读写 | 项目已安装，解析 package.json/Cargo.toml 的 JSON/TOML 内容 |
| @tauri-apps/api | ^2.10.1 | 前端 Tauri API | 提供 `convertFileSrc` 和 `invoke` [VERIFIED: npm registry] |
| @tauri-apps/plugin-dialog | ^2.7.0 | 文件选择对话框 | 项目已安装，"选择文件"功能使用 `open()` + filters [VERIFIED: package.json] |

### 无需新增依赖

Phase 8 不需要新增任何 npm 包或 Rust crate。所有功能通过以下方式实现：
- Rust 标准库 `std::fs` 实现文件系统操作
- `std::time` 实现超时
- 已有的 `serde` + `serde_json` 实现序列化
- 已有的 `@tauri-apps/plugin-dialog` 实现文件选择
- `@tauri-apps/api/core` 的 `convertFileSrc` 实现 asset protocol

**Installation:** 无需安装新包。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| std::fs 手动递归 | walkdir crate | walkdir 更优雅但引入外部依赖。本项目排除逻辑简单（只排除目录名），手动递归完全足够 [ASSUMED] |
| std::fs 手动递归 | ignore crate (ripgrep) | 自动尊重 .gitignore，但对本项目过于复杂。排除列表固定，不需要 gitignore 感知 [ASSUMED] |
| asset protocol (convertFileSrc) | base64 编码图片 | base64 增加内存占用，不适合频繁渲染。convertFileSrc 是 Tauri 官方推荐方式 [CITED: v2.tauri.app/reference/javascript/api/namespacecore] |

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/src/
├── commands/
│   ├── mod.rs          # 模块注册入口（新增 project_info 模块）
│   ├── shell.rs        # 现有：命令执行
│   └── project_info.rs # 新增：图标扫描 + 项目信息获取
├── lib.rs              # invoke_handler 注册新命令
└── main.rs             # 入口（不变）

src/
├── components/
│   ├── ui/
│   │   └── dialog.tsx              # 修改：max-height + flex-col 滚动布局
│   ├── ProjectSettingsDialog.tsx    # 修改：新增自定义图标区域
│   ├── Sidebar.tsx                  # 修改：支持文件图标渲染
│   └── MainArea.tsx                 # 修改：显示文件夹大小和 Git 分支
├── hooks/
│   └── useProject.ts                # 修改：新增项目信息获取逻辑
└── lib/
    └── icons.ts                     # 不变（file: prefix 不影响现有 lucide 映射）
```

### Pattern 1: Rust Tauri Command（现有模式，复用）

**What:** 异步 Rust 函数通过 `#[tauri::command]` 宏暴露给前端，前端通过 `invoke()` 调用。
**When to use:** 所有 Rust 后端操作。
**Example:**

```rust
// Source: src-tauri/src/commands/shell.rs（现有代码模式）
use serde::Serialize;

#[derive(Serialize)]
pub struct ProjectInfo {
    pub size: String,           // 人类可读格式，如 "12.3 MB"
    pub size_bytes: u64,        // 原始字节数（可选，用于排序）
    pub branch: Option<String>, // None 表示非 Git 仓库或 detached HEAD
}

#[tauri::command]
pub async fn get_project_info(project_path: String) -> Result<ProjectInfo, String> {
    // 实现细节...
    Ok(ProjectInfo {
        size: format_size(total_bytes),
        size_bytes: total_bytes,
        branch: read_git_branch(&project_path),
    })
}
```

### Pattern 2: convertFileSrc Asset Protocol（新增）

**What:** 将本地文件路径转换为 WebView 可加载的 URL。
**When to use:** 渲染自定义文件图标。
**前置条件：** 需要在 `tauri.conf.json` 中启用 `assetProtocol`。

```typescript
// Source: [CITED: v2.tauri.app/reference/javascript/api/namespacecore]
import { convertFileSrc } from "@tauri-apps/api/core";

// 将本地文件路径转换为 WebView 可渲染的 URL
const assetUrl = convertFileSrc("C:/Projects/app/icon.png");
// => "http://asset.localhost/C:/Projects/app/icon.png"（或类似格式）

// 在 <img> 标签中使用
<img src={convertFileSrc(filePath)} alt="" />
```

**配置要求（tauri.conf.json）：**
```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["**"],
          "deny": []
        }
      }
    }
  }
}
```

### Pattern 3: 图标类型判别（file: 前缀约定）

**What:** ProjectItem.icon 字段用 "file:" 前缀区分 lucide 图标和文件路径图标。
**When to use:** 侧边栏渲染、设置对话框预览。

```typescript
// 判别逻辑（UI-SPEC 定义）
function isFileIcon(icon: string): boolean {
  return icon.startsWith("file:");
}

// 提取文件路径
function getFilePath(icon: string): string {
  return icon.slice(5); // 去掉 "file:" 前缀
}
```

### Pattern 4: DialogContent 自适应布局

**What:** 修改 DialogContent 组件，使其在小窗口下内容可滚动。
**When to use:** 所有使用 DialogContent 的模态窗。

```tsx
// DialogContent 关键样式变更：
// 1. 外层: 添加 max-h-[90vh]
// 2. 布局: 从 grid 改为 flex flex-col
// 3. 内容区: flex-1 overflow-y-auto min-h-0
// 4. Header/Footer: 固定不滚动

// 关键: min-h-0 是必须的，它允许 flex 子元素缩小到小于内容尺寸，
// 从而启用 overflow 滚动。没有 min-h-0，flex 子元素不会触发溢出。
```

### Anti-Patterns to Avoid
- **Anti-pattern: 在 Rust 端使用 tokio::time::timeout 包装整个命令** -- Tauri command 本身支持 async，但超时应在 Rust 函数内部用 `tokio::select!` 或前端用 `Promise.race()` 实现。推荐前端 `Promise.race()` 方案，简单且不阻塞 Rust 线程。
- **Anti-pattern: 直接将 `file://` 路径作为 img src** -- WebView 安全策略会阻止 `file://` 协议。必须使用 `convertFileSrc` 转换为 `asset:` 协议。 [CITED: v2.tauri.app/reference/javascript/api/namespacecore]
- **Anti-pattern: 用 walkdir crate 的 filter() 代替 filter_entry()** -- `filter()` 只过滤结果但不剪枝（仍会遍历 node_modules 内部）。必须用 `filter_entry()` 才能跳过整个子树。 [ASSUMED: walkdir 文档]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 本地图片在 WebView 中渲染 | base64 编码 + data URI | `convertFileSrc` from `@tauri-apps/api/core` | base64 增加内存和 CPU 开销，convertFileSrc 是 Tauri 官方方案 [CITED: Tauri v2 docs] |
| 文件选择对话框 | 自定义文件浏览器 UI | `@tauri-apps/plugin-dialog` 的 `open()` | 已安装，支持 filters，系统原生 UI [CITED: v2.tauri.app/plugin/dialog] |
| 人类可读的文件大小格式 | -- | Rust 端手动格式化 | 逻辑极其简单（4 个 if-else 分支），不值得引入 `humansize` crate [ASSUMED] |
| 异步超时控制 | 自定义定时器线程 | 前端 `Promise.race()` + `setTimeout` | 最简单，不阻塞 Rust 线程，前端可以直接控制 UI 状态 [ASSUMED] |

**Key insight:** Phase 8 的所有功能都可以用 Rust 标准库 + 现有依赖实现。不需要引入任何新 crate。

## Common Pitfalls

### Pitfall 1: assetProtocol 未启用导致图片无法加载
**What goes wrong:** 使用 `convertFileSrc` 后图片仍然无法显示，控制台报 CSP 或 protocol 错误。
**Why it happens:** `convertFileSrc` 需要在 `tauri.conf.json` 中显式启用 `assetProtocol.enable: true` 并配置 scope。当前项目未配置此选项。
**How to avoid:** 在 Phase 8 第一步就配置 `assetProtocol`，scope 使用 `["**"]`（因为用户可以选择任意路径的图标文件）。
**Warning signs:** `<img>` 标签的 `onerror` 事件触发。

### Pitfall 2: DialogContent flex 布局 min-h-0 缺失
**What goes wrong:** DialogContent 设置了 `flex flex-col` 和 `overflow-y-auto`，但内容区域仍然不滚动，而是撑大整个对话框。
**Why it happens:** CSS flexbox 中，子元素默认 `min-height: auto`（等于内容高度），这会阻止子元素缩小到小于内容尺寸。
**How to avoid:** 在滚动内容区域添加 `min-h-0`，允许 flex 子元素缩小并触发 overflow。
**Warning signs:** 对话框超出视口高度但无法滚动。

### Pitfall 3: walkdir filter vs filter_entry
**What goes wrong:** 使用 `filter()` 过滤排除目录，但遍历仍然进入 node_modules/.git 等大目录内部，导致计算极慢。
**Why it happens:** `filter()` 只过滤迭代结果，不剪枝子树。目录仍被递归遍历。
**How to avoid:** 使用 `filter_entry()`（walkdir）或在手动递归中 `continue` 跳过排除目录。本项目使用手动递归，在 `read_dir` 遍历时检查目录名并跳过。
**Warning signs:** 大型项目（含 node_modules）计算文件夹大小超过 10 秒。

### Pitfall 4: .git/HEAD 文件格式变化
**What goes wrong:** 读取 `.git/HEAD` 后无法正确解析分支名。
**Why it happens:** detached HEAD 状态下 `.git/HEAD` 内容是 commit hash 而非 `ref: refs/heads/xxx`。
**How to avoid:** 检查内容是否以 `ref: refs/heads/` 开头。如果不是（detached HEAD），返回 `None`（不显示分支信息）。[CONTEXT.md specifics 已明确此行为]

### Pitfall 5: package.json/Cargo.toml 解析编码问题
**What goes wrong:** 包含中文注释或特殊字符的 package.json 解析失败。
**Why it happens:** Rust `std::fs::read_to_string` 默认使用 UTF-8，但某些文件可能使用其他编码。
**How to avoid:** 使用 `std::fs::read_to_string` 读取，如果失败则跳过该文件（非致命错误）。Cargo.toml 用简单的字符串搜索而非完整 TOML 解析。
**Warning signs:** 图标扫描返回空结果但项目有 package.json。

### Pitfall 6: 图标文件路径的持久化和跨平台兼容性
**What goes wrong:** Windows 路径 `C:\Users\...` 在 store 中保存后，反斜杠可能导致渲染问题。
**Why it happens:** `convertFileSrc` 期望一致格式的路径。
**How to avoid:** 在 Rust 端使用 `std::path::Path` 处理路径，前端 `convertFileSrc` 接受系统原生路径格式。Tauri 的 asset protocol 能处理 Windows 反斜杠路径。
**Warning signs:** 图标选择后保存成功但重启应用后无法渲染。

## Code Examples

### Rust: scan_project_icons 命令

```rust
// Source: 基于 CONTEXT.md D-01 和现有 shell.rs 模式
use std::fs;
use std::path::Path;
use serde::Serialize;

#[derive(Serialize)]
pub struct IconCandidate {
    pub path: String,       // 文件绝对路径
    pub name: String,       // 文件名（用于 UI 显示）
    pub source: String,     // 来源描述（"package.json", "Cargo.toml", "file"）
}

// 项目根目录扫描的图标文件名（不递归子目录）
const ICON_FILENAMES: &[&str] = &[
    "favicon.ico",
    "icon.ico",
    "app-icon.ico",
    "icon.png",
    "logo.png",
    "app-icon.png",
    "icon.svg",
    "logo.svg",
];

#[tauri::command]
pub async fn scan_project_icons(project_path: String) -> Result<Vec<IconCandidate>, String> {
    let dir = Path::new(&project_path);
    if !dir.exists() || !dir.is_dir() {
        return Err("项目目录不存在".to_string());
    }

    let mut candidates = Vec::new();

    // 1. 检查 package.json 的 icon 字段
    if let Ok(content) = fs::read_to_string(dir.join("package.json")) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // 检查多个可能的 icon 路径
            for key in &["icon", "icons", "application.icon"] {
                if let Some(icon_path) = json.get(*key).and_then(|v| v.as_str()) {
                    let full_path = dir.join(icon_path);
                    if full_path.exists() {
                        candidates.push(IconCandidate {
                            path: full_path.to_string_lossy().to_string(),
                            name: full_path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            source: "package.json".to_string(),
                        });
                    }
                }
            }
        }
    }

    // 2. 检查常见图标文件名（仅根目录）
    for filename in ICON_FILENAMES {
        let file_path = dir.join(filename);
        if file_path.exists() && file_path.is_file() {
            // 避免重复添加（package.json 已指向同一文件）
            let path_str = file_path.to_string_lossy().to_string();
            if !candidates.iter().any(|c| c.path == path_str) {
                candidates.push(IconCandidate {
                    path: path_str,
                    name: filename.to_string(),
                    source: "file".to_string(),
                });
            }
        }
    }

    Ok(candidates)
}
```

### Rust: get_project_info 命令

```rust
// Source: 基于 CONTEXT.md D-04/D-05/D-07/D-08
use std::fs;
use std::path::Path;
use serde::Serialize;

const EXCLUDED_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", ".next",
    ".cache", "build", "__pycache__", ".venv", ".env",
    ".tox", "coverage", ".terraform", "vendor",
];

#[derive(Serialize)]
pub struct ProjectInfo {
    pub size: String,           // 人类可读格式
    pub branch: Option<String>, // None = 非 Git 或 detached HEAD
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn calculate_dir_size(path: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();

            // 跳过排除目录
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if EXCLUDED_DIRS.contains(&name.as_ref()) {
                    continue;
                }
                total += calculate_dir_size(&entry.path());
            } else if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    total
}

fn read_git_branch(project_path: &Path) -> Option<String> {
    let head_path = project_path.join(".git").join("HEAD");
    let content = fs::read_to_string(&head_path).ok()?;

    // 格式: "ref: refs/heads/main\n"
    let trimmed = content.trim();
    if let Some(branch) = trimmed.strip_prefix("ref: refs/heads/") {
        Some(branch.to_string())
    } else {
        // detached HEAD (commit hash) -- 返回 None
        None
    }
}

#[tauri::command]
pub async fn get_project_info(project_path: String) -> Result<ProjectInfo, String> {
    let path = Path::new(&project_path);
    if !path.exists() || !path.is_dir() {
        return Err("项目目录不存在".to_string());
    }

    let total_bytes = calculate_dir_size(path);
    let branch = read_git_branch(path);

    Ok(ProjectInfo {
        size: format_size(total_bytes),
        branch,
    })
}
```

### Frontend: 图标类型判别和渲染

```typescript
// Source: 基于 UI-SPEC 和 CONTEXT.md D-02
import { convertFileSrc } from "@tauri-apps/api/core";
import { getIconByName } from "@/lib/icons";
import { Folder } from "lucide-react";

// 侧边栏项目图标渲染
function ProjectIcon({ icon }: { icon?: string }) {
  if (!icon) return null;

  if (icon.startsWith("file:")) {
    const filePath = icon.slice(5);
    return (
      <img
        src={convertFileSrc(filePath)}
        alt=""
        className="size-3.5 mr-1.5 flex-shrink-0 rounded-sm object-cover"
        onError={(e) => {
          // fallback: 隐藏图片，不显示
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  // lucide 图标
  const Icon = getIconByName(icon);
  return <Icon className="size-3.5 mr-1.5 flex-shrink-0 text-muted-foreground" />;
}
```

### Frontend: 文件选择器（图标文件）

```typescript
// Source: [CITED: v2.tauri.app/plugin/dialog]
import { open } from "@tauri-apps/plugin-dialog";

async function selectIconFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "选择图标文件",
    filters: [{
      name: "图标文件",
      extensions: ["ico", "png", "svg"],
    }],
  });
  return typeof selected === "string" ? selected : null;
}
```

### Frontend: 超时包装

```typescript
// Source: 基于 CONTEXT.md D-06，前端 Promise.race 方案
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), ms)
    ),
  ]);
}

// 使用：
const info = await withTimeout(
  invoke<ProjectInfo>("get_project_info", { projectPath }),
  8000,
  { size: "计算中...", branch: null }
);
```

### DialogContent 修改关键点

```tsx
// Source: 基于 UI-SPEC D-09/D-10
// 现有 dialog.tsx 第 62 行 className 变更：

// Before:
"fixed ... grid w-full max-w-[calc(100%-2rem)] ..."

// After:
"fixed ... flex flex-col w-full max-w-[calc(100%-2rem)] max-h-[90vh] ..."

// 关键变更：
// 1. grid -> flex flex-col
// 2. 添加 max-h-[90vh]
// 3. 关闭按钮需调整定位（不再用 absolute，或保持但 z-index 提升以防被滚动内容遮挡）
// 注意：使用 DialogContent 的各对话框需要确保内部结构是
//   DialogHeader -> 中间内容(overflow-y-auto) -> DialogFooter 的三层结构
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `tauri::api::file::read` | Tauri v2 `std::fs` + `#[tauri::command]` | Tauri 2.0 (2024) | 直接使用标准库，无需 Tauri 特定 API |
| Tauri v1 asset protocol 默认启用 | Tauri v2 需显式配置 `assetProtocol.enable` | Tauri 2.0 (2024) | 必须在 tauri.conf.json 中启用并配置 scope |
| walkdir + filter() 遍历 | walkdir filter_entry() 或手动递归 | 一直如此 | filter() 不剪枝，大目录性能差 |
| CSP null (禁用) | 生产环境应配置 CSP | 安全最佳实践 | 当前项目 CSP 设为 null（开发阶段可接受） |

**Deprecated/outdated:**
- Tauri v1 的 `convertFileSrc` 导入路径已变更为 `@tauri-apps/api/core` [CITED: v2.tauri.app/reference/javascript/api/namespacecore]
- `dialog:allow-ask` 和 `dialog:allow-confirm` 已 deprecated，现为 `allow-message` 的别名 [CITED: v2.tauri.app/plugin/dialog]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rust 手动递归（std::fs::read_dir）性能足够，不需要 walkdir crate | Standard Stack | 如果大型项目（100GB+）递归极慢，可能需要引入 walkdir 的并行遍历 |
| A2 | assetProtocol scope `"**"` 对用户选择任意路径图标足够 | Architecture Patterns | 如果 Tauri 限制 `"**"` 不包括某些系统目录，用户可能无法选择某些位置的图标 |
| A3 | Windows 上 `std::fs::read_to_string` 能正确读取 UTF-8 编码的 package.json 和 .git/HEAD | Common Pitfalls | 某些旧项目可能有非 UTF-8 编码的配置文件 |
| A4 | `convertFileSrc` 能正确处理 Windows 反斜杠路径（如 `C:\Users\...`） | Common Pitfalls | 如果 Tauri 在某些版本不处理反斜杠，需要手动转换为正斜杠 |
| A5 | Cargo.toml 图标字段可以用简单字符串搜索而非完整 TOML 解析 | Code Examples | 如果图标值在复杂 TOML 结构中（如 inline table），简单搜索可能遗漏 |
| A6 | 前端 `Promise.race` 超时方案足够，不需要 Rust 端 tokio::time::timeout | Code Examples | 如果 Rust 命令长时间阻塞不释放线程，可能影响其他 Tauri 命令的执行 |

## Open Questions

1. **assetProtocol scope 配置策略**
   - What we know: 需要启用 assetProtocol，scope 需要允许用户选择的任意图标文件路径
   - What's unclear: `"**"` 是否能覆盖 Windows 上所有可能的路径（包括网络驱动器、UNC 路径等）
   - Recommendation: 使用 `"$HOME/**"` + `"$APPDATA/**"` + 用户项目路径通配符。或直接用 `"**"`（个人工具，安全风险低）

2. **文件夹大小计算是否需要后台线程**
   - What we know: 大型项目可能需要数秒计算
   - What's unclear: Tauri async command 是否在独立线程池执行（不阻塞主线程）
   - Recommendation: Tauri async command 默认在 tokio 线程池执行，不会阻塞 UI。但如果计算时间超过 10 秒，可以考虑 `spawn_blocking` 将 CPU 密集操作移到专用线程

3. **缓存策略**
   - What we know: Claude's Discretion 允许自行决定缓存细节
   - What's unclear: 是否需要缓存文件夹大小和 Git 分支信息（避免每次切换项目都重新计算）
   - Recommendation: Phase 8 先不实现缓存，每次切换项目即时计算。如用户反馈慢，后续 Phase 可添加内存缓存 + 项目路径为 key

## Environment Availability

> Phase 8 有少量外部依赖需要确认。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Tauri 后端编译 | (need check) | -- | -- |
| Node.js | 前端构建 | (need check) | -- | -- |
| pnpm | 包管理 | (need check) | -- | npm |
| Tauri CLI | 开发调试 | (need check) | -- | -- |

**Missing dependencies with no fallback:**
- 无（所有依赖在 Phase 1-7 开发中已安装和验证）

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x [VERIFIED: package.json] |
| Config file | vitest.config.ts [VERIFIED: exists] |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-07 | Rust 扫描项目目录识别图标候选 | unit (Rust) | `cargo test -p easypack_lib` | Wave 0: 新建 tests |
| PROJ-08 | 前端选择自定义图标文件并保存 | unit (Vitest) | `npx vitest run src/components/__tests__/ProjectSettingsDialog.test.tsx` | Wave 0: 新建 |
| PROJ-09 | Rust 计算文件夹大小（排除大目录） | unit (Rust) | `cargo test -p easypack_lib` | Wave 0: 新建 tests |
| PROJ-10 | Rust 读取 .git/HEAD 解析分支名 | unit (Rust) | `cargo test -p easypack_lib` | Wave 0: 新建 tests |
| UI-09 | DialogContent 小窗口下可滚动 | unit (Vitest) | `npx vitest run src/components/__tests__/Dialog.test.tsx` | Wave 0: 新建 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && cargo test -p easypack_lib`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/commands/project_info.rs` 测试 -- 覆盖 PROJ-07, PROJ-09, PROJ-10
- [ ] `src/components/__tests__/ProjectSettingsDialog.test.tsx` -- 覆盖 PROJ-07, PROJ-08
- [ ] `src/components/__tests__/Dialog.test.tsx` -- 覆盖 UI-09
- [ ] `src/hooks/__tests__/useProject.test.tsx` 扩展 -- 覆盖项目信息获取逻辑

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本地桌面应用，无认证需求 |
| V3 Session Management | no | 无会话管理 |
| V4 Access Control | no | 单用户本地工具 |
| V5 Input Validation | yes | Rust 端验证项目路径存在性和有效性；前端验证图标文件扩展名 |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Tauri 2 Desktop

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal (图标扫描) | Tampering | Rust 端使用 `Path::canonicalize()` 规范化路径，检查路径在项目目录内 |
| Arbitrary file read (asset protocol) | Information Disclosure | assetProtocol scope 限制允许的路径范围 |
| XSS via icon file path | Tampering | `convertFileSrc` 生成的 URL 不直接执行脚本；img 标签不执行 JS |

**Security note:** 当前项目 CSP 设为 `null`（完全禁用）。Phase 8 应至少配置 `img-src` 允许 `asset:` 和 `http://asset.localhost`，以限制图片加载来源。 [CITED: v2.tauri.app/reference/javascript/api/namespacecore]

## Sources

### Primary (HIGH confidence)
- [Tauri v2 core API Reference - convertFileSrc](https://v2.tauri.app/reference/javascript/api/namespacecore/) -- convertFileSrc 函数签名、参数、CSP 和 assetProtocol 配置要求
- [Tauri v2 Dialog Plugin Docs](https://v2.tauri.app/plugin/dialog/) -- open() 函数用法、filters 配置、权限列表
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/) -- assetProtocol 配置结构

### Secondary (MEDIUM confidence)
- [Stack Overflow: How to check directory size in Rust](https://stackoverflow.com/questions/60041710/how-to-check-directory-size) -- 递归计算文件夹大小的 Rust 模式
- [walkdir crate documentation](https://docs.rs/walkdir/) -- filter_entry vs filter 区别（本项目未使用但作为参考）
- [GitHub Discussion: Display image using asset protocol](https://github.com/orgs/tauri-apps/discussions/11498) -- Tauri v2 asset protocol 配置实践

### Tertiary (LOW confidence)
- 无

### Codebase References (VERIFIED)
- `src-tauri/src/commands/shell.rs` -- 现有 Tauri command 模式
- `src-tauri/src/lib.rs` -- invoke_handler 注册机制
- `src-tauri/Cargo.toml` -- 当前 Rust 依赖列表
- `src-tauri/tauri.conf.json` -- 当前 Tauri 配置（缺少 assetProtocol）
- `src-tauri/capabilities/default.json` -- 当前权限配置
- `src/components/ui/dialog.tsx` -- 现有 DialogContent 组件
- `src/components/ProjectSettingsDialog.tsx` -- 现有图标选择器
- `src/components/Sidebar.tsx` -- 现有侧边栏项目渲染
- `src/components/MainArea.tsx` -- 现有信息栏区域
- `src/hooks/useProject.ts` -- 现有 ProjectItem 接口
- `src/lib/icons.ts` -- 现有 ICON_OPTIONS 映射
- `package.json` -- 当前前端依赖
- `vitest.config.ts` -- 测试配置

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 所有库已安装，版本已验证，无需新增依赖
- Architecture: HIGH -- 现有 Tauri command 模式可直接复用，前端修改点明确
- Pitfalls: HIGH -- assetProtocol 配置是唯一关键陷阱，已通过官方文档确认

**Research date:** 2026-04-16
**Valid until:** 2026-05-16（Tauri 2 API 稳定，30 天有效期合理）
