import { describe, expect, it } from "vitest";
import { BOXES_PACK } from "../harness/boxes-pack";
import { derive, withCamsOf } from "../src/composer/derive";
import { type ComposerDoc, type DocItem, emptyDoc } from "../src/composer/doc";

function docOf(...items: DocItem[]): ComposerDoc {
  const doc = emptyDoc();
  doc.timeline = items;
  return doc;
}

const op = (op: string, args: Record<string, unknown> = {}): DocItem => ({
  kind: "op",
  op,
  args,
});

describe("derive", () => {
  it("derives nothing from an empty document", () => {
    const d = derive(emptyDoc(), BOXES_PACK);
    expect(d.steps).toEqual([]);
    expect(d.seedStep).toBe(false);
    expect(d.mapping).toEqual([]);
    expect(d.chapters).toEqual([]);
    expect(d.compiled.steps).toEqual([]);
  });

  it("maps every item to its step and skips unavailable ops cleanly", () => {
    const d = derive(
      docOf(
        op("link", { a: "alpha", b: "beta" }), // nothing to link yet
        op("add", { name: "alpha" }),
        op("add", { name: "beta" }),
        op("link", { a: "alpha", b: "beta" }),
      ),
      BOXES_PACK,
    );
    expect(d.mapping).toEqual([-1, 0, 1, 2]);
    expect(d.steps.map((s) => s.title)).toEqual([
      "Add alpha",
      "Add beta",
      "Link alpha and beta",
    ]);
    expect(d.world.links).toEqual([["alpha", "beta"]]);
    expect(d.compiled.steps).toHaveLength(3);
  });

  it("snapshots the world before each item, as copies", () => {
    const d = derive(
      docOf(op("add", { name: "alpha" }), op("add", { name: "beta" })),
      BOXES_PACK,
    );
    expect(d.worlds.map((w) => w.boxes.map((b) => b.name))).toEqual([
      [],
      ["alpha"],
    ]);
    expect(d.world.boxes.map((b) => b.name)).toEqual(["alpha", "beta"]);
    d.worlds[1].boxes.push({ name: "ghost", x: 0, y: 0 });
    expect(d.world.boxes).toHaveLength(2);
  });

  it("binds chapters to the step that follows and beats to the step before", () => {
    const d = derive(
      docOf(
        { kind: "beat", secs: 2 }, // no step to stretch yet
        { kind: "chapter", title: "Open" },
        op("add", { name: "alpha" }),
        { kind: "beat", secs: 3 },
        { kind: "chapter", title: "Dangling" },
      ),
      BOXES_PACK,
    );
    expect(d.mapping).toEqual([-1, 0, 0, 0, -1]);
    expect(d.chapters).toEqual([
      { title: "Open", item: 1, step: 0 },
      { title: "Dangling", item: 4, step: -1 },
    ]);
    expect(d.steps[0].beats.at(-1)).toEqual({ pause: 3 });
  });

  it("marks silent ops on their step and hides their terminal lines", () => {
    const d = derive(
      docOf({ kind: "op", op: "add", args: { name: "alpha" }, silent: true }),
      BOXES_PACK,
    );
    expect(d.steps[0].silent).toBe(true);
    expect(d.compiled.term.length).toBeGreaterThan(0);
    expect(d.compiled.term.every((l) => l.hidden)).toBe(true);
    expect(d.compiled.steps[0].silent).toBe(true);
  });

  it("opens with a seed step only when the seed declares something", () => {
    const doc = docOf(op("add", { name: "alpha" }));
    doc.seed.rels = [["a", "b"]];
    const d = derive(doc, BOXES_PACK);
    expect(d.seedStep).toBe(true);
    expect(d.steps[0].title).toBe("Scene");
    expect(d.mapping).toEqual([1]);
  });

  it("feeds author pins into the world through placements", () => {
    const doc = docOf(op("add", { name: "alpha" }));
    doc.placements.repos.alpha = { x: 123, y: -45 };
    const d = derive(doc, BOXES_PACK);
    expect(d.world.boxes[0]).toEqual({ name: "alpha", x: 123, y: -45 });
    expect(BOXES_PACK.placements.fromCompiled(d.compiled)).toEqual({
      repos: { alpha: { x: 123, y: -45 } },
      wts: {},
    });
  });
});

describe("withCamsOf", () => {
  it("copies cameras by step index and leaves steps the base lacks alone", () => {
    const base = derive(docOf(op("add", { name: "alpha" })), BOXES_PACK).steps;
    const moved = docOf(
      op("add", { name: "alpha" }),
      op("add", { name: "beta" }),
    );
    moved.placements.repos.alpha = { x: 900, y: 900 };
    const steps = derive(moved, BOXES_PACK).steps;

    const out = withCamsOf(steps, base);
    expect(steps[0].cam).not.toEqual(base[0].cam); // the preview re-fit
    expect(out[0].cam).toEqual(base[0].cam); // ...but keeps the base frame
    expect(out[0].beats).toEqual(steps[0].beats);
    expect(out[1]).toBe(steps[1]);
  });

  it("copies per-beat cameras by beat index", () => {
    const cam = (x: number) => ({ x, y: 0, w: 100, h: 100 });
    const base = [{ title: "b", cam: cam(1), beats: [{ cam: cam(2) }] }];
    const steps = [
      { title: "s", cam: cam(10), beats: [{ cam: cam(20) }, { cam: cam(30) }] },
    ];
    const out = withCamsOf(steps, base);
    expect(out[0].cam).toEqual(cam(1));
    expect(out[0].beats).toEqual([{ cam: cam(2) }, { cam: cam(30) }]);
  });
});
