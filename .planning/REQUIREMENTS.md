# Milestone v2.0 Requirements: 能力跃升

**Milestone:** v2.0
**Status:** Defined
**Created:** 2026-05-13

---

## Multi-line Script Commands (SCRIPT)

- [ ] **SCRIPT-01**: 用户可以在指令编辑器中编写多行命令，支持 Windows 批处理语法（if/else、for、变量、goto 等）
- [ ] **SCRIPT-02**: 多行脚本写入临时 .bat 文件由 cmd.exe 执行，编码使用 `chcp 65001` 确保 UTF-8 兼容
- [ ] **SCRIPT-03**: 脚本编辑器提供语法高亮和行号显示（基于 CodeMirror 6）
- [ ] **SCRIPT-04**: 用户可选择执行模式：严格模式（失败即停，用 `&&` 连接）或宽松模式（继续执行，用 `&` 连接）
- [ ] **SCRIPT-05**: 现有单行指令数据模型向后兼容，`scriptLines` 为可选字段

## Version Management (VER)

- [x] **VER-01**: 应用内显示当前版本号（标题栏或设置页）
- [x] **VER-02**: 启动时检查 GitHub Releases API 是否有新版本，结果缓存 24 小时避免速率限制
- [x] **VER-03**: 发现新版本时显示更新提示（badge 或 toast 通知）
- [x] **VER-04**: 点击更新提示后打开浏览器跳转到 GitHub Release 下载页面

## Keyboard Shortcut Panel (KBD)

- [ ] **KBD-01**: 提供类似 VS Code 的快捷键设置面板，列出所有可绑定的操作
- [ ] **KBD-02**: 用户可在面板中点击操作后按键录制新快捷键组合
- [ ] **KBD-03**: 快捷键冲突检测和警告提示（复用 v1.2 已有逻辑）
- [ ] **KBD-04**: 快捷键搜索、按分类筛选、重置为默认值功能
- [ ] **KBD-05**: 除指令执行外，增加窗口操作（显示/隐藏、切换悬浮窗）、项目切换、打开项目文件夹等可绑定操作
- [ ] **KBD-06**: 快捷键绑定持久化保存，重启后恢复

## Floating Window Improvements (FLOAT)

- [ ] **FLOAT-01**: 悬浮窗布局更紧凑，显示信息更精简（减少内边距、缩小字体）
- [ ] **FLOAT-02**: 悬浮窗可折叠/展开，折叠态只显示项目图标和名称
- [ ] **FLOAT-03**: 折叠态点击项目名称可切换当前选中项目（与展开操作区分开）
- [ ] **FLOAT-04**: 折叠/展开之间有平滑动画过渡
- [ ] **FLOAT-05**: 悬浮窗支持拖拽移动到屏幕任意位置

## Auto-start on Boot (BOOT)

- [ ] **BOOT-01**: 提供开机启动开关，用户可启用/禁用（使用 tauri-plugin-autostart）
- [ ] **BOOT-02**: 开机启动后自动隐藏主窗口到系统托盘，不显示窗口
- [ ] **BOOT-03**: 每次启动时验证注册表条目是否有效，无效则自动重新注册（自愈机制）
- [ ] **BOOT-04**: 开机启动设置持久化，重启后保持用户选择

## Multi-config Profile System (CONFIG)

- [ ] **CONFIG-01**: 用户可创建、删除、重命名配置 profile（如"工作"、"个人"、"学习"）
- [ ] **CONFIG-02**: 用户可在不同 profile 之间切换，切换后加载对应的项目列表和指令
- [ ] **CONFIG-03**: 用户可导出当前配置为 JSON 文件
- [ ] **CONFIG-04**: 用户可导入 JSON 配置文件恢复配置（覆盖当前 profile）
- [ ] **CONFIG-05**: 从现有单配置自动迁移到 profile 系统（首次启动时检测并迁移）
- [ ] **CONFIG-06**: Profile 切换使用 mutex 序列化，防止并发写入导致数据损坏

---

## Future Requirements (Deferred)

- SCRIPT: 多行脚本执行结果反馈（成功/失败行数、总耗时）
- CONFIG: 选择性导入（合并 vs 覆盖）
- FLOAT: 悬浮窗内显示命令执行结果
- KBD: 快捷键导入/导出

## Out of Scope

| Feature | Reason |
|---------|--------|
| 自动下载安装更新 | 个人工具，手动下载即可；Tauri updater 要求签名验证不可关闭 |
| 完整脚本 IDE（断点、调试）| 超出"指令启动器"定位，应保持为 bat 执行器 |
| 跨平台自启动 | 仅面向 Windows |
| 配置云同步 | 仅本地文件管理 |
| 内嵌终端 | 彻底改变产品性质，技术复杂度极高 |

---


## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 15 | Pending |
| BOOT-02 | Phase 15 | Pending |
| BOOT-03 | Phase 15 | Pending |
| BOOT-04 | Phase 15 | Pending |
| VER-01 | Phase 16 | Pending |
| VER-02 | Phase 16 | Pending |
| VER-03 | Phase 16 | Pending |
| VER-04 | Phase 16 | Pending |
| SCRIPT-01 | Phase 17 | Pending |
| SCRIPT-02 | Phase 17 | Pending |
| SCRIPT-03 | Phase 17 | Pending |
| SCRIPT-04 | Phase 17 | Pending |
| SCRIPT-05 | Phase 17 | Pending |
| KBD-01 | Phase 18 | Pending |
| KBD-02 | Phase 18 | Pending |
| KBD-03 | Phase 18 | Pending |
| KBD-04 | Phase 18 | Pending |
| KBD-05 | Phase 18 | Pending |
| KBD-06 | Phase 18 | Pending |
| FLOAT-01 | Phase 19 | Pending |
| FLOAT-02 | Phase 19 | Pending |
| FLOAT-03 | Phase 19 | Pending |
| FLOAT-04 | Phase 19 | Pending |
| FLOAT-05 | Phase 19 | Pending |
| CONFIG-01 | Phase 20 | Pending |
| CONFIG-02 | Phase 20 | Pending |
| CONFIG-03 | Phase 20 | Pending |
| CONFIG-04 | Phase 20 | Pending |
| CONFIG-05 | Phase 20 | Pending |
| CONFIG-06 | Phase 20 | Pending |
