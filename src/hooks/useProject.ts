import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export interface Project {
  name: string;   // 文件夹名称 (per D-14)
  path: string;   // 完整路径
}

export function useProject() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // per D-15, D-16: 选择文件夹后立即选中
  // per D-14: 只显示文件夹名
  // per D-17: 替换当前项目
  async function selectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",  // per UI-SPEC Copywriting
      });

      if (typeof selected === "string") {
        // 从路径中提取文件夹名称 (per D-14)
        const name = selected.split(/[\\/]/).filter(Boolean).pop() || selected;
        setCurrentProject({ name, path: selected });
      }
      // per UI-SPEC: 文件夹选择取消时不需要 toast
    } catch (error) {
      console.error("文件夹选择失败:", error);
    }
  }

  // per D-10: toast 提示 1-2 秒
  // per D-11: 自动 cd 到项目目录
  async function executeCommand(shellCommand: string) {
    if (!currentProject) return;

    try {
      await invoke("execute_command", {
        projectPath: currentProject.path,
        shellCommand,
      });
      // per UI-SPEC Copywriting: "已执行: {command}"
      toast.success(`已执行: ${shellCommand}`);
    } catch (error) {
      // per UI-SPEC Copywriting: "命令执行失败：{具体错误}。请检查项目路径和命令是否正确。"
      toast.error(`命令执行失败：${error}。请检查项目路径和命令是否正确。`);
    }
  }

  return { currentProject, selectFolder, executeCommand };
}
