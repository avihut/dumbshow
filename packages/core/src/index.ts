/**
 * @dumbshow/core — the framework-free half of dumbshow.
 *
 * dumbshow is a semantic-animation composer: a language pack defines the
 * entities, verbs, and renderings; this package provides everything
 * around that meaning that does not depend on a UI framework —
 *
 * - the language contract (`DiagramLanguage` and every hook shape a pack
 *   implements),
 * - the engine (timeline compiler + headless event-sourced player),
 * - the render core (replay cursor, camera/view math, canvas attachment),
 * - the transcript projection of a compiled timeline,
 * - the editor's document model (doc, derive, mutations, storage,
 *   vocabulary, drag-and-drop mechanics) — the model every framework's
 *   editor is a view over,
 * - exports (offline renderer, PNG/GIF/webm encoders, compiled script).
 *
 * The editor UI is a separate package per framework (`@dumbshow/vue`). The
 * editor chrome stylesheet ships from here: `import "@dumbshow/core/style.css"`.
 */

export * from "./editor/derive";
export * from "./editor/dnd";
export * from "./editor/doc";
export * from "./editor/mutations";
export * from "./editor/storage";
export * from "./editor/vocabulary";
export * from "./engine";
export * from "./export/gif";
export * from "./export/offline";
export * from "./export/png";
export * from "./export/script";
export * from "./export/webm";
export * from "./language";
export * from "./render-core";
export * from "./transcript";
