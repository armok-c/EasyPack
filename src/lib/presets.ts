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
  { id: "preset-git-pull",     name: "Git Pull",           command: "git pull",                  icon: "GitBranch", category: "git" },
  { id: "preset-git-push",     name: "Git Push",           command: "git push",                  icon: "GitBranch", category: "git" },
  { id: "preset-git-status",   name: "Git Status",         command: "git status",                icon: "GitBranch", category: "git" },
  { id: "preset-git-log",      name: "Git Log",            command: "git log --oneline -10",     icon: "GitBranch", category: "git" },
  { id: "preset-git-fetch",    name: "Git Fetch",          command: "git fetch",                 icon: "GitBranch", category: "git" },
  { id: "preset-git-checkout", name: "Git Checkout Main",  command: "git checkout main",         icon: "GitBranch", category: "git" },
  { id: "preset-git-add",      name: "Git Add All",        command: "git add .",                 icon: "GitBranch", category: "git" },
  { id: "preset-git-commit",   name: "Git Commit",         command: "git commit",                icon: "GitBranch", category: "git" },

  // NPM/Node (6 commands) — per D-02: includes "打包项目" and "启动项目" for user manual selection
  { id: "preset-npm-install",  name: "Install Dependencies", command: "npm install",             icon: "Package",   category: "npm" },
  { id: "preset-npm-build",    name: "Build Project",        command: "npm run build",           icon: "Package",   category: "npm" },
  { id: "preset-npm-dev",      name: "Dev Server",           command: "npm run dev",             icon: "Package",   category: "npm" },
  { id: "preset-npm-test",     name: "Run Tests",            command: "npm test",                icon: "Package",   category: "npm" },
  { id: "preset-npm-lint",     name: "Lint",                 command: "npm run lint",            icon: "Package",   category: "npm" },
  { id: "preset-npm-start",    name: "Start",                command: "npm start",               icon: "Package",   category: "npm" },

  // Python/Pip (5 commands)
  { id: "preset-py-run",       name: "Run Python",           command: "python",                   icon: "Terminal",  category: "python" },
  { id: "preset-py-install",   name: "Pip Install",          command: "pip install",              icon: "Terminal",  category: "python" },
  { id: "preset-py-reqs",      name: "Install Requirements", command: "pip install -r requirements.txt", icon: "Terminal", category: "python" },
  { id: "preset-py-venv",      name: "Create Venv",          command: "python -m venv venv",      icon: "Terminal",  category: "python" },
  { id: "preset-py-test",      name: "Pytest",               command: "pytest",                   icon: "Terminal",  category: "python" },

  // Rust/Cargo (6 commands)
  { id: "preset-rs-build",     name: "Cargo Build",          command: "cargo build",              icon: "Ship", category: "rust" },
  { id: "preset-rs-run",       name: "Cargo Run",            command: "cargo run",                icon: "Ship", category: "rust" },
  { id: "preset-rs-test",      name: "Cargo Test",           command: "cargo test",               icon: "Ship", category: "rust" },
  { id: "preset-rs-clippy",    name: "Clippy",               command: "cargo clippy",             icon: "Ship", category: "rust" },
  { id: "preset-rs-fmt",       name: "Cargo Fmt",            command: "cargo fmt",                icon: "Ship", category: "rust" },
  { id: "preset-rs-check",     name: "Cargo Check",          command: "cargo check",              icon: "Ship", category: "rust" },
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
      name: "Git Pull",
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
