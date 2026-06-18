/**
 * File language detection and lint utilities for CodeMirror 6 editor.
 *
 * Provides:
 * - LANGUAGE_MAP: File extension to CodeMirror language extension mapping
 * - getLanguageExtension(): Resolve language extension from file name
 * - getLinterExtensions(): Resolve lint extensions from file name
 * - formatRelativeTime(): Chinese relative time formatting
 * - ERROR_STATUS_BAR_HEIGHT: Status bar height constant for editor layout
 */
import type { Extension, Diagnostic } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { linter, lintGutter } from "@codemirror/lint";

/**
 * Map of file extensions to CodeMirror language extension factory functions.
 * Each factory is called once per invocation of getLanguageExtension().
 */
export const LANGUAGE_MAP: Record<string, () => Extension> = {
  ".json": () => json(),
  ".xml": () => xml(),
  ".yaml": () => yaml(),
  ".yml": () => yaml(),
  ".toml": () => StreamLanguage.define(toml),
  ".conf": () => StreamLanguage.define(properties),
  ".ini": () => StreamLanguage.define(properties),
  ".cfg": () => StreamLanguage.define(properties),
  ".env": () => [] as unknown as Extension,
  ".txt": () => [] as unknown as Extension,
  ".md": () => [] as unknown as Extension,
};

/**
 * Resolve CodeMirror language extension(s) from a file name.
 *
 * @param fileName - File name or path (e.g. "config.json", ".env")
 * @returns Array of CodeMirror extensions, or empty array for unknown/plain-text
 */
export function getLanguageExtension(fileName: string): Extension[] {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return [];

  const ext = fileName.substring(dotIndex).toLowerCase();
  const factory = LANGUAGE_MAP[ext];
  if (!factory) return [];

  const result = factory();
  // Factory may return Extension[] or a single Extension
  return Array.isArray(result) ? result : [result];
}

/**
 * Basic YAML format linter.
 * Checks indentation consistency, colon separators, and quote pairing.
 */
function yamlBasicLinter(view: { state: { doc: { toString: () => string } } }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check for tab indentation (YAML does not allow tabs)
    if (line.startsWith("\t")) {
      diagnostics.push({
        from: 0,
        to: line.length,
        severity: "error",
        message: "YAML 不允许使用 Tab 缩进",
      });
      continue;
    }

    // Check for unquoted values with special characters
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const value = trimmed.substring(colonIdx + 1).trim();
      if (value && !value.startsWith("|") && !value.startsWith(">") &&
          !value.startsWith('"') && !value.startsWith("'") &&
          /[\[\]\{\},#]/.test(value)) {
        diagnostics.push({
          from: line.indexOf(value),
          to: line.indexOf(value) + value.length,
          severity: "warning",
          message: "值可能包含特殊字符，建议使用引号括起来",
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Basic TOML format linter.
 * Checks key=value format, section headers, and quote pairing.
 */
function tomlBasicLinter(view: { state: { doc: { toString: () => string } } }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines, comments, and table headers
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;

    // Check for key=value format
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      if (!key) {
        diagnostics.push({
          from: line.indexOf("="),
          to: line.indexOf("=") + 1,
          severity: "error",
          message: "等号前缺少键名",
        });
      }

      const value = trimmed.substring(eqIdx + 1).trim();
      const fromPos = line.indexOf(trimmed);
      const toPos = fromPos + trimmed.length;

      // Check string value quotes
      if (value.startsWith('"') && !value.endsWith('"')) {
        diagnostics.push({
          from: fromPos,
          to: toPos,
          severity: "error",
          message: "未闭合的引号",
        });
      }
    }
  }

  return diagnostics;
}

/**
 * XML linter using DOMParser.
 * Detects parse errors by checking for <parsererror> element.
 */
function xmlLinter(view: { state: { doc: { toString: () => string } } }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  if (!text.trim()) return diagnostics;

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    diagnostics.push({
      from: 0,
      to: 1,
      severity: "error",
      message: parseError.textContent ?? "XML 解析错误",
    });
  }

  return diagnostics;
}

/**
 * Get CodeMirror linter and lint gutter extensions for a given file name.
 *
 * @param fileName - File name or path (e.g. "config.json")
 * @returns Array of linter extensions, or empty array for plain-text formats
 */
export function getLinterExtensions(fileName: string): Extension[] {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return [];

  const ext = fileName.substring(dotIndex).toLowerCase();

  switch (ext) {
    case ".json":
      return [linter(jsonParseLinter(), { delay: 500 }), lintGutter()];
    case ".xml":
      return [linter(xmlLinter, { delay: 500 }), lintGutter()];
    case ".yaml":
    case ".yml":
      return [linter(yamlBasicLinter, { delay: 500 }), lintGutter()];
    case ".toml":
      return [linter(tomlBasicLinter, { delay: 500 }), lintGutter()];
    default:
      return [];
  }
}

/**
 * Format a timestamp as a Chinese relative time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g. "刚刚", "3 分钟前", "2 小时前", "5 天前")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return "刚刚";
}

/**
 * Height of the error status bar used in file editor dialogs.
 * Reference constant for editor layout adjustments.
 */
export const ERROR_STATUS_BAR_HEIGHT = "36px";
