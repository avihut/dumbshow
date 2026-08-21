import { resolve } from "node:path";

/**
 * The source-link map: every workspace package name resolved to its source
 * entry, so the harness and the test suite run against `src/` with no build
 * step. One definition, shared by vitest.config.ts and the harness's
 * vite.config.ts (hosts that develop against a checkout mirror the same
 * map). The style alias comes first so the bare-name pattern cannot
 * swallow it.
 */
export function workspaceAliases(
  root: string,
): { find: RegExp; replacement: string }[] {
  return [
    {
      find: /^@dumbshow\/core\/style\.css$/,
      replacement: resolve(root, "packages/core/src/editor/editor.css"),
    },
    {
      find: /^@dumbshow\/core$/,
      replacement: resolve(root, "packages/core/src/index.ts"),
    },
    {
      find: /^@dumbshow\/vue$/,
      replacement: resolve(root, "packages/vue/src/index.ts"),
    },
    {
      find: /^@dumbshow\/boxes$/,
      replacement: resolve(root, "packages/boxes/src/index.ts"),
    },
  ];
}
