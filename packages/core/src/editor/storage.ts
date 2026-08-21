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

import {
  type ComposerDoc,
  DOC_VERSION,
  type DocSchema,
  parseDoc,
  serializeDoc,
} from "./doc";

const DEFAULT_TAG = "dumbshow";

const draftKey = (tag: string, version: number = DOC_VERSION): string =>
  `${tag}-composer-draft-v${version}`;

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do — see saveDraft.
  }
}

export function saveDraft(doc: ComposerDoc, tag = DEFAULT_TAG): void {
  try {
    localStorage.setItem(draftKey(tag), serializeDoc(doc));
  } catch {
    // Quota or privacy mode — the draft net is best-effort by design.
  }
}

/**
 * The draft for this format version, or the newest older one carried
 * forward. The versioned key exists so a NEWER composer's draft stays
 * invisible rather than being misread — but between sessions this slot is
 * the author's only copy, so a bump must not orphan it: an older draft is
 * migrated through `parseDoc`, re-saved under the current key, and its old
 * slot retired. A draft this pack cannot read is discarded, same as a
 * corrupt one.
 */
export function loadDraft(
  lang: DocSchema,
  tag = DEFAULT_TAG,
): ComposerDoc | null {
  const current = readKey(draftKey(tag));
  if (current !== null) {
    try {
      return parseDoc(current, lang);
    } catch {
      clearDraft(tag);
      return null;
    }
  }
  for (let version = DOC_VERSION - 1; version >= 1; version--) {
    const key = draftKey(tag, version);
    const older = readKey(key);
    if (older === null) continue;
    removeKey(key);
    try {
      const doc = parseDoc(older, lang);
      saveDraft(doc, tag);
      return doc;
    } catch {
      return null;
    }
  }
  return null;
}

export function clearDraft(tag = DEFAULT_TAG): void {
  removeKey(draftKey(tag));
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
export async function openDocFile(
  file: File,
  lang: DocSchema,
): Promise<ComposerDoc> {
  const text = await file.text();
  return parseDoc(text, lang);
}
