<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Player } from "../engine";
import type { ActLike } from "../language";
import {
  attachDiagramView,
  type DiagramView,
  makeView,
  type OverlayFn,
  type ViewHooks,
} from "../render-core";
import type { DndController } from "./dnd";

/**
 * The composer's canvas — the same renderer every viewer uses, attached
 * through the pack's scene hooks with clickToggle off (clicks belong to
 * selection) and rebuilt in place whenever the app swaps players: the DOM
 * node survives, only the attachment changes. Clicks hit-test against the
 * frame's own geometry; the overlay prop paints selection above every
 * frame; as a drop zone it resolves pointer positions into world
 * coordinates plus whatever entity sits underneath. Hits are pack-shaped
 * values carried opaquely.
 */

const props = defineProps<{
  lang: {
    emptyWorld(): unknown;
    scene: ViewHooks<ActLike, unknown, unknown, unknown> & {
      camFor(world: unknown): { x: number; y: number; w: number; h: number };
    };
  };
  player: Player<ActLike> | null;
  overlay: OverlayFn<unknown> | null;
  dnd: DndController;
}>();

const emit = defineEmits<{
  /** Topmost entity under a click, or null for a miss. */
  pick: [hit: unknown];
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
let view: DiagramView<unknown> | null = null;
let unregister: (() => void) | null = null;

function attach(p: Player<ActLike> | null): void {
  view?.destroy();
  view = null;
  const canvas = canvasEl.value;
  if (!canvas) return;
  if (p)
    view = attachDiagramView(canvas, p, props.lang.scene, {
      clickToggle: false,
      overlay: props.overlay ?? undefined,
    });
  else canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

function onPointerDown(event: PointerEvent): void {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const hit = view?.hitTest(event.offsetX, event.offsetY) ?? null;
  if (hit) {
    // A press on a node: tap selects, travel drags it to a new place.
    props.dnd.start(event, { kind: "node", hit }, () => emit("pick", hit));
    return;
  }
  // Empty press: a release without travel clears the selection.
  const sx = event.clientX;
  const sy = event.clientY;
  const up = (ue: PointerEvent): void => {
    canvas.removeEventListener("pointerup", up);
    if (Math.hypot(ue.clientX - sx, ue.clientY - sy) < 4) emit("pick", null);
  };
  canvas.addEventListener("pointerup", up);
}

onMounted(() => {
  watch(() => props.player, attach, { immediate: true });
  watch(
    () => props.overlay,
    (fn) => view?.setOverlay(fn),
  );
  const canvas = canvasEl.value;
  if (canvas) {
    unregister = props.dnd.registerZone({
      id: "canvas",
      el: canvas,
      resolve(x, y) {
        const r = canvas.getBoundingClientRect();
        const sx = x - r.left;
        const sy = y - r.top;
        if (view) {
          const [wx, wy] = view.toWorld(sx, sy);
          return { kind: "canvas", wx, wy, over: view.hitTest(sx, sy) };
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
  <div class="dx-canvas-wrap">
    <canvas ref="canvasEl" @pointerdown="onPointerDown" />
    <p v-if="!player" class="dx-empty dx-canvas-empty">
      An empty scene. Add operations from the catalog — elements drag onto
      this canvas once canvas editing lands.
    </p>
  </div>
</template>
