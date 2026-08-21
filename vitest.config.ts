import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./workspace-aliases.ts";

// The workspace suite lives in tests/ and imports the packages by name; the
// aliases point those names at the sources, so no build precedes a test run.
// The suite is pure modules (engine, document model, transcript, the boxes
// pack) and runs in node — no DOM. The vue plugin is here so a test may
// import @dumbshow/vue (SFC syntax) without tripping.
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: workspaceAliases(import.meta.dirname) },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
