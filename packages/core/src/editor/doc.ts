/**
 * The composer document — one serializable file, no modes.
 *
 * A document is `{ seed, timeline, placements }`: the seed declares what
 * already exists when the story opens (drawn with the full grammar but no
 * terminal lines), the timeline is an ordered list of items — language
 * operations plus chapter/beat annotations — and placements record where the
 * author dragged things. A *still* is simply a document whose timeline was
 * never played. Placements are authoring data, never timeline events.
 *
 * `seed` and `placements` are PACK-DEFINED JSON. This model stores,
 * serializes, and migrates them without reading their shape, and hands them
 * to the pack through the seed and placement hooks — which is why every
 * function here that has to touch one takes the pack's schema. They cross
 * document-version bumps verbatim; a pack that evolves its own schema
 * versions it inside its own JSON.
 *
 * Everything else in a document is data too: names, args, flags. Keystrokes,
 * derived transcripts, and player state are never stored — the terminal is a
 * projection re-rendered from these items, which is what makes renames
 * rewrite history instead of leaving stale text behind.
 */

import type { VerbArgs } from "../language";

export const DOC_VERSION = 2;

/**
 * The slice of a language this model needs: the two schemas it cannot read
 * itself. A whole `DiagramLanguage` satisfies it structurally, so callers
 * pass the pack they already hold.
 */
export interface DocSchema {
  seed: { empty(): unknown; parse(raw: unknown): unknown };
  placements: { empty(): unknown; parse(raw: unknown): unknown };
}

export type DocItem =
  | { kind: "op"; op: string; args: VerbArgs; silent?: boolean }
  | { kind: "chapter"; title: string }
  | { kind: "beat"; secs: number };

export interface ComposerDoc {
  version: number;
  title: string;
  /** Pack-defined JSON: the world as the story opens. Opaque here. */
  seed: unknown;
  timeline: DocItem[];
  /** Pack-defined JSON: author-pinned geometry. Opaque here. */
  placements: unknown;
}

export function emptyDoc(lang: DocSchema): ComposerDoc {
  return {
    version: DOC_VERSION,
    title: "Untitled scenario",
    seed: lang.seed.empty(),
    timeline: [],
    placements: lang.placements.empty(),
  };
}

export function serializeDoc(doc: ComposerDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/* ------------------------------ validation ------------------------------- */

function fail(msg: string): never {
  throw new Error(`Not a composer document: ${msg}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isName(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFinite2(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Run one of the pack's parsers, surfacing whatever it throws as this
 * document's parse failure — a pack raising a bare `Error("bad box")` still
 * reads as `Not a composer document: seed — bad box`.
 */
function packParse(field: string, run: () => unknown): unknown {
  try {
    return run();
  } catch (err) {
    return fail(
      `${field} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function parseTimeline(raw: unknown): DocItem[] {
  if (!Array.isArray(raw)) fail("timeline is not a list");
  return raw.map((item, i): DocItem => {
    if (!isRecord(item)) fail(`timeline item ${i} is not an object`);
    switch (item.kind) {
      case "op": {
        if (!isName(item.op)) fail(`timeline item ${i} names no operation`);
        const args = isRecord(item.args) ? (item.args as VerbArgs) : {};
        return {
          kind: "op",
          op: item.op,
          args,
          ...(item.silent === true ? { silent: true } : {}),
        };
      }
      case "chapter":
        if (typeof item.title !== "string")
          fail(`chapter at item ${i} has no title`);
        return { kind: "chapter", title: item.title };
      case "beat":
        return {
          kind: "beat",
          secs: isFinite2(item.secs) && item.secs > 0 ? item.secs : 1,
        };
      default:
        return fail(`timeline item ${i} has unknown kind "${item.kind}"`);
    }
  });
}

/**
 * Migration ladder for older document versions — one rung per bump, each
 * taking the raw JSON one version forward.
 */
function migrate(
  raw: Record<string, unknown>,
  from: number,
): Record<string, unknown> {
  let out = raw;
  // v1 → v2: seed and placements became pack-owned. Under v1 they already
  // held the shape of the one pack that wrote them and nobody else's, so
  // they cross untouched — only ownership moved.
  if (from < 2) out = { ...out, version: 2 };
  return out;
}

/**
 * Parse and validate a serialized document against the pack that will read
 * it. Throws with a human-readable message on malformed input, and refuses
 * documents written by a NEWER composer than this one (they may carry
 * meaning we would silently drop).
 */
export function parseDoc(json: string, lang: DocSchema): ComposerDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    fail("not valid JSON");
  }
  if (!isRecord(raw)) fail("top level is not an object");
  if (!isFinite2(raw.version)) fail("missing version");
  if (raw.version > DOC_VERSION)
    fail(
      `written by a newer composer (v${raw.version}; this one reads up to v${DOC_VERSION})`,
    );
  const migrated = migrate(raw, raw.version);
  return {
    version: DOC_VERSION,
    title: isName(migrated.title) ? migrated.title : "Untitled scenario",
    seed:
      migrated.seed == null
        ? lang.seed.empty()
        : packParse("seed", () => lang.seed.parse(migrated.seed)),
    timeline: parseTimeline(migrated.timeline ?? []),
    placements:
      migrated.placements == null
        ? lang.placements.empty()
        : packParse("placements", () =>
            lang.placements.parse(migrated.placements),
          ),
  };
}
