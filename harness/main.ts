/**
 * The harness — the editor mounted with the boxes reference pack.
 *
 * Once the extraction lands the editor in src/, this becomes:
 *
 *   import { createApp } from "vue";
 *   import { ComposerApp } from "../src";
 *   import "../src/composer.css";
 *   import { BOXES_PACK, BoxesInspector } from "./boxes-pack";
 *   createApp(ComposerApp, { lang: BOXES_PACK, inspector: BoxesInspector })
 *     .mount("#app");
 *
 * Until then it renders a status note so `mise run dev` proves the
 * toolchain end to end.
 */

import { VERSION } from "../src/index";
import { BOXES_PACK } from "./boxes-pack";

const app = document.querySelector("#app");
if (app) {
  const main = document.createElement("main");
  main.style.cssText = "max-width: 60ch; margin: 4rem auto; line-height: 1.6";
  const h1 = document.createElement("h1");
  h1.textContent = "dumbshow harness";
  const p = document.createElement("p");
  const ops = BOXES_PACK.ops.map((o) => o.id).join(", ");
  p.textContent =
    `Package scaffold v${VERSION}. The editor arrives with the extraction; ` +
    `the boxes reference pack is already here with ` +
    `${BOXES_PACK.ops.length} ops (${ops}).`;
  main.append(h1, p);
  app.append(main);
}
