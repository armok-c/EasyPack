import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { ScriptEditor } from "@/components/ScriptEditor";

function Toggle() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}</button>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("深浅色模式", () => {
  it("默认浅色，可双向切换并在重新打开后恢复选择", () => {
    const first = render(<ThemeProvider><Toggle /></ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "切换到深色模式" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("easypack-theme")).toBe("dark");
    first.unmount();
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "切换到浅色模式" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("easypack-theme")).toBe("light");
  });

  it("同步其他窗口的主题变更，清空存储时恢复浅色", () => {
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    act(() => {
      localStorage.setItem("easypack-theme", "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: "easypack-theme", newValue: "dark", storageArea: localStorage }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button").textContent).toBe("切换到浅色模式");
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button").textContent).toBe("切换到深色模式");
  });

  it("忽略无效偏好，存储不可用时仍能切换当前窗口", () => {
    localStorage.setItem("easypack-theme", "invalid");
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("存储不可用"); });
    fireEvent.click(screen.getByRole("button", { name: "切换到深色模式" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button").textContent).toBe("切换到浅色模式");
  });

  it("编辑中切换主题保留文本、选区和撤销记录", () => {
    const onChange = vi.fn();
    const { container } = render(<ThemeProvider><Toggle /><ScriptEditor value="echo hello" onChange={onChange} /></ThemeProvider>);
    const editor = container.querySelector<HTMLElement>(".cm-editor")!;
    const view = EditorView.findFromDOM(editor)!;
    act(() => view.dispatch({ changes: { from: 10, insert: " world" }, selection: { anchor: 11, head: 16 } }));
    fireEvent.click(screen.getByRole("button", { name: "切换到深色模式" }));
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);
    expect(view.state.doc.toString()).toBe("echo hello world");
    expect(view.state.selection.main.from).toBe(11);
    expect(view.state.selection.main.to).toBe(16);
    act(() => { undo(view); });
    expect(view.state.doc.toString()).toBe("echo hello");
    fireEvent.click(screen.getByRole("button", { name: "切换到浅色模式" }));
    expect(view.state.facet(EditorView.darkTheme)).toBe(false);
  });
});
