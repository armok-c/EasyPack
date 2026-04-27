import { describe, it, expect } from "vitest";
import { keyboardEventToShortcut, shortcutToDisplay } from "../shortcutUtils";

describe("keyboardEventToShortcut", () => {
  it("converts Ctrl+G to CommandOrControl+G", () => {
    const e = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, key: "g" };
    expect(keyboardEventToShortcut(e)).toBe("CommandOrControl+G");
  });

  it("converts Ctrl+Shift+R to CommandOrControl+Shift+R", () => {
    const e = { ctrlKey: true, altKey: false, shiftKey: true, metaKey: false, key: "r" };
    expect(keyboardEventToShortcut(e)).toBe("CommandOrControl+Shift+R");
  });

  it("converts Alt+F5 to Alt+F5", () => {
    const e = { ctrlKey: false, altKey: true, shiftKey: false, metaKey: false, key: "F5" };
    expect(keyboardEventToShortcut(e)).toBe("Alt+F5");
  });

  it("rejects modifier-only combo (just Ctrl)", () => {
    const e = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, key: "Control" };
    expect(keyboardEventToShortcut(e)).toBeNull();
  });

  it("rejects no-modifier combo (just A)", () => {
    const e = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: "a" };
    expect(keyboardEventToShortcut(e)).toBeNull();
  });

  it("rejects 4-key combo (Ctrl+Alt+Shift+T)", () => {
    const e = { ctrlKey: true, altKey: true, shiftKey: true, metaKey: false, key: "t" };
    expect(keyboardEventToShortcut(e)).toBeNull();
  });

  it("maps special keys: ArrowUp -> Up, space bar -> Space", () => {
    const arrowUp = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, key: "ArrowUp" };
    expect(keyboardEventToShortcut(arrowUp)).toBe("CommandOrControl+Up");

    const space = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, key: " " };
    expect(keyboardEventToShortcut(space)).toBe("CommandOrControl+Space");
  });
});

describe("shortcutToDisplay", () => {
  it("replaces CommandOrControl with Ctrl", () => {
    expect(shortcutToDisplay("CommandOrControl+Shift+R")).toBe("Ctrl+Shift+R");
  });

  it("leaves Alt+G unchanged", () => {
    expect(shortcutToDisplay("Alt+G")).toBe("Alt+G");
  });
});
