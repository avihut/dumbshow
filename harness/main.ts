/**
 * The harness — the editor mounted with the boxes reference pack, the
 * package's second consumer. Anything daft-shaped that leaks into the
 * generic machinery fails to compile or render here first.
 */

import { createApp } from "vue";
import { ComposerApp } from "../src";
import BoxesInspector from "./BoxesInspector.vue";
import { BOXES_PACK } from "./boxes-pack";

createApp(ComposerApp, {
  lang: BOXES_PACK,
  inspector: BoxesInspector,
  devHandle: "__dumbshowPlayer",
}).mount("#app");
