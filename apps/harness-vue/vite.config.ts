import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { workspaceAliases } from "../../workspace-aliases.ts";

// The harness is a plain Vite app; the workspace packages resolve to their
// sources (one alias map, shared with vitest), so editor and core edits
// hot-reload here with no build in between.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: workspaceAliases(resolve(import.meta.dirname, "../..")),
  },
});
