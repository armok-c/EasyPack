import { describe, expect, it } from "vitest";
import { truncateForTray } from "../useTray";

describe("truncateForTray", () => {
  it("keeps a 10-character project name unchanged", () => {
    const name = "a".repeat(10);

    expect(truncateForTray(name)).toBe(name);
  });

  it("truncates an 11-character project name to 9 characters and an ellipsis", () => {
    const name = "a".repeat(11);

    expect(truncateForTray(name)).toBe(`${"a".repeat(9)}…`);
  });

  it("counts Unicode characters without splitting an emoji", () => {
    const name = `${"项".repeat(8)}😀ab`;

    expect(truncateForTray(name)).toBe(`${"项".repeat(8)}😀…`);
  });
});
