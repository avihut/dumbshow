/**
 * The boxes pack is the contract's honesty check: the smallest language that
 * implements every hook. These tests pin that role — if a hook goes
 * unimplemented here, the editor has a path no second consumer exercises.
 */

import { BOXES_PACK, type Hit, type World } from "@dumbshow/boxes";
import { describe, expect, it } from "vitest";

function world(names: string[], links: [string, string][] = []): World {
  return {
    boxes: names.map((name, i) => ({ name, x: i * 100, y: 0 })),
    links,
    pins: {},
  };
}

describe("the boxes pack implements the whole contract", () => {
  it("provides every entity hook the editor can call, optional ones included", () => {
    const e = BOXES_PACK.entities;
    expect(Array.isArray(e.elements)).toBe(true);
    for (const hook of [
      e.label,
      e.select,
      e.selectionOverlay,
      e.hoverOverlay,
      e.dragOverlay,
      e.canvasDrop,
    ])
      expect(typeof hook).toBe("function");
  });

  it("speaks a shell", () => {
    expect(typeof BOXES_PACK.parseCommand).toBe("function");
    expect(typeof BOXES_PACK.shellVerb).toBe("function");
    expect(BOXES_PACK.shellInputLabel).toMatch(/box/);
    expect(BOXES_PACK.shellVerb?.("box add x")).toBe("box");
    expect(BOXES_PACK.shellVerb?.("ls")).toBe("");
  });

  it("owns both halves of the document's pack JSON", () => {
    for (const hook of [
      BOXES_PACK.seed.empty,
      BOXES_PACK.seed.parse,
      BOXES_PACK.seed.world,
      BOXES_PACK.seed.step,
      BOXES_PACK.placements.empty,
      BOXES_PACK.placements.parse,
      BOXES_PACK.placements.patchStep,
      BOXES_PACK.placements.fromCompiled,
    ])
      expect(typeof hook).toBe("function");
  });

  it("round-trips its own blanks through its own parsers", () => {
    const { seed, placements } = BOXES_PACK;
    expect(seed.parse(seed.empty())).toEqual(seed.empty());
    expect(placements.parse(placements.empty())).toEqual(placements.empty());
  });

  it("refuses JSON that is not its schema, saying what is wrong", () => {
    const { seed, placements } = BOXES_PACK;
    expect(() => seed.parse({ boxes: [{}], links: [] })).toThrow(/no name/);
    expect(() => seed.parse({ boxes: [], links: [["a"]] })).toThrow(/pair/);
    // The shape format v1 carried is another pack's, and reads as malformed.
    expect(() => seed.parse({ repos: [], rels: [] })).toThrow(/not a list/);
    expect(() => placements.parse({ boxes: { a: { x: 1 } } })).toThrow(
      /malformed/,
    );
  });

  it("opens no scene from a seed that declares nothing", () => {
    const { seed, placements } = BOXES_PACK;
    const blank = placements.empty();
    expect(seed.step(seed.world(seed.empty(), blank), blank)).toBeNull();
  });

  it("registers verbs and one event", () => {
    expect(BOXES_PACK.ops.map((o) => [o.id, o.kind])).toEqual([
      ["add", "verb"],
      ["link", "verb"],
      ["unlink", "verb"],
      ["remove", "verb"],
      ["pulse", "event"],
    ]);
  });
});

