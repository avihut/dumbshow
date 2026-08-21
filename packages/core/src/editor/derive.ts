/**
 * Derivation — the one road from a document to something playable.
 *
 * `derive(doc, lang)` replays the document deterministically against a
 * language pack: the seed becomes an opening scene step (built by the
 * pack's seed hooks), then each timeline op runs over the world exactly as
 * the pack's op registry defines it. Items whose prerequisites vanished
 * skip cleanly (mapping -1) instead of corrupting the scene; chapters bind
 * to the step that follows them; beats stretch the step before them. The
 * result carries world snapshots taken before every item, so attribute
 * forms and the shell can resolve names against the world as it was at
 * that point in the story.
 */

import { type Compiled, compile, type StepDef } from "../engine";
import type { ActLike, DiagramLanguage } from "../language";
import type { ComposerDoc } from "./doc";

export interface DerivedChapter {
  title: string;
  /** Timeline index of the chapter item. */
  item: number;
  /** Step the chapter opens; -1 when no step follows it yet. */
  step: number;
}

export interface Derived<W, A extends ActLike> {
  /** The world after the whole timeline ran. */
  world: W;
  /** World snapshots taken BEFORE each timeline item (same length). */
  worlds: W[];
  steps: StepDef<A>[];
  /** True when steps[0] is the seed's opening scene. */
  seedStep: boolean;
  /**
   * Timeline index → step index. Ops map to their step (-1 when skipped);
   * chapters map to the step they open; beats map to the step they
   * stretched (-1 when nothing could host them).
   */
  mapping: number[];
  chapters: DerivedChapter[];
  compiled: Compiled<A>;
}

/** Worlds are serializable data by contract — snapshots are deep copies. */
function snapshot<W>(world: W): W {
  return structuredClone(world);
}

export function derive<W, A extends ActLike, S>(
  doc: ComposerDoc,
  lang: DiagramLanguage<W, A, S, StepDef<A>>,
): Derived<W, A> {
  const world = lang.seed.world(doc.seed, doc.placements);
  const steps: StepDef<A>[] = [];
  // Whether a seed opens the story is the pack's call — it owns the schema,
  // so only it can say whether one declares anything. Null = nothing opens.
  const opening = lang.seed.step(world, doc.placements);
  if (opening) steps.push(opening);

  const worlds: W[] = [];
  const mapping: number[] = [];
  const chapters: DerivedChapter[] = [];
  const pending: { title: string; item: number }[] = [];

  doc.timeline.forEach((item, i) => {
    worlds.push(snapshot(world));
    if (item.kind === "chapter") {
      pending.push({ title: item.title, item: i });
      mapping.push(-1);
      return;
    }
    if (item.kind === "beat") {
      const last = steps[steps.length - 1];
      if (last) {
        last.beats.push({ pause: item.secs });
        mapping.push(steps.length - 1);
      } else {
        mapping.push(-1);
      }
      return;
    }
    const spec = lang.ops.find((o) => o.id === item.op);
    if (!spec?.available(world)) {
      mapping.push(-1);
      return;
    }
    const step = spec.run(world, item.args);
    lang.placements.patchStep(step, doc.placements);
    if (item.silent) step.silent = true;
    for (const pc of pending) {
      chapters.push({ ...pc, step: steps.length });
      mapping[pc.item] = steps.length;
    }
    pending.length = 0;
    mapping.push(steps.length);
    steps.push(step);
  });

  for (const pc of pending) chapters.push({ ...pc, step: -1 });

  return {
    world,
    worlds,
    steps,
    seedStep: opening !== null,
    mapping,
    chapters,
    compiled: compile(steps),
  };
}

/**
 * The same steps with the cameras of `from` (matched by step and beat
 * index) — how a live preview keeps the base document's framing: a scene
 * re-derived from moved geometry would otherwise re-fit its camera and
 * slide under the pointer. Steps or beats `from` lacks keep their own.
 */
export function withCamsOf<A extends ActLike>(
  steps: StepDef<A>[],
  from: StepDef<A>[],
): StepDef<A>[] {
  return steps.map((step, i) => {
    const base = from[i];
    if (!base) return step;
    return {
      ...step,
      cam: base.cam,
      beats: step.beats.map((beat, j) => {
        const b = base.beats[j];
        return "cam" in beat && b && "cam" in b
          ? { ...beat, cam: b.cam }
          : beat;
      }),
    };
  });
}
