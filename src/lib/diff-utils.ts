/**
 * diff-utils - Diff data preparation utilities for @git-diff-view/react integration.
 *
 * Provides functions to:
 * - Convert two file strings into a DiffFile instance for rendering
 * - Map file extensions to highlight.js language IDs
 * - Compute match/missing counts between source and target environments
 */
import { generateDiffFile, type DiffFile } from "@git-diff-view/file";

/**
 * A map of common config file extensions to highlight.js language IDs.
 * Keys are lowercase extensions including the dot (e.g. ".json").
 */
const LANG_MAP: Record<string, string> = {
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".env": "ini",
  ".conf": "ini",
  ".ini": "ini",
  ".cfg": "ini",
  ".txt": "text",
  ".md": "markdown",
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".jsx": "javascriptreact",
  ".css": "css",
  ".html": "html",
  ".sh": "bash",
  ".bat": "dos",
  ".ps1": "powershell",
};

/**
 * Extract the file extension from a file name and return the corresponding
 * highlight.js language ID. Falls back to "text" for unknown extensions.
 */
export function getFileLanguage(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "text";
  const ext = fileName.substring(dotIndex).toLowerCase();
  return LANG_MAP[ext] ?? "text";
}

/**
 * Prepare a DiffFile instance for @git-diff-view/react rendering.
 *
 * Steps:
 * 1. Generate diff hunks from the two file contents
 * 2. Create a DiffFile with the source as oldFile and target as newFile
 * 3. Initialize theme, syntax highlighting, and pre-build split/unified lines
 *
 * @param sourceFileName - Name of the source (reference) file
 * @param sourceContent - Full content of the source file
 * @param targetFileName - Name of the target (modifiable) file
 * @param targetContent - Full content of the target file
 * @param lang - Language ID for syntax highlighting
 * @returns A fully initialized DiffFile instance ready for DiffView rendering
 */
export function prepareDiffData(
  sourceFileName: string,
  sourceContent: string,
  targetFileName: string,
  targetContent: string,
  lang: string,
): DiffFile {
  const diffFile = generateDiffFile(
    sourceFileName,
    sourceContent,
    targetFileName,
    targetContent,
    lang,
    lang,
  );

  diffFile.initTheme("dark");
  diffFile.init();
  try {
    diffFile.buildSplitDiffLines();
    diffFile.buildUnifiedDiffLines();
  } catch {
    // Some versions may not expose these methods as public.
    // The DiffView component handles missing build lines gracefully.
  }

  return diffFile;
}

/**
 * Compute match and missing file counts between two environment file lists.
 *
 * - matched: files that exist in both source and target (by name)
 * - missing: files that exist in source but not in target
 *
 * Files in target that don't exist in source are NOT counted (out of scope).
 */
export function computeMatchCounts(
  sourceFiles: { name: string }[],
  targetFiles: { name: string }[],
): { matched: number; missing: number } {
  const targetNames = new Set(targetFiles.map((f) => f.name));
  let matched = 0;
  let missing = 0;

  for (const file of sourceFiles) {
    if (targetNames.has(file.name)) {
      matched++;
    } else {
      missing++;
    }
  }

  return { matched, missing };
}
