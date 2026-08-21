/**
 * Document persistence — one JSON file, no backend.
 *
 * Save/Open moves whole documents through the browser's download/file-pick
 * machinery; the localStorage draft is a crash net, not a store: one slot,
 * versioned key (a newer composer's draft is invisible rather than
 * misread), corrupt drafts are discarded, last writer wins across tabs.
 *
 * Hosts brand their persistence through `tag`: it names the draft slot and
 * the download suffix (`<slug>.<tag>.json`), so two hosts on one origin
 * keep separate drafts and hand out files in their own format's name.
 */

import { type ComposerDoc, DOC_VERSION, parseDoc, serializeDoc } from "./doc";

const DEFAULT_TAG = "dumbshow";

const draftKey = (tag: string): string =>
  `${tag}-composer-draft-v${DOC_VERSION}`;

export function saveDraft(doc: ComposerDoc, tag = DEFAULT_TAG): void {
  try {
    localStorage.setItem(draftKey(tag), serializeDoc(doc));
  } catch {
    // Quota or privacy mode — the draft net is best-effort by design.
  }
}

export function loadDraft(tag = DEFAULT_TAG): ComposerDoc | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(draftKey(tag));
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return parseDoc(raw);
  } catch {
    clearDraft(tag);
    return null;
  }
}

export function clearDraft(tag = DEFAULT_TAG): void {
  try {
    localStorage.removeItem(draftKey(tag));
  } catch {
    // Nothing to do — see saveDraft.
  }
}

/** The document's file-safe name — shared by every export. */
export function docSlug(doc: ComposerDoc): string {
  const slug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "scenario";
}

export function suggestedFilename(doc: ComposerDoc, tag = DEFAULT_TAG): string {
  return `${docSlug(doc)}.${tag}.json`;
}

/** Hand any blob to the browser as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Hand the document to the browser as a file download. */
export function downloadDoc(doc: ComposerDoc, tag = DEFAULT_TAG): void {
  saveBlob(
    new Blob([serializeDoc(doc)], { type: "application/json" }),
    suggestedFilename(doc, tag),
  );
}

/** Read and validate a picked file; rejects with a human-readable Error. */
export async function openDocFile(file: File): Promise<ComposerDoc> {
  const text = await file.text();
  return parseDoc(text);
}
