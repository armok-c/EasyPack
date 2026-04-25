import { describe, it, expect } from "vitest";
import { isFileIcon, getFilePath, getIconByName } from "@/lib/icons";
import { Terminal, Code } from "lucide-react";

describe("isFileIcon", () => {
  it("returns true for file path with file: prefix", () => {
    expect(isFileIcon("file:C:/Projects/app/icon.png")).toBe(true);
  });

  it("returns false for lucide icon name", () => {
    expect(isFileIcon("Terminal")).toBe(false);
  });

  it("returns true for file: prefix with empty path", () => {
    expect(isFileIcon("file:")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isFileIcon("")).toBe(false);
  });
});

describe("getFilePath", () => {
  it("extracts file path from file: prefixed icon value", () => {
    expect(getFilePath("file:C:/Projects/app/icon.png")).toBe(
      "C:/Projects/app/icon.png"
    );
  });

  it("returns empty string for file: prefix with no path", () => {
    expect(getFilePath("file:")).toBe("");
  });
});

describe("getIconByName (file icon fallback)", () => {
  it("returns Terminal for file: prefixed input (fallback)", () => {
    const result = getIconByName("file:C:/test.png");
    expect(result).toBe(Terminal);
  });

  it("still returns Terminal for Terminal name (regression)", () => {
    const result = getIconByName("Terminal");
    expect(result).toBe(Terminal);
  });

  it("still returns Code for Code name (regression)", () => {
    const result = getIconByName("Code");
    expect(result).toBe(Code);
  });
});
