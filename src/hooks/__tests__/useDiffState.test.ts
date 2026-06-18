import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDiffState } from "@/hooks/useDiffState";

describe("useDiffState", () => {
  describe("markResolved / isHunkResolved", () => {
    it("marks a hunk as resolved for a given fileEnvKey", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
      });

      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(true);
    });

    it("returns false for unresolved hunks", () => {
      const { result } = renderHook(() => useDiffState());

      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(false);
    });

    it("tracks multiple hunks independently", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file1::env1", 2);
      });

      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(true);
      expect(result.current.isHunkResolved("file1::env1", 1)).toBe(false);
      expect(result.current.isHunkResolved("file1::env1", 2)).toBe(true);
    });
  });

  describe("markUnresolved", () => {
    it("marks a resolved hunk back to unresolved", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
      });
      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(true);

      act(() => {
        result.current.markUnresolved("file1::env1", 0);
      });
      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(false);
    });

    it("does nothing for already unresolved hunks", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markUnresolved("file1::env1", 0);
      });

      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(false);
    });
  });

  describe("pushUndo / popUndo", () => {
    it("stores and retrieves an undo snapshot", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.pushUndo("file1::env1", 0, "previous content");
      });

      act(() => {
        const snapshot = result.current.popUndo("file1::env1", 0);
        expect(snapshot).toBe("previous content");
      });
    });

    it("removes snapshot after pop", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.pushUndo("file1::env1", 0, "previous content");
      });

      // First pop returns the snapshot
      act(() => {
        const snapshot = result.current.popUndo("file1::env1", 0);
        expect(snapshot).toBe("previous content");
      });

      // After re-render, the snapshot is removed — second pop returns undefined
      act(() => {
        const snapshot = result.current.popUndo("file1::env1", 0);
        expect(snapshot).toBeUndefined();
      });
    });

    it("returns undefined for non-existent snapshots", () => {
      const { result } = renderHook(() => useDiffState());

      const snapshot = result.current.popUndo("file1::env1", 999);
      expect(snapshot).toBeUndefined();
    });
  });

  describe("clearUndo", () => {
    it("removes all undo snapshots for a given fileEnvKey", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.pushUndo("file1::env1", 0, "content A");
        result.current.pushUndo("file1::env1", 1, "content B");
        result.current.pushUndo("file2::env1", 0, "content C");
      });

      act(() => {
        result.current.clearUndo("file1::env1");
      });

      // file1::env1 snapshots are gone
      act(() => {
        expect(result.current.popUndo("file1::env1", 0)).toBeUndefined();
        expect(result.current.popUndo("file1::env1", 1)).toBeUndefined();
      });
      // file2::env1 snapshots remain
      act(() => {
        expect(result.current.popUndo("file2::env1", 0)).toBe("content C");
      });
    });
  });

  describe("multi-file isolation", () => {
    it("keeps resolved state separate per fileEnvKey", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file2::env1", 0);
        result.current.markResolved("file1::env2", 0);
      });

      expect(result.current.isHunkResolved("file1::env1", 0)).toBe(true);
      expect(result.current.isHunkResolved("file2::env1", 0)).toBe(true);
      expect(result.current.isHunkResolved("file1::env2", 0)).toBe(true);

      // Unrelated pair should not be resolved
      expect(result.current.isHunkResolved("file3::env1", 0)).toBe(false);
    });

    it("keeps undo snapshots separate per fileEnvKey", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.pushUndo("fileA::env1", 0, "A content");
        result.current.pushUndo("fileB::env1", 0, "B content");
      });

      act(() => {
        expect(result.current.popUndo("fileA::env1", 0)).toBe("A content");
      });
      act(() => {
        expect(result.current.popUndo("fileB::env1", 0)).toBe("B content");
      });
    });
  });

  describe("getResolvedCount", () => {
    it("returns 0 when no hunks are resolved", () => {
      const { result } = renderHook(() => useDiffState());

      expect(result.current.getResolvedCount("file1::env1")).toBe(0);
    });

    it("returns the count of resolved hunks", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file1::env1", 1);
        result.current.markResolved("file1::env1", 2);
      });

      expect(result.current.getResolvedCount("file1::env1")).toBe(3);
    });
  });

  describe("getUnresolvedCount", () => {
    it("returns total minus resolved", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file1::env1", 1);
      });

      expect(result.current.getUnresolvedCount("file1::env1", 5)).toBe(3);
    });

    it("returns 0 when total is 0", () => {
      const { result } = renderHook(() => useDiffState());

      expect(result.current.getUnresolvedCount("file1::env1", 0)).toBe(0);
    });
  });

  describe("isAllResolved", () => {
    it("returns true when all hunks are resolved", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file1::env1", 1);
      });

      expect(result.current.isAllResolved("file1::env1", 2)).toBe(true);
    });

    it("returns false when not all hunks are resolved", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
      });

      expect(result.current.isAllResolved("file1::env1", 2)).toBe(false);
    });

    it("returns false when there are no hunks (totalHunks === 0)", () => {
      const { result } = renderHook(() => useDiffState());

      expect(result.current.isAllResolved("file1::env1", 0)).toBe(false);
    });
  });

  describe("hasUnresolved", () => {
    it("returns true when no hunks are resolved", () => {
      const { result } = renderHook(() => useDiffState());

      expect(result.current.hasUnresolved("file1::env1")).toBe(true);
    });

    it("returns false when all hunks are resolved", () => {
      const { result } = renderHook(() => useDiffState());

      act(() => {
        result.current.markResolved("file1::env1", 0);
        result.current.markResolved("file1::env1", 1);
      });

      expect(result.current.hasUnresolved("file1::env1")).toBe(false);
    });
  });

  describe("undoKey", () => {
    it("returns consistent key format", () => {
      const { result } = renderHook(() => useDiffState());

      const key = result.current.undoKey("file1::env1", 3);
      expect(key).toBe("file1::env1::3");
    });
  });
});
