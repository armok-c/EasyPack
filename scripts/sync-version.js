import { readFileSync, writeFileSync, accessSync, constants } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// 基于脚本自身位置推导项目根目录（scripts/ 的父目录），
// 避免依赖 process.cwd()（IN-04）：开发者从任意目录运行均可正确定位文件。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Read source version from package.json (D-09)
let sourceVersion;
try {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  sourceVersion = pkg.version;
} catch (err) {
  console.error('Error: Cannot read package.json: ' + err.message);
  process.exit(1);
}

// 2. Define target files with their regex patterns
const targets = [
  {
    path: resolve(ROOT, 'src-tauri/tauri.conf.json'),
    name: 'tauri.conf.json',
    // 锁定行首紧跟 2 空格缩进（JSON.stringify 默认输出顶层字段为 2 空格缩进），
    // 避免未来插件配置中出现嵌套 "version": 字段时误伤（D-04）。
    regex: /^  "version"\s*:\s*"[^"]*"/m,
    replacement: '  "version": "' + sourceVersion + '"',
  },
  {
    path: resolve(ROOT, 'src-tauri/Cargo.toml'),
    name: 'Cargo.toml',
    // 假设（D-06）：[package] 段是文件第一个 section，且 version 是该段第一个字段。
    // 正则不锚定段名，会替换文件中第一个匹配 `version = "..."` 的行。
    // 若未来 Cargo.toml 在 [package] 之前出现其他段的独立 version 字段，需改用 TOML 解析或段内替换。
    regex: /^version\s*=\s*"[^"]*"/m,
    replacement: 'version = "' + sourceVersion + '"',
  },
];

const synced = [];

for (const target of targets) {
  let content;

  // Check file exists and is readable/writable (D-10)
  // 注：Windows 上 accessSync 的 W_OK 检查基于只读属性，可靠性有限（WR-04）。
  // 此处为尽力而为的预检，最终错误处理依赖下方 writeFileSync 的 try-catch。
  try {
    accessSync(target.path, constants.R_OK | constants.W_OK);
    content = readFileSync(target.path, 'utf-8');
  } catch (err) {
    console.error('Error: Cannot read/write ' + target.path + ': ' + err.message +
      ' (check if file is read-only or locked by another process)');
    process.exit(1);
  }

  // Check if version field exists in this file (D-11)
  if (!target.regex.test(content)) {
    console.error('Error: version field not found in ' + target.name);
    process.exit(1);
  }

  // Replace version and check if changed (D-08)
  const newContent = content.replace(target.regex, target.replacement);
  if (newContent === content) {
    // Version already matches source, skip this file
    continue;
  }

  // Write updated content (D-02)
  try {
    writeFileSync(target.path, newContent, 'utf-8');
    synced.push(target.name);
  } catch (err) {
    console.error('Error: Cannot write ' + target.path + ': ' + err.message);
    process.exit(1);
  }
}

// 3. Output summary (D-12)
if (synced.length > 0) {
  console.log('Version synced: ' + sourceVersion + ' -> ' + synced.join(', '));
}
