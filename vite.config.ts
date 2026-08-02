import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// One config, two faces: `vite` serves the harness dev app (the editor
// mounted with the boxes reference pack); `vite build` produces the
// library — ESM, vue externalized, d.ts via vue-tsc (see package build).
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  root: command === "serve" ? "harness" : undefined,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: "dumbshow",
      formats: ["es"],
      fileName: "dumbshow",
      cssFileName: "dumbshow",
    },
    rollupOptions: {
      external: ["vue"],
      output: { globals: { vue: "Vue" } },
    },
  },
}));