describe("ops", () => {
  it("gate availability on the world", () => {
    const by = (id: string) => BOXES_PACK.ops.find((o) => o.id === id);
    expect(by("add")?.available(world([]))).toBe(true);
    expect(by("link")?.available(world(["alpha"]))).toBe(false);
    expect(by("link")?.available(world(["alpha", "beta"]))).toBe(true);
    expect(
      by("link")?.available(world(["alpha", "beta"], [["alpha", "beta"]])),
    ).toBe(false);
    expect(by("unlink")?.available(world(["alpha", "beta"]))).toBe(false);
    expect(by("remove")?.available(world([]))).toBe(false);
    expect(by("pulse")?.available(world(["alpha"]))).toBe(true);
  });

  it("round-trip every verb through the shell: parse(command(args)) is the same call", () => {
    const w = world(["alpha", "beta", "gamma"], [["alpha", "beta"]]);
    for (const spec of BOXES_PACK.ops) {
      if (spec.kind !== "verb") continue;
      const args: Record<string, unknown> = {};
      for (const f of spec.fields(w)) args[f.key] = f.value;
      const line = spec.command(w, args);
      expect(line, spec.id).not.toBeNull();
      if (!line) continue;
      expect(BOXES_PACK.parseCommand?.(line, w), spec.id).toEqual({
        ok: true,
        op: spec.id,
        args,
      });
    }
  });

  it("events print no command", () => {
    const pulse = BOXES_PACK.ops.find((o) => o.id === "pulse");
    expect(pulse?.command(world(["alpha"]), { name: "alpha" })).toBeNull();
  });

  it("reject unknown lines with a hint", () => {
    const w = world(["alpha"]);
    expect(BOXES_PACK.parseCommand?.("ls", w)).toMatchObject({ ok: false });
    expect(BOXES_PACK.parseCommand?.("box fly", w)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/add, link, unlink, rm/),
    });
    expect(BOXES_PACK.parseCommand?.("box rm nobody", w)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no box named nobody/),
    });
    expect(BOXES_PACK.parseCommand?.("box link alpha", w)).toMatchObject({
      ok: false,
    });
  });

  it("default the next box name and fall back past the alphabet", () => {
    const add = BOXES_PACK.ops.find((o) => o.id === "add");
    expect(add?.fields(world(["alpha", "beta"]))[0].value).toBe("gamma");
    const full = world(["alpha", "beta", "gamma", "delta", "epsilon", "zeta"]);
    expect(add?.fields(full)[0].value).toBe("box7");
  });
});

describe("scene", () => {
  it("applies acts to scene state with birth and removal times", () => {
    const s = BOXES_PACK.scene.createScene();
    BOXES_PACK.scene.applyAct(s, { kind: "box", name: "a", x: 0, y: 0 }, 1);
    BOXES_PACK.scene.applyAct(s, { kind: "box", name: "b", x: 10, y: 0 }, 2);
    BOXES_PACK.scene.applyAct(s, { kind: "link", a: "a", b: "b" }, 3);
    BOXES_PACK.scene.applyAct(s, { kind: "pulse", name: "b" }, 4);
    BOXES_PACK.scene.applyAct(s, { kind: "unbox", name: "a" }, 5);
    expect(s.boxes).toEqual([
      { name: "a", x: 0, y: 0, birth: 1, removed: 5 },
      { name: "b", x: 10, y: 0, birth: 2 },
    ]);
    expect(s.links).toEqual([{ a: "a", b: "b", birth: 3, removed: 5 }]);
    expect(s.pulses).toEqual([{ name: "b", at: 4 }]);
  });

  it("fits the camera around the boxes", () => {
    expect(BOXES_PACK.scene.camFor(world([]))).toEqual({
      x: 0,
      y: 0,
      w: 460,
      h: 400,
    });
    const cam = BOXES_PACK.scene.camFor(world(["a", "b", "c"]));
    expect(cam).toEqual({ x: 100, y: 0, w: 520, h: 400 });
  });

  it("picks the box under the pointer, with a little slack", () => {
    const hits: Hit[] = [
      { name: "a", sx: 10, sy: 10, r: 20 },
      { name: "b", sx: 200, sy: 200, r: 20 },
    ];
    expect(BOXES_PACK.scene.pick(hits, 15, 15)).toBe(hits[0]);
    expect(BOXES_PACK.scene.pick(hits, 223, 200)).toBe(hits[1]);
    expect(BOXES_PACK.scene.pick(hits, 100, 100)).toBeNull();
    expect(BOXES_PACK.entities.label(hits[1])).toBe("b");
    expect(BOXES_PACK.entities.select(hits[1])).toBe(hits[1]);
  });
});
