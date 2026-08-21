import {
  type ComposerDoc,
  emptyDoc,
  freezePlacements,
  insertItem,
  moveItem,
  removeItem,
  replaceOp,
  setArgs,
  setBeatSecs,
  setChapterTitle,
  setRepoPlacement,
  setSilent,
  setTitle,
  setWtPlacement,
} from "@dumbshow/core";
import { describe, expect, it } from "vitest";

function sample(): ComposerDoc {
  const doc = emptyDoc();
  doc.timeline = [
    { kind: "op", op: "add", args: { name: "alpha" } },
    { kind: "chapter", title: "Two" },
    { kind: "beat", secs: 1 },
  ];
  return doc;
}

const kinds = (doc: ComposerDoc): string[] => doc.timeline.map((i) => i.kind);

describe("mutations are pure", () => {
  it("never touch the input document", () => {
    const doc = sample();
    const before = structuredClone(doc);
    insertItem(doc, 0, { kind: "beat", secs: 2 });
    moveItem(doc, 0, 2);
    removeItem(doc, 1);
    setArgs(doc, 0, { name: "beta" });
    replaceOp(doc, 0, "link", { a: "x", b: "y" });
    setSilent(doc, 0, true);
    setChapterTitle(doc, 1, "Renamed");
    setBeatSecs(doc, 2, 5);
    setTitle(doc, "New");
    setRepoPlacement(doc, "alpha", { x: 1, y: 2 });
    setWtPlacement(doc, "alpha:main", { ang: 1, dist: 2 });
    freezePlacements(doc, { repos: { alpha: { x: 9, y: 9 } }, wts: {} });
    expect(doc).toEqual(before);
  });

  it("return the very same document when the gesture means nothing", () => {
    const doc = sample();
    expect(moveItem(doc, 0, 0)).toBe(doc);
    expect(moveItem(doc, 7, 0)).toBe(doc);
    expect(removeItem(doc, 99)).toBe(doc);
    expect(setArgs(doc, 1, {})).toBe(doc); // a chapter has no args
    expect(replaceOp(doc, 2, "add", {})).toBe(doc); // a beat is not an op
    expect(setSilent(doc, 0, false)).toBe(doc); // already audible
    expect(setChapterTitle(doc, 0, "x")).toBe(doc);
    expect(setBeatSecs(doc, 0, 3)).toBe(doc);
  });
});

describe("timeline mutations", () => {
  it("insert with a clamped index and copy the item", () => {
    const doc = sample();
    const item = { kind: "beat" as const, secs: 2 };
    expect(insertItem(doc, -5, item).timeline[0]).toEqual(item);
    expect(insertItem(doc, 99, item).timeline.at(-1)).toEqual(item);
    const next = insertItem(doc, 1, item);
    expect(kinds(next)).toEqual(["op", "beat", "chapter", "beat"]);
    item.secs = 9;
    expect(next.timeline[1]).toEqual({ kind: "beat", secs: 2 });
  });

  it("move with drop semantics measured after the removal", () => {
    const doc = sample();
    expect(kinds(moveItem(doc, 0, 2))).toEqual(["chapter", "beat", "op"]);
    expect(kinds(moveItem(doc, 2, 0))).toEqual(["beat", "op", "chapter"]);
    expect(kinds(removeItem(doc, 1))).toEqual(["op", "beat"]);
  });

  it("edit ops in place: args, an op swap that keeps silence, silent toggles", () => {
    let doc = setSilent(sample(), 0, true);
    expect(doc.timeline[0]).toMatchObject({ silent: true });
    doc = replaceOp(doc, 0, "remove", { name: "alpha" });
    expect(doc.timeline[0]).toEqual({
      kind: "op",
      op: "remove",
      args: { name: "alpha" },
      silent: true,
    });
    doc = setArgs(doc, 0, { name: "beta" });
    expect(doc.timeline[0]).toMatchObject({ args: { name: "beta" } });
    doc = setSilent(doc, 0, false);
    expect(doc.timeline[0]).not.toHaveProperty("silent");
  });

  it("clamp beat seconds to 0.1..10 and retitle chapters", () => {
    const doc = sample();
    expect(setBeatSecs(doc, 2, 0).timeline[2]).toEqual({
      kind: "beat",
      secs: 0.1,
    });
    expect(setBeatSecs(doc, 2, 99).timeline[2]).toEqual({
      kind: "beat",
      secs: 10,
    });
    expect(setChapterTitle(doc, 1, "Three").timeline[1]).toEqual({
      kind: "chapter",
      title: "Three",
    });
  });

  it("trim titles and fall back to the default", () => {
    expect(setTitle(sample(), "  Hello ").title).toBe("Hello");
    expect(setTitle(sample(), "   ").title).toBe("Untitled scenario");
  });
});

describe("placements", () => {
  it("pin and unpin repos and worktrees", () => {
    let doc = setRepoPlacement(sample(), "alpha", { x: 1.5, y: -2 });
    doc = setWtPlacement(doc, "alpha:main", { ang: 0.5, dist: 120 });
    expect(doc.placements).toEqual({
      repos: { alpha: { x: 1.5, y: -2 } },
      wts: { "alpha:main": { ang: 0.5, dist: 120 } },
    });
    doc = setRepoPlacement(doc, "alpha", null);
    doc = setWtPlacement(doc, "alpha:main", null);
    expect(doc.placements).toEqual({ repos: {}, wts: {} });
  });

  it("freeze derived geometry without overriding author pins", () => {
    const doc = setRepoPlacement(sample(), "alpha", { x: 1, y: 1 });
    const frozen = freezePlacements(doc, {
      repos: { alpha: { x: 9, y: 9 }, beta: { x: 5, y: 5 } },
      wts: { "beta:main": { ang: 1, dist: 2 } },
    });
    expect(frozen.placements.repos).toEqual({
      alpha: { x: 1, y: 1 },
      beta: { x: 5, y: 5 },
    });
    expect(frozen.placements.wts).toEqual({ "beta:main": { ang: 1, dist: 2 } });
  });
});
