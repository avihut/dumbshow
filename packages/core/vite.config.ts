import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library build only (the dev app lives in apps/harness-vue): ESM, nothing
// externalized — the core has no framework and bundles its one dependency.
// The stylesheet rides its own entry (src/style.ts) so the editor chrome CSS
// lands in dist/style.css (exported as ./style.css) without index.js
// importing it; the empty style.js chunk is dropped by the build script.
// Declarations come from tsc (package build script).
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        style: resolve(import.meta.dirname, "src/style.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "style",
    },
  },
});
