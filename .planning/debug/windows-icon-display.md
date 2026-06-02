---
status: verifying
trigger: "Windows 图标显示问题 - 系统托盘和任务栏都没显示图标"
created: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:02:00Z
---

## Current Focus

hypothesis: 两个独立根因已确认，修复已应用
test: cargo check 通过；ICO 文件已包含 4 个尺寸
expecting: 用户启动应用后任务栏和托盘图标正常显示
next_action: 等待用户验证

## Symptoms

expected: Windows 任务栏和系统托盘应显示 EasyPack 应用图标
actual: 任务栏和系统托盘都没有显示图标
errors: 无错误消息
reproduction: 启动应用即可观察到缺少图标
started: 一直存在

## Eliminated

(尚无)

## Evidence

- timestamp: 2026-05-12T00:00:00Z
  checked: 用户提供的线索
  found: icon.ico 只有 16x16 单一尺寸(913字节)；lib.rs 有 on_tray_icon_event 但无 TrayIconBuilder；tauri.conf.json 缺少 trayIcon 配置
  implication: 三个潜在问题需要逐一验证

- timestamp: 2026-05-12T00:01:00Z
  checked: file 命令验证 icon.ico
  found: "MS Windows icon resource - 1 icon, 16x16 with PNG image data, 16 x 16, 8-bit/color RGBA, non-interlaced, 32 bits/pixel"
  implication: 确认 ICO 只有单一 16x16 尺寸，Windows 任务栏需要 48x48 或 256x256

- timestamp: 2026-05-12T00:01:00Z
  checked: Pillow 检查 icon.png
  found: icon.png 是 1024x1024 RGBA 格式，903KB，可作为源图生成多尺寸 ICO
  implication: 有高质量源图可用于生成正确的 ICO

- timestamp: 2026-05-12T00:01:00Z
  checked: lib.rs 中 TrayIconBuilder 使用情况
  found: 只找到 on_tray_icon_event 回调(第51行)，没有 TrayIconBuilder::new() 或 .build(app) 调用
  implication: 托盘图标对象从未被创建，事件处理器永远不会被触发

- timestamp: 2026-05-12T00:01:00Z
  checked: GitHub Issue #8982 关于 tauri.conf.json trayIcon 声明式配置
  found: tauri.conf.json 的 trayIcon 声明式配置有 bug 会导致多个托盘图标
  implication: 应该使用 Rust 代码方式(TrayIconBuilder)创建托盘图标，不使用 tauri.conf.json 配置

## Resolution

root_cause: 两个独立问题：(1) icon.ico 只包含 16x16 单一尺寸，Windows 需要多尺寸 ICO 才能在任务栏正确显示；(2) lib.rs 注册了 on_tray_icon_event 回调但缺少 TrayIconBuilder 构建调用来实际创建托盘图标对象
fix: 用 Pillow 从 icon.png(1024x1024 RGBA) 生成包含 16/32/48/256 四个尺寸的 icon.ico(76KB)；在 lib.rs setup 闭包中添加 TrayIconBuilder::new().icon(...).tooltip("EasyPack").build(app)? 创建托盘图标
verification: cargo check 编译通过无错误
files_changed: [src-tauri/icons/icon.ico, src-tauri/src/lib.rs]
