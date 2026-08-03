/**
 * The composer document — one serializable file, no modes.
 *
 * A document is `{ seed, timeline }`: the seed declares what already exists
 * when the story opens (repos, worktrees, relations — drawn with the full
 * grammar but no terminal lines), and the timeline is an ordered list of
 * items — language operations plus chapter/beat annotations. A *still* is simply
 * a document whose timeline was never played. Placements are authoring
 * data (where the author dragged things), never timeline events.
 *
 * Everything in a document is data: names, args, flags. Keystrokes, derived
 * transcripts, and player state are never stored — the terminal is a
 * projection re-rendered from these items, which is what makes renames
 * rewrite history instead of leaving stale text behind.
 */

import type { VerbArgs } from "../language";

export const DOC_VERSION = 1;

/** Explicit world-space repo position, written when the author drags. */
export interface RepoPlacement {
  x: number;
  y: number;
}

/** Explicit polar worktree placement around its repo. */
export interface WtPlacement {
  ang: number;
  dist: number;
}

/**
 * Author-pinned geometry. Worktree keys are `"repo:branch"`. Anything not
 * listed keeps its deterministic hash-derived position.
 */
export interface Placements {
  repos: Record<string, RepoPlacement>;
  wts: Record<string, WtPlacement>;
}

export interface SeedWt {
  branch: string;
  port?: string;
  agent?: boolean;
  merged?: boolean;
}

export interface SeedRepo {
  name: string;
  wts: SeedWt[];
}

/** The world as the story opens — rendered as scene, never as commands. */
export interface Seed {
  repos: SeedRepo[];
  rels: [string, string][];
}

export type DocItem =
  | { kind: "op"; op: string; args: VerbArgs; silent?: boolean }
  | { kind: "chapter"; title: string }
  | { kind: "beat"; secs: number };

export interface ComposerDoc {
  version: number;
  title: string;
  seed: Seed;
  timeline: DocItem[];
  placements: Placements;
}

export function emptyDoc(): ComposerDoc {
  return {
    version: DOC_VERSION,
    title: "Untitled scenario",
    seed: { repos: [], rels: [] },
    timeline: [],
    placements: { repos: {}, wts: {} },
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

function parseSeed(raw: unknown): Seed {
  if (!isRecord(raw)) fail("seed is not an object");
  const repos: SeedRepo[] = [];
  if (!Array.isArray(raw.repos)) fail("seed.repos is not a list");
  for (const r of raw.repos) {
    if (!isRecord(r) || !isName(r.name)) fail("a seed repo has no name");
    if (!Array.isArray(r.wts)) fail(`seed repo ${r.name} has no worktrees`);
    const wts: SeedWt[] = [];
    for (const w of r.wts) {
      if (!isRecord(w) || !isName(w.branch))
        fail(`a worktree in ${r.name} has no branch`);
      wts.push({
        branch: w.branch,
        ...(isName(w.port) ? { port: w.port } : {}),
        ...(w.agent === true ? { agent: true } : {}),
        ...(w.merged === true ? { merged: true } : {}),
      });
    }
    repos.push({ name: r.name, wts });
  }
  const rels: [string, string][] = [];
  if (!Array.isArray(raw.rels)) fail("seed.rels is not a list");
  for (const rel of raw.rels) {
    if (
      !Array.isArray(rel) ||
      rel.length !== 2 ||
      !isName(rel[0]) ||
      !isName(rel[1])
    )
      fail("a relation is not a [repo, repo] pair");
    rels.push([rel[0], rel[1]]);
  }
  return { repos, rels };
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

function parsePlacements(raw: unknown): Placements {
  if (raw === undefined) return { repos: {}, wts: {} };
  if (!isRecord(raw)) fail("placements is not an object");
  const repos: Record<string, RepoPlacement> = {};
  if (isRecord(raw.repos)) {
    for (const [name, p] of Object.entries(raw.repos)) {
      if (!isRecord(p) || !isFinite2(p.x) || !isFinite2(p.y))
        fail(`placement for repo ${name} is malformed`);
      repos[name] = { x: p.x, y: p.y };
    }
  }
  const wts: Record<string, WtPlacement> = {};
  if (isRecord(raw.wts)) {
    for (const [key, p] of Object.entries(raw.wts)) {
      if (!isRecord(p) || !isFinite2(p.ang) || !isFinite2(p.dist))
        fail(`placement for worktree ${key} is malformed`);
      wts[key] = { ang: p.ang, dist: p.dist };
    }
  }
  return { repos, wts };
}

/**
 * Migration ladder for older document versions. v1 is the first shipped
 * format, so the ladder is empty; each future bump adds one rung here.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

/**
 * Parse and validate a serialized document. Throws with a human-readable
 * message on malformed input, and refuses documents written by a NEWER
 * composer than this one (they may carry meaning we would silently drop).
 */
export function parseDoc(json: string): ComposerDoc {
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
  const migrated = migrate(raw);
  return {
    version: DOC_VERSION,
    title: isName(migrated.title) ? migrated.title : "Untitled scenario",
    seed: parseSeed(migrated.seed ?? { repos: [], rels: [] }),
    timeline: parseTimeline(migrated.timeline ?? []),
    placements: parsePlacements(migrated.placements),
  };
}
