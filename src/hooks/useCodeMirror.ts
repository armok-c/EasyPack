/**
 * Generic CodeMirror 6 hook extracted from ScriptEditor.tsx.
 *
 * Manages EditorView lifecycle with React StrictMode safety.
 * Supports injection of language extensions, lint extensions, and custom
 * extensions via the `extensions` option.
 *
 * Content synchronization is handled externally via the `value` option:
 * when the `value` prop changes and differs from editor content, a
 * transaction is dispatched to update the editor. An internal `isSyncUpdate`
 * ref prevents infinite loops between external value sync and user input.
 */
import { useRef, useEffect } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

export interface UseCodeMirrorOptions {
  /** Current editor content */
  value: string;
  /** Called when the user edits content */
  onChange: (value: string) => void;
  /** Enable oneDark dark theme */
  darkMode?: boolean;
  /** CSS height string (default "100%") */
  height?: string;
  /** Additional CodeMirror extensions to inject (language, lint, etc.) */
  extensions?: Extension[];
}

/**
 * Generic CodeMirror 6 hook managing EditorView lifecycle.
 *
 * @param parentRef - Ref to the container div for the editor
 * @param options - Configuration options
 * @returns Object containing viewRef for external content sync
 */
export function useCodeMirror(
  parentRef: React.RefObject<HTMLDivElement | null>,
  options: UseCodeMirrorOptions,
) {
  const { value, onChange, darkMode = false, height, extensions = [] } = options;
  const viewRef = useRef<EditorView | null>(null);
  const isSyncUpdate = useRef(false);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    // StrictMode guard: clear any children from a previous mount cycle
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }

    // Base theme: fill container, allow scrolling
    const theme = EditorView.theme({
      "&": { height: height ?? "100%" },
      ".cm-scroller": { overflow: "auto" },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        lineNumbers(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isSyncUpdate.current) {
            onChange(update.state.doc.toString());
          }
        }),
        theme,
        darkMode ? oneDark : [],
        ...extensions,
      ],
    });

    const view = new EditorView({
      state,
      parent,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, height]);

  // Sync external value changes into the editor without cursor reflow
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      isSyncUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
      isSyncUpdate.current = false;
    }
  }, [value]);

  return { viewRef };
}
