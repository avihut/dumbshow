/**
 * The stylesheet entry. Vite's library mode refuses a bare CSS entry, so
 * this module exists only to carry the editor chrome CSS into
 * dist/style.css (exported as `@dumbshow/core/style.css`) without
 * index.js importing it. The build discards the empty JS chunk it emits
 * and the declaration build excludes it.
 */
import "./editor/editor.css";
