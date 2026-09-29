import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile } from "@tailwindcss/node";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Terminal } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCard } from "@/components/CommandCard";
import { ScriptEditor } from "@/components/ScriptEditor";

let style: HTMLStyleElement;

beforeEach(async () => {
  const compiler = await compile(readFileSync(resolve("src/index.css"), "utf8"), {
    base: resolve("src"),
    onDependency() {},
  });
  style = document.createElement("style");
  style.textContent = compiler.build(["outline-none", "focus-visible:outline-none", "focus-visible:ring-2"]);
  document.head.append(style);
});

afterEach(() => {
  cleanup();
  style.remove();
});

describe("theme styles", () => {
  it.each([
    ["button", <Button>Save</Button>],
    ["ghost button", <Button variant="ghost">Cancel</Button>],
    ["switch", <Switch aria-label="Tray" />],
    ["command", <CommandCard name="Build" icon={Terminal} />],
    ["tab", <Tabs defaultValue="commands"><TabsList><TabsTrigger value="commands">Commands</TabsTrigger></TabsList></Tabs>],
    ["icon choice", <button className="mbe-icon-choice outline-none" aria-checked="true">Icon</button>],
    ["project", <div tabIndex={0} className="mbe-project focus-visible:outline-none" data-selected="true">Project</div>],
  ])("keeps a visible focus outline on %s", (_name, element) => {
      const { container } = render(element);
      const control = container.querySelector<HTMLElement>("button, .mbe-project")!;
      fireEvent.keyDown(document, { key: "Tab" });
      act(() => control.focus());
      expect(document.activeElement).toBe(control);
      expect(control.matches(":focus-visible"), "focus-visible").toBe(true);
      const focused = getComputedStyle(control);
      expect(focused.outlineStyle, control.outerHTML).toBe("solid");
      expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
      expect(focused.outlineColor).not.toBe("transparent");
      expect(focused.outlineColor).not.toBe("");
      expect(parseFloat(focused.outlineOffset)).toBeLessThanOrEqual(-2);
  });

  it("colors batch tokens distinctly and readably in the light editor", () => {
    const { container } = render(<ScriptEditor
      value={'@echo "hello" %PATH%\nREM comment\n:done'}
      onChange={vi.fn()}
    />);
    const expected = ["@", "echo", '"hello"', "%PATH%", "REM comment", ":done"];
    const tokens = [...container.querySelectorAll<HTMLElement>(".cm-line span")];
    const editor = container.querySelector<HTMLElement>(".cm-editor")!;
    const normalColor = getComputedStyle(editor).color;
    const colors = expected.map((text) => {
      const token = tokens.find((element) => element.textContent === text);
      expect(token, text).toBeDefined();
      const color = getComputedStyle(token!).color;
      expect(color, text).not.toBe(normalColor);
      const channels = color.match(/\d+/g)!.slice(0, 3).map(Number).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      expect(1.05 / (luminance + 0.05), text).toBeGreaterThanOrEqual(4.5);
      return color;
    });
    expect(new Set(colors).size).toBe(expected.length);
  });
});
