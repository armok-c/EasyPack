/**
 * CodeMirror 6 editor component for multi-line script editing.
 *
 * Uses a custom useCodeMirror hook (not @uiw/react-codemirror) for
 * lightweight, fully controlled integration with React lifecycle.
 *
 * Handles React StrictMode double-render by:
 * 1. Destroying EditorView in useEffect cleanup
 * 2. Checking parentRef for existing children before creating view
 *
 * Content sync: When value prop changes and differs from editor content,
 * dispatches a transaction to update. Prevents infinite loop by tracking
 * whether the change originated from user input (onChange callback).
 */
import { useRef, useEffect, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { batchSupport } from "@/lib/batch-lang";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  darkMode?: boolean;
}

/**
 * Custom hook managing CodeMirror 6 EditorView lifecycle in React.
 *
 * Creates the editor on mount, destroys on unmount (StrictMode safe).
 * Syncs external value changes into the editor without causing cursor jumps.
 */
function useCodeMirror(
  parentRef: React.RefObject<HTMLDivElement | null>,
  initialContent: string,
  onChange: (value: string) => void,
  darkMode: boolean,
) {
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdate = useRef(false);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    // StrictMode guard: if children already exist from a previous mount,
    // clear them before creating a new editor
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        lineNumbers(),
        batchSupport(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChange(update.state.doc.toString());
          }
        }),
        // Editor styling: constrain height with scrolling
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
        darkMode ? oneDark : [],
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
  }, [darkMode]); // Re-create on theme change

  return viewRef;
}

/**
 * Multi-line script editor component powered by CodeMirror 6.
 *
 * Props:
 * - value: Script content (\n-separated string)
 * - onChange: Called when user edits content
 * - height: CSS height string (default "270px")
 * - darkMode: Use oneDark theme when true
 */
export function ScriptEditor({
  value,
  onChange,
  height = "270px",
  darkMode = false,
}: ScriptEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useCodeMirror(parentRef, value, onChange, darkMode);
  const isExternalUpdate = useRef(false);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [value, viewRef]);

  return (
    <div
      ref={parentRef}
      className="cm-editor-wrapper rounded-md overflow-hidden border border-white/10"
      style={{ height }}
    />
  );
}
