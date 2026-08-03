/**
 * @avihut/dumbshow — public entry.
 *
 * dumbshow is a semantic-animation composer: a language pack defines the
 * entities, verbs, and renderings; this package provides everything
 * around that meaning —
 *
 * - the language contract (`DiagramLanguage` and every hook shape a pack
 *   implements),
 * - the engine (timeline compiler + headless event-sourced player),
 * - the render core (replay cursor, camera/view math, canvas attachment),
 * - the transcript projection of a compiled timeline,
 * - the editor (`ComposerApp` and its document model: doc, derive,
 *   mutations, storage, vocabulary, drag-and-drop),
 * - exports (offline renderer, PNG/GIF/webm encoders, compiled script).
 *
 * The stylesheet ships separately: `import "@avihut/dumbshow/style.css"`.
 */

export {
  default as AttributesForm,
  type EditorSelection,
  type ItemSelection,
} from "./composer/AttributesForm.vue";
export { default as ComposerApp } from "./composer/ComposerApp.vue";
export * from "./composer/derive";
export * from "./composer/dnd";
export * from "./composer/doc";
export * from "./composer/export/gif";
export * from "./composer/export/offline";
export * from "./composer/export/png";
export * from "./composer/export/script";
export * from "./composer/export/webm";
export * from "./composer/mutations";
export * from "./composer/storage";
export type { BackLink, ExportEntry } from "./composer/Toolbar.vue";
export * from "./composer/vocabulary";
export * from "./engine";
export * from "./language";
export * from "./render-core";
export * from "./transcript";
