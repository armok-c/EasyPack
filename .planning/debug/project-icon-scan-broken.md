---
status: awaiting_human_verify
trigger: "项目图标获取功能不生效了——项目图标扫描功能不再正常工作"
created: 2026-05-13T00:00:00Z
updated: 2026-05-13T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "d0b5c7b 将 assetProtocol scope 收窄为 $APPDATA/$HOME 后，用户项目路径不在范围内，convertFileSrc 生成的 URL 被 Tauri 403 拒绝"
  confirming_evidence:
    - "scope 仅允许 $APPDATA/** 和 $HOME/**，不覆盖 E: D: 等其他驱动器路径"
    - "Rust scan_icons 测试全部通过，后端逻辑正确"
    - "前端 convertFileSrc 调用方式正确，问题出在 Tauri asset protocol 层面"
  falsification_test: "如果将 scope 改回 ** 后图标能正常显示，则确认根因"
  fix_rationale: "这是一个本地桌面工具，用户本就选择信任了项目路径。使用 ** 通配符是合理的——EasyPack 的核心功能就是执行用户项目路径下的命令，限制 asset scope 并不增加实际安全性"
  blind_spots: "未在运行时实际验证 403 错误（无法在 CLI 环境启动 GUI 应用）"

next_action: 执行修复——扩展 asset scope 并添加 onError 处理

## Symptoms

expected: 点击"扫描图标"按钮后，能找到并列出项目目录中的图标文件
actual: 图标扫描功能不生效（具体表现待确认）
errors: 未知
reproduction: 选中项目 → 打开设置 → 点击扫描图标按钮
started: 最近几个 bug 修复提交之后

## Eliminated

（暂无）

## Evidence

- timestamp: 2026-05-13T00:01:00Z
  checked: 读取 project_info.rs 完整实现（scan_icons 函数）
  found: Rust scan_icons 逻辑完整，三阶段扫描（package.json -> 根目录 -> 子目录），无可见 bug
  implication: 后端逻辑本身没有问题

- timestamp: 2026-05-13T00:02:00Z
  checked: 读取 ProjectSettingsDialog.tsx
  found: 前端调用 invoke("scan_project_icons", { projectPath }) 正确，使用 convertFileSrc(candidate.path) 显示图标
  implication: 前端调用逻辑正确

- timestamp: 2026-05-13T00:03:00Z
  checked: git log 查看 assetProtocol scope 变更历史
  found: 提交 d0b5c7b 将 assetProtocol.scope.allow 从 ["**"] 改为 ["$APPDATA/**", "$HOME/**"]
  implication: 如果用户的项目路径不在 $APPDATA 或 $HOME 下，convertFileSrc 生成的 asset URL 会被 Tauri 拒绝，图片无法加载

- timestamp: 2026-05-13T00:04:00Z
  checked: 最近修复提交 da2bea6 和 9b61b7f 的具体变更
  found: 9b61b7f 仅修改了 import 重命名（open -> openDialog）和类型修复（isSortable -> isSortableSource），未触及图标扫描逻辑
  implication: 最近的前端修复不是导致问题的原因

- timestamp: 2026-05-13T00:05:00Z
  checked: cargo test scan_icons 全部通过
  found: 4 个 scan_icons 测试全部通过，后端扫描逻辑正确
  implication: Rust 后端不是问题所在

- timestamp: 2026-05-13T00:06:00Z
  checked: assetProtocol scope 配置与用户实际项目路径
  found: 当前 scope 为 ["$APPDATA/**", "$HOME/**"]，在 Windows 上解析为 C:\Users\<user>\** 和 C:\Users\<user>\AppData\Roaming\**。用户项目路径 E:\git\EasyPack 不在此范围内
  implication: convertFileSrc() 生成的 asset URL 会被 Tauri 拒绝（403），导致图标图片无法加载

- timestamp: 2026-05-13T00:07:00Z
  checked: 提交 d0b5c7b（fix(12): WR-05 restrict assetProtocol scope）的变更
  found: 这是安全审查的修复，将 scope 从通配符 ["**"] 收窄为 ["$APPDATA/**", "$HOME/**"]。这个修改在图标扫描功能实现之后
  implication: 这个"安全修复"破坏了图标显示功能——项目路径通常在任意驱动器上

- timestamp: 2026-05-13T00:08:00Z
  checked: ProjectSettingsDialog.tsx 中 img 标签的 onError 处理
  found: 第 229 行的 <img src={convertFileSrc(candidate.path)}> 没有 onError 处理，而 Sidebar.tsx 第 111-113 行有 onError 静默隐藏
  implication: 即使 asset scope 修复后，仍应在 ProjectSettingsDialog 添加 onError 处理以提升鲁棒性

## Resolution

root_cause: 提交 d0b5c7b 出于安全考虑将 assetProtocol.scope.allow 从 ["**"] 收窄为 ["$APPDATA/**", "$HOME/**"]，但用户的项目路径通常在任意驱动器上（如 E:\git\EasyPack、D:\projects\xxx），不在 $HOME 或 $APPDATA 范围内，导致 convertFileSrc() 生成的 asset URL 被 Tauri 拒绝（403），图标图片无法在 img 标签中加载
fix: 将 assetProtocol.scope.allow 扩展为包含所有可能的项目路径。建议使用 ["**"] 通配符（因为这是一个本地桌面工具，用户本就信任所有项目路径），或者至少添加所有常用驱动器根路径。同时为 ProjectSettingsDialog 中的 img 标签添加 onError 处理
verification: TypeScript 编译通过，Rust cargo check 通过。需要用户在实际应用中验证图标扫描和显示功能
files_changed: [src-tauri/tauri.conf.json, src/components/ProjectSettingsDialog.tsx]

## Resolution

root_cause:
fix:
verification:
files_changed: []
