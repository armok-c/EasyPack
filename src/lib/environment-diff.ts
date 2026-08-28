import { diffChars, structuredPatch, type StructuredPatch, type StructuredPatchHunk } from "diff";

import type { EnvironmentFileContent } from "@/lib/environment-types";

export type EnvironmentDiffChangeKind = "unchanged" | "created" | "deleted" | "modified" | "unavailable";
export type EnvironmentDiffRowKind = "context" | "addition" | "deletion";

export interface EnvironmentDiffSegment {
  text: string;
  changed: boolean;
}

export interface EnvironmentDiffRow {
  kind: EnvironmentDiffRowKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  text: string;
  segments: EnvironmentDiffSegment[];
  lineEnding: "lf" | "crlf";
  noNewline: boolean;
}

export interface EnvironmentDiffHunk {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  rows: EnvironmentDiffRow[];
}

export interface EnvironmentDiffGap {
  index: number;
  rows: EnvironmentDiffRow[];
}

export interface EnvironmentDiffModel {
  path: string;
  old: EnvironmentFileContent;
  new: EnvironmentFileContent;
  available: boolean;
  rows: EnvironmentDiffRow[];
  hunks: EnvironmentDiffHunk[];
  gaps: EnvironmentDiffGap[];
  additions: number | null;
  deletions: number | null;
  hasContentChange: boolean;
  hasStateChange: boolean;
  changeKind: EnvironmentDiffChangeKind;
}

interface ParsedPatchHunk {
  source: StructuredPatchHunk;
  rows: EnvironmentDiffRow[];
}

function textContent(file: EnvironmentFileContent): string {
  return file.state === "text" ? file.content ?? "" : "";
}

function changeKind(
  current: EnvironmentFileContent,
  snapshot: EnvironmentFileContent,
  hasContentChange: boolean,
  hasStateChange: boolean,
  available: boolean,
): EnvironmentDiffChangeKind {
  if (!available) return "unavailable";
  if (current.state === "absent" && snapshot.state === "text") return "created";
  if (current.state === "text" && snapshot.state === "absent") return "deleted";
  if (hasContentChange || hasStateChange) return "modified";
  return "unchanged";
}

function blankModel(
  path: string,
  current: EnvironmentFileContent,
  snapshot: EnvironmentFileContent,
  available: boolean,
  additions: number | null,
  deletions: number | null,
  hasContentChange: boolean,
  hasStateChange: boolean,
  kind: EnvironmentDiffChangeKind,
): EnvironmentDiffModel {
  return {
    path,
    old: current,
    new: snapshot,
    available,
    rows: [],
    hunks: [],
    gaps: [],
    additions,
    deletions,
    hasContentChange,
    hasStateChange,
    changeKind: kind,
  };
}

function parsePatch(patch: StructuredPatch): ParsedPatchHunk[] {
  return patch.hunks.map((source) => {
    const rows: EnvironmentDiffRow[] = [];
    let oldLineNumber = source.oldStart;
    let newLineNumber = source.newStart;

    for (const line of source.lines) {
      if (line === "\\ No newline at end of file") {
        const previous = rows[rows.length - 1];
        if (previous) previous.noNewline = true;
        continue;
      }

      const prefix = line[0];
      if (prefix !== " " && prefix !== "+" && prefix !== "-") continue;
      const rawText = line.slice(1);
      const lineEnding = rawText.endsWith("\r") ? "crlf" : "lf";
      const row: EnvironmentDiffRow = {
        kind: prefix === "+" ? "addition" : prefix === "-" ? "deletion" : "context",
        oldLineNumber: prefix === "+" ? null : oldLineNumber,
        newLineNumber: prefix === "-" ? null : newLineNumber,
        text: lineEnding === "crlf" ? rawText.slice(0, -1) : rawText,
        segments: [],
        lineEnding,
        noNewline: false,
      };
      row.segments = [{ text: row.text, changed: row.kind !== "context" }];
      rows.push(row);
      if (prefix !== "+") oldLineNumber += 1;
      if (prefix !== "-") newLineNumber += 1;
    }

    return { source, rows };
  });
}

function pairSegments(oldText: string, newText: string): [EnvironmentDiffSegment[], EnvironmentDiffSegment[]] {
  const oldSegments: EnvironmentDiffSegment[] = [];
  const newSegments: EnvironmentDiffSegment[] = [];
  for (const change of diffChars(oldText, newText)) {
    if (change.added) {
      newSegments.push({ text: change.value, changed: true });
    } else if (change.removed) {
      oldSegments.push({ text: change.value, changed: true });
    } else {
      oldSegments.push({ text: change.value, changed: false });
      newSegments.push({ text: change.value, changed: false });
    }
  }
  return [oldSegments, newSegments];
}

