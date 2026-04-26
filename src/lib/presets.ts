import type { CommandItem } from "./types";

export interface PresetCategory {
  id: string;
  label: string;
  icon: string;
}

export interface PresetCommand {
  id: string;
  name: string;
  command: string;
  icon: string;
  category: string;
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  { id: "git",    label: "Git",         icon: "GitBranch" },
  { id: "npm",    label: "NPM/Node",    icon: "Package" },
  { id: "python", label: "Python/Pip",  icon: "Terminal" },
  { id: "rust",   label: "Rust/Cargo",  icon: "Ship" },
];

export const ALL_PRESETS: PresetCommand[] = [
  // Git (8 commands)
  { id: "preset-git-pull",     name: "拉取代码",    command: "git pull",                  icon: "GitBranch", category: "git" },
  { id: "preset-git-push",     name: "推送代码",    command: "git push",                  icon: "GitBranch", category: "git" },
  { id: "preset-git-status",   name: "查看状态",    command: "git status",                icon: "GitBranch", category: "git" },
  { id: "preset-git-log",      name: "查看日志",    command: "git log --oneline -10",     icon: "GitBranch", category: "git" },
  { id: "preset-git-fetch",    name: "获取更新",    command: "git fetch",                 icon: "GitBranch", category: "git" },
  { id: "preset-git-checkout", name: "切换主分支",  command: "git checkout main",         icon: "GitBranch", category: "git" },
  { id: "preset-git-add",      name: "暂存所有",    command: "git add .",                 icon: "GitBranch", category: "git" },
  { id: "preset-git-commit",   name: "提交更改",    command: "git commit",                icon: "GitBranch", category: "git" },

  // NPM/Node (6 commands)
  { id: "preset-npm-install",  name: "安装依赖",    command: "npm install",               icon: "Package",   category: "npm" },
  { id: "preset-npm-build",    name: "打包项目",    command: "npm run build",             icon: "Package",   category: "npm" },
  { id: "preset-npm-dev",      name: "启动开发",    command: "npm run dev",               icon: "Package",   category: "npm" },
  { id: "preset-npm-test",     name: "运行测试",    command: "npm test",                  icon: "Package",   category: "npm" },
  { id: "preset-npm-lint",     name: "代码检查",    command: "npm run lint",              icon: "Package",   category: "npm" },
  { id: "preset-npm-start",    name: "启动项目",    command: "npm start",                 icon: "Package",   category: "npm" },

  // Python/Pip (5 commands)
  { id: "preset-py-run",       name: "运行 Python", command: "python",                    icon: "Terminal",  category: "python" },
  { id: "preset-py-install",   name: "安装包",      command: "pip install",               icon: "Terminal",  category: "python" },
  { id: "preset-py-reqs",      name: "安装依赖",    command: "pip install -r requirements.txt", icon: "Terminal", category: "python" },
  { id: "preset-py-venv",      name: "创建虚拟环境", command: "python -m venv venv",      icon: "Terminal",  category: "python" },
  { id: "preset-py-test",      name: "运行测试",    command: "pytest",                    icon: "Terminal",  category: "python" },

  // Rust/Cargo (6 commands)
  { id: "preset-rs-build",     name: "编译项目",    command: "cargo build",               icon: "Ship", category: "rust" },
  { id: "preset-rs-run",       name: "运行项目",    command: "cargo run",                 icon: "Ship", category: "rust" },
  { id: "preset-rs-test",      name: "运行测试",    command: "cargo test",                icon: "Ship", category: "rust" },
  { id: "preset-rs-clippy",    name: "代码检查",    command: "cargo clippy",              icon: "Ship", category: "rust" },
  { id: "preset-rs-fmt",       name: "格式化代码",  command: "cargo fmt",                 icon: "Ship", category: "rust" },
  { id: "preset-rs-check",     name: "检查编译",    command: "cargo check",               icon: "Ship", category: "rust" },
];

/**
 * Returns only the 2 default command items for new projects.
 * Per D-06: only git pull + claude retained as defaults.
 * Replaces the old getPresetAsCommandItems() which returned 4 items.
 */
export function getDefaultsAsCommandItems(): CommandItem[] {
  return [
    {
      id: "preset-git-pull",
      name: "拉取代码",
      command: "git pull",
      icon: "GitBranch",
      type: "preset" as const,
      scope: "global" as const,
      addedAt: 0,
    },
    {
      id: "preset-claude",
      name: "启动 Claude",
      command: "claude",
      icon: "Sparkles",
      type: "preset" as const,
      scope: "global" as const,
      addedAt: 1,
    },
  ];
}
