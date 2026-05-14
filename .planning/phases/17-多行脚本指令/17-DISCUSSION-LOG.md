# Phase 17: 多行脚本指令 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 17-多行脚本指令
**Areas discussed:** 编辑模式切换, SCRIPT-04 与 .bat 文件的关系, 编辑器体验与布局

---

## 编辑模式切换

| Option | Description | Selected |
|--------|-------------|----------|
| Tab 切换 | CommandDialog 顶部加两个 Tab "单行" 和 "多行"，类似 Postman 切换 | ✓ |
| 自动检测换行 | 单一编辑器，按 Enter 换行自动切换为多行 | |
| 按钮展开 | Input 右侧按钮点击展开为多行编辑器 | |

**User's choice:** Tab 切换
**Notes:** 清晰直观，用户明确选择模式

| Option | Description | Selected |
|--------|-------------|----------|
| 单行为默认 | 新建指令默认显示"单行" Tab | ✓ |
| 智能回显 | 编辑已有指令时根据 scriptLines 自动切到对应 Tab | |

**User's choice:** 单行为默认（新建时），编辑已有指令时智能回显
**Notes:** 老用户无感知变化

| Option | Description | Selected |
|--------|-------------|----------|
| 内容保留 | 切 Tab 时保留已输入内容，单行命令填入多行第一行 | ✓ |
| 内容独立 | 切 Tab 时清空编辑器 | |

**User's choice:** 内容保留

| Option | Description | Selected |
|--------|-------------|----------|
| 预设仅单行 | 预设指令选择器只在单行 Tab 显示 | ✓ |
| 预设支持多行 | 预设也可选择多行脚本 | |

**User's choice:** 预设仅单行
**Notes:** 当前 25 个预设都是单行命令

---

## SCRIPT-04 与 .bat 文件的关系

| Option | Description | Selected |
|--------|-------------|----------|
| 智能模式 | 系统检测内容：简单多行用 &&/& 连接，批处理脚本原样写入 | ✓ |
| 统一连接 | 严格/宽松对所有内容都生效 | |
| 去掉模式开关 | 统一写入 .bat，无 &&/& 概念 | |

**User's choice:** 智能模式
**Notes:** 解决了 SCRIPT-02（.bat 文件）和 SCRIPT-04（&&/& 连接）之间的矛盾

| Option | Description | Selected |
|--------|-------------|----------|
| 关键字检测 | 检测 if/for/goto/set/call/:label 等关键字 | ✓ |
| 用户手动选择 | 用户手动选择批处理模式禁用连接 | |

**User's choice:** 关键字检测

| Option | Description | Selected |
|--------|-------------|----------|
| 编辑器下方 | 严格/宽松开关在编辑器下方，仅简单多行时显示 | ✓ |
| 指令属性区域 | 开关与 name/icon/scope 同级 | |

**User's choice:** 编辑器下方

| Option | Description | Selected |
|--------|-------------|----------|
| 严格为默认 | 新建多行指令默认 &&，更安全 | ✓ |
| 宽松为默认 | 默认 &，更像终端行为 | |

**User's choice:** 严格为默认

| Option | Description | Selected |
|--------|-------------|----------|
| 不清理 | 执行后不删除，放在系统 temp 目录 | ✓ |
| 执行后删除 | 执行完立即删除 | |

**User's choice:** 不清理

| Option | Description | Selected |
|--------|-------------|----------|
| 始终添加 | 所有 .bat 文件头部加 chcp 65001 >nul | ✓ |
| 检测后添加 | 仅含非 ASCII 字符时添加 | |

**User's choice:** 始终添加

| Option | Description | Selected |
|--------|-------------|----------|
| 自动 cd | .bat 头部 cd /d "{projectPath}" | ✓ |
| 参数传递 | 项目路径作为参数传入 | |

**User's choice:** 自动 cd

---

## 编辑器体验与布局

| Option | Description | Selected |
|--------|-------------|----------|
| CommandDialog 内 | 编辑器在现有弹窗内替换 Input，弹窗高度扩展 | ✓ |
| 独立弹窗 | 点击后打开独立大弹窗编辑器 | |

**User's choice:** CommandDialog 内

| Option | Description | Selected |
|--------|-------------|----------|
| 固定高度 | 10-12 行（约 250-300px），超出滚动 | ✓ |
| 自适应高度 | 随内容增长，有最大限制 | |

**User's choice:** 固定高度

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随应用主题 | 深色用 oneDark，浅色用 light | ✓ |
| 始终深色 | 模拟终端体验 | |

**User's choice:** 跟随应用主题

| Option | Description | Selected |
|--------|-------------|----------|
| 多行截断显示 | 卡片显示最多 3 行，超出显示 "..." | ✓ |
| 摘要标记 | 显示"脚本 · N 行"标记 | |

**User's choice:** 多行截断显示

| Option | Description | Selected |
|--------|-------------|----------|
| bat 语法高亮 | CodeMirror bat/Shell 语法高亮扩展 | ✓ |
| 纯文本 | 不提供语法着色 | |

**User's choice:** bat 语法高亮

---

## Claude's Discretion

- CodeMirror 6 + Tauri WebView CSP 配置
- @codemirror 包版本选择
- CommandDialog 高度扩展动画
- 严格/宽松开关 UI 组件选择
- .bat 文件命名规则
- bat 语法高亮语言包选择
- 行号显示样式
- scriptLines 数据结构（string[] vs \n 分隔 string）

## Deferred Ideas

None — discussion stayed within phase scope
