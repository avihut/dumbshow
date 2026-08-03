/**
 * Pointer-event drag controller — one controller, many zones, one funnel.
 *
 * A press on a draggable calls `start`; below a 4px travel threshold the
 * release is a tap (the element's click behavior), past it the drag
 * engages: pointer capture keeps events flowing, registered drop zones
 * resolve the hover into a typed target, the ghost layer renders from
 * reactive state, and edges of scrollable zones auto-scroll. Every drop
 * funnels through `applyDrop` — the single place a (source, target) pair
 * becomes a document mutation. What a CANVAS drop means is the pack's to
 * say (entities.canvasDrop); timeline drops are pure editor mechanics.
 */

import { reactive } from "vue";
import type { ActLike, EntityHooks } from "../language";
import type { Derived } from "./derive";
import type { ComposerDoc } from "./doc";
import { insertItem, moveItem } from "./mutations";
import {
  type Chip,
  seedMetaItem,
  seedOpItem,
  type VocabLang,
} from "./vocabulary";

export type DragSource =
  | { kind: "chip"; chip: Chip }
  | { kind: "row"; index: number }
  | { kind: "node"; hit: unknown };

export type DropTarget =
  | { kind: "timeline"; index: number }
  | { kind: "canvas"; wx: number; wy: number; over: unknown };

export interface DragState {
  source: DragSource;
  x: number;
  y: number;
  target: DropTarget | null;
}

export interface DropZone {
  id: string;
  el: HTMLElement;
  resolve(x: number, y: number, source: DragSource): DropTarget | null;
  /** Scrollable zones auto-scroll when the pointer nears their edges. */
  scrollEl?: HTMLElement;
}

const THRESHOLD = 4;
const EDGE = 26;
const EDGE_STEP = 7;

export interface DndController {
  state: { active: DragState | null };
  registerZone(zone: DropZone): () => void;
  /**
   * Begin tracking a press. Below the travel threshold the release calls
   * `tap` (click semantics); past it the press becomes a drag.
   */
  start(event: PointerEvent, source: DragSource, tap?: () => void): void;
}

export function createDnd(
  onDrop: (source: DragSource, target: DropTarget) => void,
): DndController {
  const state = reactive<{ active: DragState | null }>({ active: null });
  const zones = new Map<string, DropZone>();

  function resolveAt(
    x: number,
    y: number,
    source: DragSource,
  ): DropTarget | null {
    for (const zone of zones.values()) {
      const r = zone.el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const scroller = zone.scrollEl ?? zone.el;
      if (y < r.top + EDGE) scroller.scrollTop -= EDGE_STEP;
      else if (y > r.bottom - EDGE) scroller.scrollTop += EDGE_STEP;
      const target = zone.resolve(x, y, source);
      if (target) return target;
    }
    return null;
  }

  return {
    state,
    registerZone(zone) {
      zones.set(zone.id, zone);
      return () => zones.delete(zone.id);
    },
    start(event, source, tap) {
      if (event.button !== 0) return;
      const el = event.currentTarget as HTMLElement;
      const sx = event.clientX;
      const sy = event.clientY;
      let engaged = false;

      const move = (e: PointerEvent): void => {
        if (!engaged && Math.hypot(e.clientX - sx, e.clientY - sy) < THRESHOLD)
          return;
        engaged = true;
        state.active = {
          source,
          x: e.clientX,
          y: e.clientY,
          target: resolveAt(e.clientX, e.clientY, source),
        };
      };
      const finish = (drop: boolean): void => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", cancel);
        const active = state.active;
        state.active = null;
        if (!engaged) {
          if (drop) tap?.();
          return;
        }
        if (drop && active?.target) onDrop(active.source, active.target);
      };
      const up = (): void => finish(true);
      const cancel = (): void => finish(false);

      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events carry no capturable pointer; tracking still works.
      }
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", cancel);
    },
  };
}

/** The slice of a language pack the drop funnel reads. */
export interface DndLang<W, A extends ActLike> extends VocabLang {
  entities: EntityHooks<W, A>;
}

/** Short ghost-chip label for whatever is being dragged. */
export function dragLabel<W, A extends ActLike>(
  lang: DndLang<W, A>,
  source: DragSource,
  doc: ComposerDoc,
): string {
  if (source.kind === "chip") return source.chip.label;
  if (source.kind === "node") return lang.entities.label(source.hit);
  const item = doc.timeline[source.index];
  if (!item) return "";
  if (item.kind === "chapter") return `chapter · ${item.title}`;
  if (item.kind === "beat") return `beat · ${item.secs}s`;
  return item.op;
}

export type DropResult =
  | {
      doc: ComposerDoc;
      focus: number | null;
      selectItem?: number;
      /** Pack-shaped entity selection, passed back opaquely. */
      selectEntity?: unknown;
    }
  | { error: string }
  | null;

/**
 * The single mutation funnel for drops. Returns the next document plus
 * where to land and what to select, an error to surface, or null when the
 * pair means nothing (an op chip on the canvas).
 */
export function applyDrop<W, A extends ActLike>(
  lang: DndLang<W, A>,
  doc: ComposerDoc,
  derived: Derived<W, A>,
  source: DragSource,
  target: DropTarget,
): DropResult {
  if (target.kind === "timeline") {
    if (source.kind === "chip") {
      if (source.chip.kind === "element")
        return { error: "Elements drop on the canvas, not the timeline." };
      const at = target.index;
      const world =
        at < derived.worlds.length ? derived.worlds[at] : derived.world;
      const item =
        source.chip.kind === "op"
          ? seedOpItem(lang, source.chip.id, world)
          : seedMetaItem(source.chip.id);
      if (!item) return null;
      return { doc: insertItem(doc, at, item), focus: at, selectItem: at };
    }
    // A canvas entity has no timeline meaning — only rows reorder.
    if (source.kind === "node") return null;
    // Reordering: `to` is measured after removal (moveItem semantics).
    const from = source.index;
    const to = from < target.index ? target.index - 1 : target.index;
    if (to === from) return null;
    return { doc: moveItem(doc, from, to), focus: to, selectItem: to };
  }
  // Canvas: what landing there MEANS is the pack's to say.
  const src =
    source.kind === "chip"
      ? source.chip.kind === "element"
        ? { kind: "element" as const, id: source.chip.id }
        : null
      : source.kind === "node"
        ? { kind: "node" as const, hit: source.hit }
        : null;
  if (!src) return null;
  const out = lang.entities.canvasDrop({
    doc,
    world: derived.world,
    compiled: derived.compiled,
    source: src,
    wx: target.wx,
    wy: target.wy,
    over: target.over,
  });
  if (!out) return null;
  if ("error" in out) return out;
  return {
    doc: out.doc as ComposerDoc,
    focus: null,
    selectEntity: out.select,
  };
}
