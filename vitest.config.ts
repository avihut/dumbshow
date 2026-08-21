import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// vite.config.ts roots the dev server at harness/ and configures the library
// build; neither shape suits test discovery, so vitest gets its own config.
// The suite imports pure modules (engine, document model, transcript, the
// boxes pack) and runs in node — no DOM. The vue plugin is here so a test
// may import the package entry (which re-exports the editor components)
// without tripping over SFC syntax.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
