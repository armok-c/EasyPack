import { describe, expect, it } from "vitest";
import type { EnvironmentFileContent } from "@/lib/environment-types";
import { buildEnvironmentDiff } from "@/lib/environment-diff";

function text(content: string): EnvironmentFileContent {
  return { state: "text", content };
}

function lineTexts(model: ReturnType<typeof buildEnvironmentDiff>): string[] {
  return model.rows.map((row) => row.text);
}

describe("buildEnvironmentDiff", () => {
  it("uses current as old and snapshot as new for replacement", () => {
    const model = buildEnvironmentDiff(".env", text("A=1\n"), text("A=2\n"));

    expect(model.available).toBe(true);
    expect(model.additions).toBe(1);
    expect(model.deletions).toBe(1);
    expect(model.hunks).toHaveLength(1);
    expect(model.hunks[0].header).toBe("@@ -1,1 +1,1 @@");
    expect(model.hunks[0].context).toBe("");
    expect(model.hunks[0].rows.map((row) => [row.kind, row.oldLineNumber, row.newLineNumber, row.text])).toEqual([
      ["deletion", 1, null, "A=1"],
      ["addition", null, 1, "A=2"],
    ]);
    expect(model.hunks[0].rows[0].segments).toEqual([
      { text: "A=", changed: false },
      { text: "1", changed: true },
    ]);
    expect(model.hunks[0].rows[1].segments).toEqual([
      { text: "A=", changed: false },
      { text: "2", changed: true },
    ]);
    expect(model.rows.filter((row) => row.kind === "addition")).toHaveLength(model.additions);
    expect(model.rows.filter((row) => row.kind === "deletion")).toHaveLength(model.deletions);
  });

  it("represents pure creation and deletion with the correct direction", () => {
    const created = buildEnvironmentDiff("new.env", { state: "absent" }, text("A=1\nB=2\n"));
    const deleted = buildEnvironmentDiff("gone.env", text("A=1\nB=2\n"), { state: "absent" });

    expect(created.additions).toBe(2);
    expect(created.deletions).toBe(0);
    expect(created.hunks[0].header).toBe("@@ -0,0 +1,2 @@");
    expect(created.hunks[0].context).toBe("");
    expect(created.hunks[0].rows.every((row) => row.kind === "addition")).toBe(true);
    expect(created.hunks[0].rows.map((row) => row.newLineNumber)).toEqual([1, 2]);

    expect(deleted.additions).toBe(0);
    expect(deleted.deletions).toBe(2);
    expect(deleted.hunks[0].header).toBe("@@ -1,2 +0,0 @@");
    expect(deleted.hunks[0].context).toBe("");
    expect(deleted.hunks[0].rows.every((row) => row.kind === "deletion")).toBe(true);
    expect(deleted.hunks[0].rows.map((row) => row.oldLineNumber)).toEqual([1, 2]);
  });

  it("maps a head insertion to the complete rows without losing later hunks", () => {
    const oldContent = Array.from({ length: 24 }, (_, index) => `line-${index + 1}`).join("\n");
    const snapshotContent = [
      "head",
      ...oldContent.replace("line-2", "changed-2").replace("line-20", "changed-20").split("\n"),
    ].join("\n");
    const model = buildEnvironmentDiff("head.txt", text(oldContent), text(snapshotContent));

    expect(model.available).toBe(true);
    expect(model.additions).toBe(3);
    expect(model.deletions).toBe(2);
    expect(model.hunks).toHaveLength(2);
    expect(model.rows.map((row) => row.text)).toEqual([
      "head", "line-1", "line-2", "changed-2", "line-3", "line-4", "line-5",
      "line-6", "line-7", "line-8", "line-9", "line-10", "line-11", "line-12",
      "line-13", "line-14", "line-15", "line-16", "line-17", "line-18", "line-19",
      "line-20", "changed-20", "line-21", "line-22", "line-23", "line-24",
    ]);
    const hunkRows = model.hunks.flatMap((hunk) => hunk.rows);
    const gapRows = model.gaps.flatMap((gap) => gap.rows);
    expect(hunkRows.length + gapRows.length).toBe(model.rows.length);
    expect(new Set([...hunkRows, ...gapRows].map((row) => `${row.kind}:${row.oldLineNumber ?? ""}:${row.newLineNumber ?? ""}:${row.text}`)).size).toBe(model.rows.length);
  });

  it("keeps equal text as a zero-change model without content rows", () => {
    const model = buildEnvironmentDiff("same.env", text("A=1\n"), text("A=1\n"));

    expect(model.available).toBe(true);
    expect(model.hasContentChange).toBe(false);
    expect(model.additions).toBe(0);
    expect(model.deletions).toBe(0);
    expect(model.hunks).toHaveLength(0);
    expect(model.rows).toHaveLength(0);
    expect(model.changeKind).toBe("unchanged");
  });

  it("distinguishes absent from an empty text file even when stats are zero", () => {
    const createdEmpty = buildEnvironmentDiff("empty.env", { state: "absent" }, text(""));
    const deletedEmpty = buildEnvironmentDiff("empty.env", text(""), { state: "absent" });

    expect(createdEmpty.hasStateChange).toBe(true);
    expect(createdEmpty.changeKind).toBe("created");
    expect(createdEmpty.additions).toBe(0);
    expect(createdEmpty.deletions).toBe(0);
    expect(deletedEmpty.changeKind).toBe("deleted");
    expect(deletedEmpty.additions).toBe(0);
    expect(deletedEmpty.deletions).toBe(0);
  });

  it("does not construct a text diff for non-UTF8 content", () => {
    const model = buildEnvironmentDiff("binary.dat", { state: "nonUtf8" }, text("ignored"));

    expect(model.available).toBe(false);
    expect(model.additions).toBeNull();
    expect(model.deletions).toBeNull();
    expect(model.hunks).toHaveLength(0);
    expect(model.rows).toHaveLength(0);
    expect(model.changeKind).toBe("unavailable");
  });

  it("keeps a non-empty head insertion available with one addition", () => {
    const model = buildEnvironmentDiff("head-only.txt", text("A\n"), text("X\nA\n"));

    expect(model.available).toBe(true);
    expect(model.additions).toBe(1);
    expect(model.deletions).toBe(0);
    expect(model.hunks).toHaveLength(1);
    expect(model.hunks[0].header).toBe("@@ -1,1 +1,2 @@");
    expect(model.hunks[0].rows.map((row) => [row.kind, row.text])).toEqual([
      ["addition", "X"],
      ["context", "A"],
    ]);
    expect(model.gaps.every((gap) => gap.rows.length === 0)).toBe(true);
  });

  it("preserves trailing-newline and CRLF semantics without counting markers", () => {
    const trailing = buildEnvironmentDiff("line.txt", text("one"), text("one\n"));
    const crlf = buildEnvironmentDiff("line.txt", text("one\r\ntwo\r\n"), text("one\r\nthree\r\n"));

    expect(trailing.additions).toBe(1);
    expect(trailing.deletions).toBe(1);
    expect(trailing.rows.filter((row) => row.noNewline)).toHaveLength(1);
    expect(trailing.rows.some((row) => row.text === "one")).toBe(true);

    expect(crlf.additions).toBe(1);
    expect(crlf.deletions).toBe(1);
    expect(crlf.rows.filter((row) => row.lineEnding === "crlf")).toHaveLength(3);
    expect(lineTexts(crlf)).toEqual(["one", "two", "three"]);

    const crlfToLf = buildEnvironmentDiff("line.txt", text("one\r\n"), text("one\n"));
    expect(crlfToLf.available).toBe(true);
    expect(crlfToLf.additions).toBe(1);
    expect(crlfToLf.deletions).toBe(1);
    expect(crlfToLf.hunks[0].rows.map((row) => [row.kind, row.text, row.lineEnding])).toEqual([
      ["deletion", "one", "crlf"],
      ["addition", "one", "lf"],
    ]);
  });

  it("derives each hunk context from the nearest eligible current line", () => {
    const current = [
      "# file",
      "  ignored",
      "function build() {",
      "  return one;",
      "  return two;",
      "  return three;",
      "  return four;",
      "  return five;",
      "tail",
    ].join("\n");
    const snapshot = current.replace("  return four;", "  return changed;");
    const model = buildEnvironmentDiff("context.txt", text(current), text(snapshot));

    expect(model.hunks).toHaveLength(1);
    expect(model.hunks[0].context).toBe("function build() {");
  });

  it("does not generate context for a new file and leaves context empty when no line qualifies", () => {
    const created = buildEnvironmentDiff("created.txt", { state: "absent" }, text("A=1\nB=2\n"));
    const noContext = buildEnvironmentDiff("no-context.txt", text("  old\n# note\n"), text("  new\n# note\n"));

    expect(created.hunks[0].context).toBe("");
    expect(noContext.hunks[0].context).toBe("");
  });

  it("keeps permanent three-line hunks and complete hidden gaps in order", () => {
    const oldContent = Array.from({ length: 20 }, (_, index) => `line-${index + 1}`).join("\n");
    const newContent = oldContent.replace("line-2", "changed-2").replace("line-18", "changed-18");
    const model = buildEnvironmentDiff("multi.txt", text(oldContent), text(newContent));

    expect(model.hunks.map((hunk) => hunk.header)).toEqual([
      "@@ -1,5 +1,5 @@",
      "@@ -15,6 +15,6 @@",
    ]);
    expect(model.hunks.map((hunk) => hunk.rows.map((row) => row.text))).toEqual([
      ["line-1", "line-2", "changed-2", "line-3", "line-4", "line-5"],
      ["line-15", "line-16", "line-17", "line-18", "changed-18", "line-19", "line-20"],
    ]);
    expect(model.gaps.map((gap) => gap.rows.map((row) => row.text))).toEqual([
      [],
      ["line-6", "line-7", "line-8", "line-9", "line-10", "line-11", "line-12", "line-13", "line-14"],
      [],
    ]);
    expect(model.rows.filter((row) => row.text === "line-8")).toHaveLength(1);
    expect(model.additions).toBe(2);
    expect(model.deletions).toBe(2);
    expect(model.rows.filter((row) => row.kind === "addition")).toHaveLength(model.additions);
    expect(model.rows.filter((row) => row.kind === "deletion")).toHaveLength(model.deletions);
  });
});