function addInlineSegments(rows: EnvironmentDiffRow[]): void {
  let index = 0;
  while (index < rows.length) {
    if (rows[index].kind === "context") {
      index += 1;
      continue;
    }

    const start = index;
    while (index < rows.length && rows[index].kind !== "context") index += 1;
    const block = rows.slice(start, index);
    const deletions = block.filter((row) => row.kind === "deletion");
    const additions = block.filter((row) => row.kind === "addition");
    const pairs = Math.min(deletions.length, additions.length);
    for (let pair = 0; pair < pairs; pair += 1) {
      const [oldSegments, newSegments] = pairSegments(deletions[pair].text, additions[pair].text);
      deletions[pair].segments = oldSegments;
      additions[pair].segments = newSegments;
    }
  }
}

function sameRow(left: EnvironmentDiffRow, right: EnvironmentDiffRow): boolean {
  return left.kind === right.kind
    && left.oldLineNumber === right.oldLineNumber
    && left.newLineNumber === right.newLineNumber
    && left.text === right.text
    && left.lineEnding === right.lineEnding
    && left.noNewline === right.noNewline;
}

function findHunkRange(
  rows: EnvironmentDiffRow[],
  expectedRows: EnvironmentDiffRow[],
  searchFrom: number,
): [number, number] | null {
  if (expectedRows.length === 0) return null;
  for (let start = searchFrom; start + expectedRows.length <= rows.length; start += 1) {
    if (expectedRows.every((row, offset) => sameRow(rows[start + offset], row))) {
      return [start, start + expectedRows.length];
    }
  }
  return null;
}

function hunkHeader(source: StructuredPatchHunk): string {
  const oldStart = source.oldLines === 0 ? source.oldStart - 1 : source.oldStart;
  const newStart = source.newLines === 0 ? source.newStart - 1 : source.newStart;
  return `@@ -${oldStart},${source.oldLines} +${newStart},${source.newLines} @@`;
}

/** Build the one authoritative current(old) -> snapshot(new) diff model. */
export function buildEnvironmentDiff(
  path: string,
  current: EnvironmentFileContent,
  snapshot: EnvironmentFileContent,
): EnvironmentDiffModel {
  const available = current.state !== "nonUtf8" && snapshot.state !== "nonUtf8";
  const oldContent = textContent(current);
  const newContent = textContent(snapshot);
  const hasContentChange = available && oldContent !== newContent;
  const hasStateChange = current.state !== snapshot.state;
  const kind = changeKind(current, snapshot, hasContentChange, hasStateChange, available);

  if (!available) return blankModel(path, current, snapshot, false, null, null, false, hasStateChange, kind);

  const compactPatch = structuredPatch(path, path, oldContent, newContent, "", "", {
    context: 3,
    stripTrailingCr: false,
  });
  const completePatch = structuredPatch(path, path, oldContent, newContent, "", "", {
    context: Infinity,
    stripTrailingCr: false,
  });
  const completeHunks = parsePatch(completePatch);
  const rows = completeHunks.flatMap((hunk) => hunk.rows);
  addInlineSegments(rows);
  const additions = rows.filter((row) => row.kind === "addition").length;
  const deletions = rows.filter((row) => row.kind === "deletion").length;

  if (!hasContentChange) return blankModel(path, current, snapshot, true, additions, deletions, false, hasStateChange, kind);

  const hunks: EnvironmentDiffHunk[] = [];
  const ranges: [number, number][] = [];
  let searchFrom = 0;
  for (const [index, parsed] of parsePatch(compactPatch).entries()) {
    const range = findHunkRange(rows, parsed.rows, searchFrom);
    if (!range) {
      return blankModel(path, current, snapshot, false, null, null, hasContentChange, hasStateChange, "unavailable");
    }
    ranges.push(range);
    searchFrom = range[1];
    hunks.push({
      index,
      oldStart: parsed.source.oldStart,
      oldLines: parsed.source.oldLines,
      newStart: parsed.source.newStart,
      newLines: parsed.source.newLines,
      header: hunkHeader(parsed.source),
      rows: rows.slice(range[0], range[1]),
    });
  }

  const gaps: EnvironmentDiffGap[] = [];
  let cursor = 0;
  for (const [index, [start, end]] of ranges.entries()) {
    gaps.push({ index, rows: rows.slice(cursor, start) });
    cursor = end;
  }
  gaps.push({ index: ranges.length, rows: rows.slice(cursor) });

  return {
    path,
    old: current,
    new: snapshot,
    available: true,
    rows,
    hunks,
    gaps,
    additions,
    deletions,
    hasContentChange,
    hasStateChange,
    changeKind: kind,
  };
}
