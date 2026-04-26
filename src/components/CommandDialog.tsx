import { useState, useCallback, useMemo } from "react";
import type { CommandItem } from "@/lib/types";
import { ICON_OPTIONS, DEFAULT_ICON, getIconByName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRESET_CATEGORIES, ALL_PRESETS } from "@/lib/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; command: string; icon: string; scope?: "global" | "project" }) => void;
  initialData?: CommandItem | null;
  commandMode: "global" | "project";
  hasProject: boolean;
}

export function CommandDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData = null,
  commandMode,
  hasProject,
}: CommandDialogProps) {
  const isEditing = initialData !== null && initialData !== undefined;

  const [name, setName] = useState(() => initialData?.name ?? "");
  const [command, setCommand] = useState(() => initialData?.command ?? "");
  const [selectedIcon, setSelectedIcon] = useState(
    () => initialData?.icon ?? DEFAULT_ICON
  );
  const [nameDirty, setNameDirty] = useState(false);
  const [commandDirty, setCommandDirty] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [selectedScope, setSelectedScope] = useState<"global" | "project">(
    () => commandMode
  );

  const filteredPresets = useMemo(
    () => ALL_PRESETS.filter((p) => p.category === selectedCategory),
    [selectedCategory]
  );

  const isValid = name.trim().length > 0 && command.trim().length > 0;

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      setNameDirty(true);
    },
    []
  );

  const handleCommandChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCommand(e.target.value);
      setCommandDirty(true);
    },
    []
  );

  const handleIconSelect = useCallback((iconName: string) => {
    setSelectedIcon(iconName);
  }, []);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedPresetId("");
    setName("");
    setCommand("");
    setSelectedIcon(DEFAULT_ICON);
    setNameDirty(false);
    setCommandDirty(false);
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    const preset = ALL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setName(preset.name);
      setCommand(preset.command);
      setSelectedIcon(preset.icon);
      setNameDirty(false);
      setCommandDirty(false);
    }
    setSelectedPresetId(presetId);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      command: command.trim(),
      icon: selectedIcon,
      scope: selectedScope,
    });
  }, [isValid, name, command, selectedIcon, selectedScope, onSubmit]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset form state on close
        setName(initialData?.name ?? "");
        setCommand(initialData?.command ?? "");
        setSelectedIcon(initialData?.icon ?? DEFAULT_ICON);
        setNameDirty(false);
        setCommandDirty(false);
        setSelectedCategory("");
        setSelectedPresetId("");
        setSelectedScope(commandMode);
      }
      onOpenChange(newOpen);
    },
    [initialData, onOpenChange]
  );

  const previewIcon = useMemo(() => getIconByName(selectedIcon), [selectedIcon]);

  const iconEntries = useMemo(
    () => Object.entries(ICON_OPTIONS),
    []
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? "编辑指令" : "添加指令"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Preset selection area per D-03 */}
          <div className="pb-4 mb-4 border-b border-white/10">
            <div className="grid grid-cols-2 gap-2">
              {/* Category Select */}
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger aria-label="选择预设分类" className="w-full">
                    <SelectValue placeholder="选择分类..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRESET_CATEGORIES.map((cat) => {
                        const CategoryIcon = getIconByName(cat.icon);
                        return (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <CategoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Command Select */}
              <div className="space-y-2">
                <Label>命令</Label>
                <Select
                  value={selectedPresetId}
                  onValueChange={handlePresetChange}
                  disabled={!selectedCategory}
                >
                  <SelectTrigger aria-label="选择预设命令" className="w-full">
                    <SelectValue placeholder={selectedCategory ? "选择命令..." : "先选择分类"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {filteredPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Scope selector per PRE-04 */}
          {!isEditing && (
            <div className="pb-4 mb-4 border-b border-white/10">
              <Label className="mb-2 block">添加到</Label>
              <div
                className="inline-flex rounded-md overflow-hidden border border-white/10"
                role="radiogroup"
                aria-label="指令作用域"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedScope === "global"}
                  aria-label="全局指令"
                  onClick={() => setSelectedScope("global")}
                  className={cn(
                    "px-3 py-1.5 text-xs transition-all duration-150 ease-out",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selectedScope === "global"
                      ? "bg-white/15 text-foreground border-r border-white/10"
                      : "bg-transparent text-muted-foreground hover:bg-white/5"
                  )}
                >
                  全局指令
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedScope === "project"}
                  aria-label="当前项目指令"
                  disabled={!hasProject}
                  onClick={hasProject ? () => setSelectedScope("project") : undefined}
                  className={cn(
                    "px-3 py-1.5 text-xs transition-all duration-150 ease-out",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selectedScope === "project"
                      ? "bg-white/15 text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-white/5",
                    !hasProject && "opacity-40 cursor-not-allowed"
                  )}
                >
                  当前项目指令
                </button>
              </div>
            </div>
          )}

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="cmd-name">名称</Label>
            <Input
              id="cmd-name"
              placeholder="例如: 运行测试"
              value={name}
              onChange={handleNameChange}
            />
            {nameDirty && name.trim().length === 0 && (
              <p className="text-red-400 text-xs mt-1">名称不能为空</p>
            )}
          </div>

          {/* Command field */}
          <div className="space-y-2">
            <Label htmlFor="cmd-command">Shell 命令</Label>
            <Input
              id="cmd-command"
              placeholder="例如: npm test"
              value={command}
              onChange={handleCommandChange}
            />
            {commandDirty && command.trim().length === 0 && (
              <p className="text-red-400 text-xs mt-1">命令不能为空</p>
            )}
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <Label>图标（可选）</Label>
            <div
              className="grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-label="选择图标"
            >
              {iconEntries.map(([iconName, IconComponent]) => (
                <button
                  key={iconName}
                  type="button"
                  role="radio"
                  aria-checked={selectedIcon === iconName}
                  aria-label={iconName}
                  onClick={() => handleIconSelect(iconName)}
                  className={cn(
                    "flex items-center justify-center size-9 rounded-lg",
                    "bg-white/5 hover:bg-white/10",
                    "transition-all duration-150 ease-out",
                    "cursor-pointer outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selectedIcon === iconName &&
                      "bg-white/15 border border-primary ring-1 ring-primary/50"
                  )}
                >
                  <IconComponent className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview section */}
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-muted-foreground mb-2">预览</p>
          <div
            className={cn(
              "w-20 flex flex-col items-center justify-center gap-2 p-3 rounded-xl",
              "bg-white/5 border border-white/10"
            )}
          >
            {(() => {
              const PreviewIcon = previewIcon;
              return <PreviewIcon className="size-6" />;
            })()}
            <span className="text-xs truncate w-full text-center">
              {name.trim() || "指令名称"}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button disabled={!isValid} onClick={handleSubmit}>
            {isEditing ? "保存" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
