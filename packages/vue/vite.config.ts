import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Library build only (the dev app lives in apps/harness-vue): ESM with vue
// and @dumbshow/core externalized — both are peers the host provides. No
// stylesheet ships from here; the editor chrome CSS is @dumbshow/core's
// ./style.css. Declarations come from vue-tsc (package build script).
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue", /^@dumbshow\/core(\/|$)/],
    },
  },
});
