/**
 * The document model under format v2, where `seed` and `placements` are the
 * pack's JSON. Two packs appear here on purpose: the boxes pack, which
 * validates its own schemas, and a stub whose parsers are the identity —
 * the only way to observe that core carries pack JSON across a version bump
 * without touching it.
 */

import { BOXES_PACK, type Placements, type Seed } from "@dumbshow/boxes";
import {
  type ComposerDoc,
  DOC_VERSION,
  type DocSchema,
  emptyDoc,
  parseDoc,
  serializeDoc,
} from "@dumbshow/core";
import { describe, expect, it } from "vitest";

/** A pack that accepts anything and reads nothing. */
const PASSTHROUGH: DocSchema = {
  seed: { empty: () => null, parse: (raw) => raw },
  placements: { empty: () => null, parse: (raw) => raw },
};

describe("document model", () => {
  it("starts empty at the current format version, with the pack's blanks", () => {
    const doc = emptyDoc(BOXES_PACK);
    expect(doc.version).toBe(DOC_VERSION);
    expect(DOC_VERSION).toBe(2);
    expect(doc.title).toBe("Untitled scenario");
    expect(doc.timeline).toEqual([]);
    expect(doc.seed).toEqual({ boxes: [], links: [] });
    expect(doc.placements).toEqual({ boxes: {} });
  });

  it("round-trips through serialize and parse", () => {
    const doc = emptyDoc(BOXES_PACK);
    doc.title = "Round trip";
    doc.timeline.push(
      { kind: "chapter", title: "One" },
      { kind: "op", op: "add", args: { name: "alpha" }, silent: true },
      { kind: "beat", secs: 2 },
    );
    doc.seed = { boxes: [{ name: "alpha", x: 3, y: 4 }], links: [] };
    doc.placements = { boxes: { alpha: { x: 10, y: -20 } } };
    expect(parseDoc(serializeDoc(doc), BOXES_PACK)).toEqual(doc);
  });

  it("serializes as pretty JSON with a trailing newline", () => {
    const text = serializeDoc(emptyDoc(BOXES_PACK));
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "version": ');
    expect(JSON.parse(text).version).toBe(DOC_VERSION);
  });

  it("refuses documents written by a newer composer", () => {
    expect(() =>
      parseDoc(JSON.stringify({ version: DOC_VERSION + 1 }), BOXES_PACK),
    ).toThrow(/newer composer/);
  });

  it("rejects malformed input with a readable reason", () => {
    const parse = (v: unknown) => parseDoc(JSON.stringify(v), BOXES_PACK);
    expect(() => parseDoc("{not json", BOXES_PACK)).toThrow(/not valid JSON/);
    expect(() => parseDoc("[]", BOXES_PACK)).toThrow(/top level/);
    expect(() => parse({ title: "x" })).toThrow(/missing version/);
    expect(() => parse({ version: 2, timeline: [{ kind: "op" }] })).toThrow(
      /names no operation/,
    );
    expect(() =>
      parse({ version: 2, timeline: [{ kind: "mystery" }] }),
    ).toThrow(/unknown kind/);
  });

  it("surfaces the pack's own complaint as this document's failure", () => {
    const parse = (v: unknown) => parseDoc(JSON.stringify(v), BOXES_PACK);
    expect(() =>
      parse({ version: 2, seed: { boxes: [{}], links: [] } }),
    ).toThrow(/Not a composer document: seed — a seed box has no name/);
    expect(() =>
      parse({ version: 2, placements: { boxes: { a: { x: "1" } } } }),
    ).toThrow(/Not a composer document: placements — .*malformed/);
  });

  it("fills defaults and normalizes loose fields", () => {
    const doc = parseDoc(
      JSON.stringify({
        version: 2,
        timeline: [
          { kind: "beat", secs: -3 },
          { kind: "op", op: "add", silent: false },
        ],
      }),
      BOXES_PACK,
    );
    expect(doc.title).toBe("Untitled scenario");
    expect(doc.timeline[0]).toEqual({ kind: "beat", secs: 1 });
    expect(doc.timeline[1]).toEqual({ kind: "op", op: "add", args: {} });
    // Absent halves become the pack's blanks, never `undefined`.
    expect(doc.seed).toEqual({ boxes: [], links: [] });
    expect(doc.placements).toEqual({ boxes: {} });
  });

  it("keeps only the fields the pack's seed schema declares", () => {
    const doc = parseDoc(
      JSON.stringify({
        version: 2,
        seed: {
          boxes: [{ name: "alpha", x: 5, y: 6, colour: "red" }],
          links: [["alpha", "beta"]],
        },
      }),
      BOXES_PACK,
    );
    const seed = doc.seed as Seed;
    expect(seed.boxes[0]).toEqual({ name: "alpha", x: 5, y: 6 });
    expect(seed.links).toEqual([["alpha", "beta"]]);
  });
});

describe("v1 → v2 migration", () => {
  /** A v1 document as the format shipped it: seed and placements inline. */
  const v1 = (seed: unknown, placements: unknown): string =>
    JSON.stringify({
      version: 1,
      title: "From v1",
      seed,
      placements,
      timeline: [{ kind: "op", op: "add", args: { name: "alpha" } }],
    });

  it("carries the pack's JSON across the bump verbatim", () => {
    // The shapes v1 actually held — the writing pack's, and nobody else's.
    const seed = {
      repos: [{ name: "r", wts: [{ branch: "main" }] }],
      rels: [],
    };
    const placements = { repos: { r: { x: 1, y: 2 } }, wts: {} };
    const doc = parseDoc(v1(seed, placements), PASSTHROUGH);
    expect(doc.version).toBe(2);
    expect(doc.seed).toEqual(seed);
    expect(doc.placements).toEqual(placements);
    expect(doc.title).toBe("From v1");
    expect(doc.timeline).toHaveLength(1);
  });

  it("opens a v1 document whose halves the loaded pack can read", () => {
    const doc = parseDoc(
      v1({ boxes: [{ name: "alpha" }], links: [] }, { boxes: {} }),
      BOXES_PACK,
    );
    expect(doc.version).toBe(2);
    expect((doc.seed as Seed).boxes).toEqual([{ name: "alpha" }]);
    expect((doc.placements as Placements).boxes).toEqual({});
  });

  it("re-serializes a migrated document at the new version", () => {
    const doc: ComposerDoc = parseDoc(v1(null, null), BOXES_PACK);
    expect(JSON.parse(serializeDoc(doc)).version).toBe(2);
  });
});
