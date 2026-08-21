/**
 * Draft persistence across a format bump.
 *
 * The draft slot is keyed by document version so a NEWER composer's draft
 * stays invisible rather than being misread — but between sessions that slot
 * is the author's only copy, so a bump must not orphan it. These tests pin
 * the one behavior in the format-v2 change with real data-loss risk. The
 * suite runs in node, so localStorage is a stub.
 */

import { BOXES_PACK, type Seed } from "@dumbshow/boxes";
import {
  type ComposerDoc,
  clearDraft,
  DOC_VERSION,
  emptyDoc,
  loadDraft,
  saveDraft,
  serializeDoc,
} from "@dumbshow/core";
import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => void store.set(k, v),
    removeItem: (k: string): void => void store.delete(k),
    clear: (): void => store.clear(),
    key: (i: number): string | null => [...store.keys()][i] ?? null,
    get length(): number {
      return store.size;
    },
  },
});

const key = (version: number): string => `dumbshow-composer-draft-v${version}`;

/** A v1 document as that format shipped it. */
const V1_DRAFT = JSON.stringify({
  version: 1,
  title: "Half-finished",
  seed: { boxes: [{ name: "alpha" }], links: [] },
  placements: { boxes: { alpha: { x: 7, y: 8 } } },
  timeline: [{ kind: "op", op: "add", args: { name: "beta" } }],
});

beforeEach(() => store.clear());

/** The restored draft, insisting there is one. */
function loaded(): ComposerDoc {
  const doc = loadDraft(BOXES_PACK);
  if (!doc) throw new Error("expected a restored draft, got none");
  return doc;
}

describe("the draft slot", () => {
  it("round-trips a document at the current version", () => {
    const doc = emptyDoc(BOXES_PACK);
    doc.title = "Saved";
    saveDraft(doc, "dumbshow");
    expect(store.has(key(DOC_VERSION))).toBe(true);
    expect(loadDraft(BOXES_PACK)).toEqual(doc);
  });

  it("discards a corrupt draft instead of restoring it", () => {
    store.set(key(DOC_VERSION), "{not json");
    expect(loadDraft(BOXES_PACK)).toBeNull();
    expect(store.has(key(DOC_VERSION))).toBe(false);
  });

  it("returns null when there is nothing at all", () => {
    expect(loadDraft(BOXES_PACK)).toBeNull();
  });

  it("clears only its own tag's slot", () => {
    saveDraft(emptyDoc(BOXES_PACK), "other");
    saveDraft(emptyDoc(BOXES_PACK), "dumbshow");
    clearDraft("dumbshow");
    expect(store.has(key(DOC_VERSION))).toBe(false);
    expect(store.has(`other-composer-draft-v${DOC_VERSION}`)).toBe(true);
  });
});

describe("a draft written by the previous format", () => {
  it("is migrated forward rather than orphaned by the version key", () => {
    store.set(key(1), V1_DRAFT);
    const doc = loaded();
    expect(doc.version).toBe(DOC_VERSION);
    expect(doc.title).toBe("Half-finished");
    expect((doc.seed as Seed).boxes).toEqual([{ name: "alpha" }]);
    expect(doc.timeline).toHaveLength(1);
  });

  it("is re-saved under the current key and its old slot retired", () => {
    store.set(key(1), V1_DRAFT);
    const doc = loaded();
    expect(store.get(key(DOC_VERSION))).toBe(serializeDoc(doc));
    expect(store.has(key(1))).toBe(false);
  });

  it("never shadows a draft already written at the current version", () => {
    const current = emptyDoc(BOXES_PACK);
    current.title = "Newer";
    saveDraft(current, "dumbshow");
    store.set(key(1), V1_DRAFT);
    expect(loaded().title).toBe("Newer");
    expect(store.has(key(1))).toBe(true); // untouched, not consumed
  });

  it("is discarded when the loaded pack cannot read its halves", () => {
    // A v1 draft written by a different pack: valid JSON, foreign schema.
    store.set(
      key(1),
      JSON.stringify({ version: 1, seed: { repos: [], rels: [] } }),
    );
    expect(loadDraft(BOXES_PACK)).toBeNull();
    expect(store.has(key(1))).toBe(false);
  });
});
