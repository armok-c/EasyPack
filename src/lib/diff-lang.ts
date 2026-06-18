/**
 * diff-lang - File extension to @git-diff-view/react language ID mapping.
 *
 * Maps common config file extensions to language strings used by
 * @git-diff-view/react for syntax-highlighted diff rendering.
 * Unknown extensions return undefined (DiffView uses no highlighting).
 */

/**
 * A map of lowercase file extensions (including the dot) to
 * @git-diff-view/react language identifiers.
 */
const DIFF_LANG_MAP: Record<string, string> = {
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".conf": "ini",
  ".ini": "ini",
  ".cfg": "ini",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".md": "markdown",
};

/**
 * Resolve a @git-diff-view/react language identifier from a file name.
 *
 * @param fileName - File name or path (e.g. "config.json", ".env")
 * @returns Language ID string for known extensions, or `undefined` for unknown
 *   extensions so DiffView falls back to no syntax highlighting.
 */
export function getDiffLanguage(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return undefined;
  const ext = fileName.substring(dotIndex).toLowerCase();
  return DIFF_LANG_MAP[ext];
}
