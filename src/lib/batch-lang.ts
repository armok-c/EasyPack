/**
 * CodeMirror 6 StreamLanguage tokenizer for Windows batch file syntax.
 *
 * Provides syntax highlighting for batch keywords, comments (REM, ::),
 * labels (:name), variables (%%a, %VAR%), strings, and @ prefix.
 *
 * Uses StreamLanguage.define() from @codemirror/language because no
 * official CM6 batch language package exists.
 */
import { StreamLanguage, LanguageSupport } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Batch keywords that should be highlighted */
const BATCH_KEYWORDS = new Set([
  "if", "else", "for", "do", "goto", "call", "set", "setlocal",
  "endlocal", "exit", "echo", "rem", "pause", "shift", "start",
  "not", "exist", "defined", "errorlevel", "in", "find",
  "mkdir", "rmdir", "del", "copy", "move", "ren", "type", "cls",
  "chcp", "cd", "pushd", "popd", "title", "color",
]);

/**
 * Custom StreamLanguage tokenizer for Windows batch files.
 *
 * Token precedence (first match wins):
 * 1. REM comments (line-start, case-insensitive)
 * 2. :: comments (line-start)
 * 3. @ prefix (line-start, meta)
 * 4. :label (line-start, labelName)
 * 5. %% variables (FOR loop variables)
 * 6. %VAR% environment variables
 * 7. "strings"
 * 8. Keywords (case-insensitive word match)
 */
export const batchLanguage = StreamLanguage.define({
  name: "batch",

  startState() {
    return {};
  },

  token(stream, _state) {
    // 1. REM comments (must be at line start, case-insensitive)
    if (stream.sol() && stream.match(/^rem\b/i)) {
      stream.skipToEnd();
      return "comment";
    }

    // 2. :: comments (line-start double colon)
    if (stream.sol() && stream.match(/^::/)) {
      stream.skipToEnd();
      return "comment";
    }

    // 3. @ prefix (echo suppression, meta)
    if (stream.sol() && stream.peek() === "@") {
      stream.next();
      return "meta";
    }

    // 4. :label (line-start label name)
    if (stream.sol() && stream.match(/^:\w+/)) {
      return "labelName";
    }

    // 5. %% FOR loop variables (e.g., %%a, %%i)
    if (stream.match(/%%\w/)) {
      return "variableName";
    }

    // 6. %VAR% environment variables
    if (stream.match(/%\w+%/)) {
      return "variableName";
    }

    // 7. "strings" (double-quoted)
    if (stream.peek() === '"') {
      stream.next(); // consume opening quote
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"') break;
      }
      return "string";
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // 8. Keywords (word boundary match)
    if (stream.match(/^\w+/)) {
      const word = stream.current().toLowerCase();
      if (BATCH_KEYWORDS.has(word)) {
        return "keyword";
      }
      return null;
    }

    // Default: skip single character
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: "REM" },
  },
});

/**
 * Highlight style for batch language tokens.
 * Maps CM6 tag types to CSS classes for consistent coloring.
 */
const batchHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, class: "cm-batch-keyword" },
  { tag: tags.comment, class: "cm-batch-comment" },
  { tag: tags.string, class: "cm-batch-string" },
  { tag: tags.variableName, class: "cm-batch-variable" },
  { tag: tags.labelName, class: "cm-batch-label" },
  { tag: tags.meta, class: "cm-batch-meta" },
]);

/**
 * Complete batch language support extension for CodeMirror.
 * Includes the tokenizer and highlight style.
 */
export function batchSupport(): LanguageSupport {
  return new LanguageSupport(batchLanguage, [
    syntaxHighlighting(batchHighlightStyle),
  ]);
}
