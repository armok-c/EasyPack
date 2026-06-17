import { readFileSync, writeFileSync, accessSync, constants } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();

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
    regex: /"version"\s*:\s*"[^"]*"/,
    replacement: '"version": "' + sourceVersion + '"',
  },
  {
    path: resolve(ROOT, 'src-tauri/Cargo.toml'),
    name: 'Cargo.toml',
    regex: /^version\s*=\s*"[^"]*"/m,
    replacement: 'version = "' + sourceVersion + '"',
  },
];

const synced = [];

for (const target of targets) {
  let content;

  // Check file exists and is readable/writable (D-10)
  try {
    accessSync(target.path, constants.R_OK | constants.W_OK);
    content = readFileSync(target.path, 'utf-8');
  } catch (err) {
    console.error('Error: Cannot read/write ' + target.path + ': ' + err.message);
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
