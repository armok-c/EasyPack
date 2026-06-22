import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // IN-02 (Phase 22 review): also exclude .planning/ so stray generated
    // fixtures (e.g. ad-hoc .test.ts files produced by the GSD workflow)
    // cannot be picked up by vitest's glob.
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.planning/**"],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
