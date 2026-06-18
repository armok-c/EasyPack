/**
 * CodeMirror 6 editor component for multi-line script editing.
 *
 * Uses the generic useCodeMirror hook from @/hooks/useCodeMirror, with
 * batchSupport() injected as a ScriptEditor-specific extension.
 *
 * Content sync: When value prop changes and differs from editor content,
 * dispatches a transaction to update. Prevents infinite loop by tracking
 * whether the change originated from user input (onChange callback).
 */
import { useRef, useEffect } from "react";
import type { Extension } from "@codemirror/state";
import { useCodeMirror } from "@/hooks/useCodeMirror";
import { batchSupport } from "@/lib/batch-lang";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  darkMode?: boolean;
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
  const isSyncUpdate = useRef(false);
  const { viewRef } = useCodeMirror(parentRef, {
    value,
    onChange,
    darkMode,
    extensions: [batchSupport()],
  });

  // Sync external value changes into the editor
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
  }, [value, viewRef, isSyncUpdate]);

  return (
    <div
      ref={parentRef}
      className="cm-editor-wrapper rounded-md overflow-hidden border border-white/10"
      style={{ height }}
    />
  );
}
