/**
 * Hook to detect whether script content contains Windows batch file syntax.
 *
 * Detects batch keywords (if/for/goto/call/set/setlocal/endlocal/shift),
 * batch labels (:name), and REM comments. Used by CommandDialog to decide
 * whether to show the strict/lenient toggle or the batch script indicator.
 *
 * Pure function, no side effects. Memoized with useMemo for performance.
 */
import { useMemo } from "react";

/** Batch control-flow keywords that indicate batch script syntax */
const BATCH_KEYWORDS = /\b(if|for|goto|call|set|setlocal|endlocal|shift)\b/i;

/** Batch labels (:target, :error, etc.) */
const BATCH_LABEL = /^:\w+/m;

/** REM comments (line-start, case-insensitive) */
const BATCH_REM = /^rem\b/im;

/**
 * Detect whether the given content contains batch file syntax keywords.
 *
 * @param content - Script content to analyze
 * @returns true if content appears to be a batch script
 */
export function useBatchDetect(content: string): boolean {
  return useMemo(() => {
    if (!content) return false;
    return (
      BATCH_KEYWORDS.test(content) ||
      BATCH_LABEL.test(content) ||
      BATCH_REM.test(content)
    );
  }, [content]);
}
