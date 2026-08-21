/**
 * @dumbshow/vue — the Vue editor over @dumbshow/core.
 *
 * `ComposerApp` is the full-window editor (timeline, catalog, canvas, shell,
 * attributes, exports); `AttributesForm` is the timeline-item attributes
 * pane a pack's inspector composes beside its own entity attributes. The
 * document model, engine, contract, exporters, and the editor-level types
 * (selections, host chrome) are `@dumbshow/core` (a peer); the editor
 * chrome stylesheet is `@dumbshow/core/style.css`.
 */

export { default as AttributesForm } from "./AttributesForm.vue";
export { default as ComposerApp } from "./ComposerApp.vue";
