import { describe, it, expect } from "vitest";
import {
  DEFAULT_ICON,
  ICON_OPTIONS,
  isFileIcon,
  getFilePath,
  getIconByName,
} from "@/lib/icons";
import {
  Cloud,
  Database,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Code,
  TestTube,
} from "lucide-react";

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
    expect(DEFAULT_ICON).toBe("Terminal");
  });

  it("returns Terminal for an unknown icon name (regression)", () => {
    expect(getIconByName("UnknownIcon")).toBe(Terminal);
  });

  it("still returns Code for Code name (regression)", () => {
    const result = getIconByName("Code");
    expect(result).toBe(Code);
  });
});

describe("ICON_OPTIONS", () => {
  it("keeps the original icons first and includes the expanded catalog", () => {
    const iconNames = Object.keys(ICON_OPTIONS);

    expect(iconNames).toHaveLength(60);
    expect(iconNames.slice(0, 12)).toEqual([
      "Terminal",
      "Code",
      "Server",
      "Zap",
      "GitBranch",
      "Package",
      "Globe",
      "Wrench",
      "Rocket",
      "Play",
      "Sparkles",
      "Ship",
    ]);
    expect(new Set(iconNames).size).toBe(iconNames.length);
    expect(iconNames).toEqual(
      expect.arrayContaining([
        "Braces",
        "FileJson",
        "Database",
        "Cloud",
        "Container",
        "TestTube",
        "ShieldCheck",
        "Monitor",
        "MessageCircle",
        "RefreshCw",
      ]),
    );
  });

  it("resolves representative newly added icons", () => {
    expect(getIconByName("Database")).toBe(Database);
    expect(getIconByName("Cloud")).toBe(Cloud);
    expect(getIconByName("TestTube")).toBe(TestTube);
    expect(getIconByName("ShieldCheck")).toBe(ShieldCheck);
    expect(getIconByName("MessageCircle")).toBe(MessageCircle);
    expect(getIconByName("RefreshCw")).toBe(RefreshCw);
  });
});
