/**
 * The committed golden: a scripted document, derived against the boxes pack
 * and compiled, byte-for-byte. It pins derive + compile + the pack's op
 * semantics together — the strongest single tripwire for an accidental
 * change in timing, mapping, or step shape. Update deliberately with
 * `pnpm vitest run -u` and review the diff like a contract change.
 */

import { BOXES_PACK, type Placements } from "@dumbshow/boxes";
import { type ComposerDoc, derive, emptyDoc } from "@dumbshow/core";
import { expect, it } from "vitest";

function scripted(): ComposerDoc {
  const doc = emptyDoc(BOXES_PACK);
  doc.title = "Golden board";
  doc.timeline = [
    { kind: "chapter", title: "Board" },
    { kind: "op", op: "add", args: { name: "alpha" } },
    { kind: "op", op: "add", args: { name: "beta" } },
    { kind: "beat", secs: 0.5 },
    { kind: "op", op: "link", args: { a: "alpha", b: "beta" } },
    { kind: "op", op: "pulse", args: { name: "beta" } },
    { kind: "chapter", title: "Teardown" },
    { kind: "op", op: "unlink", args: { pair: "alpha beta" }, silent: true },
    { kind: "op", op: "remove", args: { name: "alpha" } },
    { kind: "op", op: "link", args: { a: "alpha", b: "beta" } }, // alpha is gone: skipped
    { kind: "chapter", title: "Never opens" },
  ];
  doc.placements = { boxes: { beta: { x: 240, y: -60 } } } satisfies Placements;
  return doc;
}

it("derives and compiles the scripted board exactly as before", async () => {
  const d = derive(scripted(), BOXES_PACK);
  const golden = {
    mapping: d.mapping,
    chapters: d.chapters,
    seedStep: d.seedStep,
    world: d.world,
    steps: d.steps,
    compiled: d.compiled,
  };
  await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot(
    "./__snapshots__/boxes-board.golden.json",
  );
});
