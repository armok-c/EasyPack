# Phase 16: 版本管理 - Validation

**Phase:** 16-版本管理
**Created:** 2026-05-14
**Requirements:** VER-01, VER-02, VER-03, VER-04

## Pre-Execution Checklist

- [ ] Plan 01 (Rust 后端) 和 Plan 02 (前端 UI) 已审查
- [ ] 无遗漏的 locked decision（D-01 ~ D-09）
- [ ] 依赖项（reqwest, semver, open）版本在 crates.io 上可获取
- [ ] Rust 工具链可用：`rustc --version` >= 1.77.2

## Requirement Coverage

| Requirement | Plan | Task | Verification |
|-------------|------|------|--------------|
| VER-01: 应用内显示版本号 | 02 | Task 2 | SettingsDialog 底部显示 "v{currentVersion}" |
| VER-02: 启动检查更新 + 24h 缓存 | 01 | Task 1 | check_for_updates 使用 store 缓存 24h |
| VER-02: 前端触发检查 | 02 | Task 1 | useUpdateCheck hook 在 store 就绪后调用 |
| VER-03: 更新提示（badge） | 02 | Task 2 | TitleBar 齿轮图标红点 |
| VER-03: 更新提示（设置弹窗条） | 02 | Task 2 | SettingsDialog 更新提示条 |
| VER-04: 点击跳转 GitHub | 01 | Task 1 | open_release_page command |
| VER-04: 前端触发跳转 | 02 | Task 2 | 点击提示条调用 onOpenReleasePage |

## Decision Coverage

| Decision | Plan | Implementation |
|----------|------|----------------|
| D-01: 版本号在 SettingsDialog 底部 | 02 | Task 2: text-xs text-muted-foreground 居中文字 |
| D-02: 不在 TitleBar 显示版本号 | 02 | 仅传 updateAvailable，不传版本号 |
| D-03: 齿轮图标红点 | 02 | Task 2: absolute 6px 红色圆点 |
| D-04: 设置弹窗内提示条 | 02 | Task 2: 蓝色左边框提示条 |
| D-05: 点击跳转 GitHub Releases | 01+02 | Task 1: open_release_page / Task 2: button onClick |
| D-06: 红点持续显示 | 02 | 状态在 App.tsx，独立于 Dialog 生命周期 |
| D-07: 手动同步版本号 | N/A | 不涉及代码实现 |
| D-08: Rust 端读取版本号 | 01 | Task 1: app.config().version |
| D-09: 前端不读 package.json | 02 | Task 1: 使用 getVersion() API |

## Post-Execution Verification

### Automated Checks

```bash
# 1. Rust 编译
cd E:/git/EasyPack/src-tauri && cargo check

# 2. TypeScript 编译
cd E:/git/EasyPack && npx tsc --noEmit

# 3. 前端构建
cd E:/git/EasyPack && npx vite build
```

### Manual Checks

1. **VER-01: 版本号显示**
   - 打开应用
   - 点击齿轮图标打开设置弹窗
   - 底部应显示 "v0.1.0"（或当前版本号）
   - 预期: 文字样式为小号灰色

2. **VER-02: 更新检查**
   - 启动应用
   - 检查 Rust 控制台日志（开发模式）
   - 预期: 发起 GitHub API 请求（首次）或命中缓存（24h 内）
   - 验证: 再次启动应用时使用缓存（不发新请求）

3. **VER-03: 更新提示**
   - 前提: 有新版本可用（可通过修改 GitHub API 响应或临时修改 Rust 逻辑模拟）
   - 预期: 齿轮图标右上角显示红色小圆点
   - 打开设置弹窗
   - 预期: 版本号上方显示蓝色提示条 "发现新版本 vX.Y.Z，点击下载"

4. **VER-04: 跳转下载**
   - 点击设置弹窗内的更新提示条
   - 预期: 系统默认浏览器打开 https://github.com/armok-c/EasyPack/releases/latest

5. **VER-06: 红点持久性**
   - 有新版本时显示红点
   - 打开设置弹窗后关闭
   - 预期: 红点仍然显示
   - 重启应用
   - 预期: 红点仍然显示（24h 缓存期间）

6. **Edge Cases**
   - 断网环境下启动应用
   - 预期: 无崩溃，无错误弹窗，版本号正常显示
   - GitHub API 返回 404（无 release）
   - 预期: 静默无更新，版本号正常显示

## Sign-Off

- [ ] 所有 automated checks 通过
- [ ] 所有 manual checks 通过
- [ ] 无 TypeScript 编译错误
- [ ] 无 Rust 编译警告（或已有合理解释）
- [ ] VER-01 ~ VER-04 全部覆盖

**Validated by:** ___________
**Date:** ___________
