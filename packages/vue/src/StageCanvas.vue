<script setup lang="ts">
import {
  type ActLike,
  attachDiagramView,
  type CamRect,
  type DiagramView,
  type DndController,
  makeView,
  type OverlayFn,
  type Player,
  type ViewHooks,
} from "@dumbshow/core";
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

/**
 * The composer's canvas — the same renderer every viewer uses, attached
 * through the pack's scene hooks with clickToggle off (clicks belong to
 * selection) and rebuilt in place whenever the app swaps players: the DOM
 * node survives, only the clock source changes. Hits are pack-shaped
 * values carried opaquely, and the pack paints every marker over them —
 * selection (the overlay prop), hover, and drag — composed here into one
 * overlay per frame.
 *
 * Pointer affordances: the pointer's hit sets `data-hover` on the wrap
 * (the cursor) and the pack's hover marker; a press on a draggable entity
 * taps or drags it, and while a node drag runs the wrap carries
 * `data-dragging` and the pack's drag marker rides the entity through the
 * app's live preview. Drop targets then resolve against the geometry
 * captured when the press began — the preview moves the dragged node under
 * the pointer, so the live frame's hits would name it instead of whatever
 * lies beneath. A press on something the pack declares non-draggable, or
 * on empty canvas, is a tap however far it travels.
 */

type Overlay = OverlayFn<unknown>;

const props = defineProps<{
  lang: {
    emptyWorld(): unknown;
    scene: ViewHooks<ActLike, unknown, unknown, unknown> & {
      camFor(world: unknown): CamRect;
    };
    entities: {
      select(hit: unknown): unknown;
      hoverOverlay?(selection: unknown): Overlay | null;
      dragOverlay?(selection: unknown): Overlay | null;
      draggable?(hit: unknown): boolean;
    };
  };
  player: Player<ActLike> | null;
  /** The selection marker, pack-painted (null = none). */
  overlay: Overlay | null;
  dnd: DndController;
}>();

const emit = defineEmits<{
  /** Topmost entity under a tap, or null for a miss. */
  pick: [hit: unknown];
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
let view: DiagramView<unknown> | null = null;
let unregister: (() => void) | null = null;

/* Pointer state, as pack selections: what the pointer rests on (or the
 * drop target under a drag), and the node being dragged. */
const hover = shallowRef<unknown>(null);
const dragging = shallowRef<unknown>(null);
/** Hits as they stood when the current press began — node drags resolve
 * their drop target against these, never the moving preview. */
let pressHits: unknown[] | null = null;

/** Selections are plain data by contract — compare them structurally. */
function sameSel(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function composedOverlay(): Overlay | null {
  const layers: Overlay[] = [];
  const ent = props.lang.entities;
  const h = hover.value;
  const d = dragging.value;
  const hoverFn = h === null ? null : ent.hoverOverlay?.(h);
  if (hoverFn) layers.push(hoverFn);
  if (props.overlay) layers.push(props.overlay);
  const dragFn = d === null ? null : ent.dragOverlay?.(d);
  if (dragFn) layers.push(dragFn);
  if (!layers.length) return null;
  return (ctx, hits) => {
    for (const fn of layers) fn(ctx, hits);
  };
}

function refreshOverlay(): void {
  view?.setOverlay(composedOverlay());
}

function setHover(hit: unknown): void {
  const sel =
    hit === null || hit === undefined ? null : props.lang.entities.select(hit);
  if (sameSel(sel, hover.value)) return;
  hover.value = sel;
  refreshOverlay();
}

function attach(p: Player<ActLike> | null): void {
  const canvas = canvasEl.value;
  if (!canvas) return;
  if (p && view) {
    view.setPlayer(p);
    return;
  }
  view?.destroy();
  view = null;
  if (p)
    view = attachDiagramView(canvas, p, props.lang.scene, {
      clickToggle: false,
      overlay: composedOverlay() ?? undefined,
    });
  else canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

function onPointerDown(event: PointerEvent): void {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const hit = view?.hitTest(event.offsetX, event.offsetY) ?? null;
  if (hit !== null && (props.lang.entities.draggable?.(hit) ?? true)) {
    // A press on a node: tap selects, travel drags it to a new place.
    pressHits = view?.hits() ?? null;
    props.dnd.start(event, { kind: "node", hit }, () => emit("pick", hit));
    return;
  }
  // Empty canvas, or an entity that only selects: a release without
  // travel picks (or clears); travel does nothing.
  const sx = event.clientX;
  const sy = event.clientY;
  const up = (ue: PointerEvent): void => {
    canvas.removeEventListener("pointerup", up);
    if (Math.hypot(ue.clientX - sx, ue.clientY - sy) < 4) emit("pick", hit);
  };
  canvas.addEventListener("pointerup", up);
}

function onPointerMove(event: PointerEvent): void {
  // Under a drag the controller owns the pointer; hover follows its target.
  if (props.dnd.state.active) return;
  setHover(view?.hitTest(event.offsetX, event.offsetY) ?? null);
}

function onPointerLeave(): void {
  if (!props.dnd.state.active) setHover(null);
}

onMounted(() => {
  watch(() => props.player, attach, { immediate: true });
  watch(
    () => props.overlay,
    () => refreshOverlay(),
  );
  watch(
    () => props.dnd.state.active,
    (active) => {
      if (!active) {
        pressHits = null;
        const lifted = dragging.value !== null;
        dragging.value = null;
        if (lifted) refreshOverlay();
        setHover(null);
        return;
      }
      if (active.source.kind === "node") {
        const sel = props.lang.entities.select(active.source.hit);
        if (!sameSel(sel, dragging.value)) {
          dragging.value = sel;
          refreshOverlay();
        }
      }
      // The drop target lights up — over the canvas only.
      setHover(active.target?.kind === "canvas" ? active.target.over : null);
    },
  );
  const canvas = canvasEl.value;
  if (canvas) {
    unregister = props.dnd.registerZone({
      id: "canvas",
      el: canvas,
      resolve(x, y, source) {
        const r = canvas.getBoundingClientRect();
        const sx = x - r.left;
        const sy = y - r.top;
        if (view) {
          const [wx, wy] = view.toWorld(sx, sy);
          const over =
            source.kind === "node" && pressHits
              ? props.lang.scene.pick(pressHits, sx, sy)
              : view.hitTest(sx, sy);
          return { kind: "canvas", wx, wy, over };
        }
        // Empty scene: no player yet, so map through the pack's own
        // opening camera — the rect an empty world would frame.
        const cam = props.lang.scene.camFor(props.lang.emptyWorld());
        const v = makeView(cam, r.width, r.height);
        return { kind: "canvas", wx: v.wx(sx), wy: v.wy(sy), over: null };
      },
    });
  }
});

onBeforeUnmount(() => {
  unregister?.();
  view?.destroy();
  view = null;
});
</script>

<template>
  <div
    class="dx-canvas-wrap"
    :data-hover="hover !== null ? 'true' : undefined"
    :data-dragging="dragging !== null ? 'true' : undefined"
  >
    <canvas
      ref="canvasEl"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    />
    <p v-if="!player" class="dx-empty dx-canvas-empty">
      An empty scene. Add operations from the catalog — elements drag onto
      this canvas once canvas editing lands.
    </p>
  </div>
</template>
