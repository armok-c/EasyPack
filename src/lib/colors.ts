/**
 * Predefined color palette for project color markers.
 * 8 colors per UI-SPEC Phase 5 Color Presets (D-05).
 * Values from Tailwind CSS v4 -500 weight for optimal visibility on dark background.
 */
export const COLOR_OPTIONS = [
  { name: "红", value: "#ef4444" },
  { name: "橙", value: "#f97316" },
  { name: "黄", value: "#eab308" },
  { name: "绿", value: "#22c55e" },
  { name: "蓝", value: "#3b82f6" },
  { name: "紫", value: "#a855f7" },
  { name: "粉", value: "#ec4899" },
  { name: "青", value: "#06b6d4" },
] as const;

/**
 * Default color value — empty string means no color marker.
 */
export const DEFAULT_COLOR = "";
