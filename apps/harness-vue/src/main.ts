/**
 * The Vue harness — @dumbshow/vue's editor mounted with the boxes reference
 * pack, the packages' second consumer. Anything pack-shaped that leaks into
 * the generic machinery fails to compile or render here first.
 */

import "@dumbshow/core/style.css";
import { BOXES_PACK } from "@dumbshow/boxes";
import { ComposerApp } from "@dumbshow/vue";
import { createApp } from "vue";
import BoxesInspector from "./BoxesInspector.vue";

createApp(ComposerApp, {
  lang: BOXES_PACK,
  inspector: BoxesInspector,
  devHandle: "__dumbshowPlayer",
}).mount("#app");
