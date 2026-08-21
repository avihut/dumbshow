/**
 * Pure document mutations — every editor gesture funnels through here.
 *
 * Each function takes a document and returns a fresh one (the input is
 * never touched), so the app can rebuild-and-reseek on every edit and undo
 * is a matter of keeping old references. No function here knows about
 * players, canvases, or the DOM.
 */

import type { VerbArgs } from "../language";
import type { ComposerDoc, DocItem } from "./doc";

function clone(doc: ComposerDoc): ComposerDoc {
  return structuredClone(doc);
}

function clampIndex(doc: ComposerDoc, index: number): number {
  return Math.min(Math.max(index, 0), doc.timeline.length);
}

/* ------------------------------- timeline -------------------------------- */

export function insertItem(
  doc: ComposerDoc,
  index: number,
  item: DocItem,
): ComposerDoc {
  const next = clone(doc);
  next.timeline.splice(clampIndex(doc, index), 0, structuredClone(item));
  return next;
}

/**
 * Move the item at `from` so it lands at index `to` in the resulting list
 * (standard drag semantics: `to` is measured after the removal).
 */
export function moveItem(
  doc: ComposerDoc,
  from: number,
  to: number,
): ComposerDoc {
  if (from < 0 || from >= doc.timeline.length || from === to) return doc;
  const next = clone(doc);
  const [item] = next.timeline.splice(from, 1);
  next.timeline.splice(
    Math.min(Math.max(to, 0), next.timeline.length),
    0,
    item,
  );
  return next;
}

export function removeItem(doc: ComposerDoc, index: number): ComposerDoc {
  if (index < 0 || index >= doc.timeline.length) return doc;
  const next = clone(doc);
  next.timeline.splice(index, 1);
  return next;
}

export function setArgs(
  doc: ComposerDoc,
  index: number,
  args: VerbArgs,
): ComposerDoc {
  const item = doc.timeline[index];
  if (item?.kind !== "op") return doc;
  const next = clone(doc);
  const target = next.timeline[index] as Extract<DocItem, { kind: "op" }>;
  target.args = structuredClone(args);
  return next;
}

/** Swap an op for another operation entirely; the silent flag survives. */
export function replaceOp(
  doc: ComposerDoc,
  index: number,
  op: string,
  args: VerbArgs,
): ComposerDoc {
  const item = doc.timeline[index];
  if (item?.kind !== "op") return doc;
  const next = clone(doc);
  next.timeline[index] = {
    kind: "op",
    op,
    args: structuredClone(args),
    ...(item.silent ? { silent: true } : {}),
  };
  return next;
}

export function setSilent(
  doc: ComposerDoc,
  index: number,
  silent: boolean,
): ComposerDoc {
  const item = doc.timeline[index];
  if (item?.kind !== "op" || Boolean(item.silent) === silent) return doc;
  const next = clone(doc);
  const target = next.timeline[index] as Extract<DocItem, { kind: "op" }>;
  if (silent) target.silent = true;
  else delete target.silent;
  return next;
}

export function setChapterTitle(
  doc: ComposerDoc,
  index: number,
  title: string,
): ComposerDoc {
  const item = doc.timeline[index];
  if (item?.kind !== "chapter") return doc;
  const next = clone(doc);
  (next.timeline[index] as Extract<DocItem, { kind: "chapter" }>).title = title;
  return next;
}

export function setBeatSecs(
  doc: ComposerDoc,
  index: number,
  secs: number,
): ComposerDoc {
  const item = doc.timeline[index];
  if (item?.kind !== "beat") return doc;
  const next = clone(doc);
  (next.timeline[index] as Extract<DocItem, { kind: "beat" }>).secs = Math.min(
    Math.max(secs, 0.1),
    10,
  );
  return next;
}

export function setTitle(doc: ComposerDoc, title: string): ComposerDoc {
  const next = clone(doc);
  next.title = title.trim() || "Untitled scenario";
  return next;
}

/* --------------------------- pack-owned JSON ----------------------------- */

/*
 * The seed and the placements are the pack's JSON: this module cannot read
 * their shape, so it offers no key-level helpers, only these two whole-value
 * writes. A pack that pins geometry or edits the opening scene computes the
 * next value itself — from `placements.fromCompiled`, a drop position, a
 * rename — and hands the whole thing back. Cloning the document stays here,
 * where the purity rule lives.
 */

/** Replace the document's opening state. */
export function setSeed(doc: ComposerDoc, seed: unknown): ComposerDoc {
  const next = clone(doc);
  next.seed = structuredClone(seed);
  return next;
}

/** Replace the document's author-pinned geometry. */
export function setPlacements(
  doc: ComposerDoc,
  placements: unknown,
): ComposerDoc {
  const next = clone(doc);
  next.placements = structuredClone(placements);
  return next;
}
