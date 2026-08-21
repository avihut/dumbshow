/**
 * Render scaffolding — the generic half of drawing, split from the daft
 * renderer (./render.ts) along the language-pack seam (./language.ts).
 *
 * This module owns everything about putting a language's scene on a canvas
 * that does not know what the scene contains: the event-sourced replay
 * cursor, the camera tween and world ↔ screen view math, and the canvas
 * attachment that wires a player's clock to a draw loop (observers, DPR,
 * overlays, hit-testing plumbing). The language-shaped parts — scene state,
 * act application, the actual drawing, the palette read, hit priority —
 * arrive injected through hooks, so nothing here may name a daft concept.
 */

import type { CamKey, CamRect, Player, SceneEvent } from "./engine";
import type { ActLike } from "./language";

/* ------------------------------ scene cursor ------------------------------ */

/** The pack-provided halves the cursor needs: fresh state and one act. */
export interface CursorHooks<A extends ActLike, S> {
  createScene(): S;
  /** Apply one act at its absolute time — pure state, no drawing. */
  applyAct(scene: S, act: A, at: number): void;
}

/**
 * A replay cursor over a compiled event list: advances the scene forward in
 * time, and rewinds by rebuilding from scratch — the event-sourcing move
 * that makes seeking in either direction safe.
 */
export interface SceneCursor<S> {
  scene(): S;
  time(): number;
  sync(t: number): void;
}

export function createSceneCursor<A extends ActLike, S>(
  events: SceneEvent<A>[],
  hooks: CursorHooks<A, S>,
): SceneCursor<S> {
  let scene = hooks.createScene();
  let idx = 0;
  let last = 0;
  return {
    scene: () => scene,
    time: () => last,
    sync(t) {
      if (t < last) {
        scene = hooks.createScene();
        idx = 0;
      }
      last = t;
      while (idx < events.length && events[idx].at <= t) {
        const ev = events[idx++];
        hooks.applyAct(scene, ev.act, ev.at);
      }
    },
  };
}

/* -------------------------------- camera --------------------------------- */

/** The shared cubic-out easing — spawns, tweens, and fades all speak it. */
export function ease(x: number): number {
  return 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;
}

const CAM_TWEEN = 1.6;

/** The camera rect at time t: the latest key, tweened from its predecessor. */
export function camRectAt(
  keys: CamKey[],
  t: number,
  reduced: boolean,
): CamRect {
  let prev = keys[0].rect;
  let cur = keys[0];
  for (const key of keys) {
    if (key.at <= t) {
      prev = cur.rect;
      cur = key;
    }
  }
  const p = reduced ? 1 : ease((t - cur.at) / CAM_TWEEN);
  return {
    x: prev.x + (cur.rect.x - prev.x) * p,
    y: prev.y + (cur.rect.y - prev.y) * p,
    w: prev.w + (cur.rect.w - prev.w) * p,
    h: prev.h + (cur.rect.h - prev.h) * p,
  };
}

/** World ↔ screen mapping for a camera rect fit into a width×height canvas. */
export interface View {
  sx: (wx: number) => number;
  sy: (wy: number) => number;
  wx: (sx: number) => number;
  wy: (sy: number) => number;
}

export function makeView(rect: CamRect, width: number, height: number): View {
  const s = Math.min(width / rect.w, height / rect.h);
  return {
    sx: (wx) => width / 2 + (wx - rect.x) * s,
    sy: (wy) => height / 2 + (wy - rect.y) * s,
    wx: (sx) => rect.x + (sx - width / 2) / s,
    wy: (sy) => rect.y + (sy - height / 2) / s,
  };
}

/* ------------------------------ canvas view ------------------------------ */

/** One frame's draw inputs — what the attachment hands a pack's drawScene. */
export interface DrawFrame<S, P, H> {
  scene: S;
  t: number;
  width: number;
  height: number;
  palette: P;
  cams: CamKey[];
  reduced: boolean;
  /** The draw pass records pickable geometry into it. */
  hits: H[];
}

/** Painted over each frame after the scene; receives the frame's hits so
 * overlays (selection rings) can track entities without re-deriving
 * geometry. */
export type OverlayFn<H> = (ctx: CanvasRenderingContext2D, hits: H[]) => void;

export interface DiagramView<H> {
  destroy(): void;
  /** Repaint the current frame (e.g. after setOverlay). */
  redraw(): void;
  /** Camera rect at the current clock. */
  camera(): CamRect;
  toWorld(sx: number, sy: number): [number, number];
  toScreen(wx: number, wy: number): [number, number];
  /** Topmost entity at a screen point, from the last frame's geometry. */
  hitTest(sx: number, sy: number): H | null;
  /** The last frame's pickable geometry, copied — so a pointer can be
   * resolved against a moment (where things stood when a drag began)
   * while the frames move on. */
  hits(): H[];
  setOverlay(fn: OverlayFn<H> | null): void;
  /**
   * Swap the clock source behind the same canvas — the rebuild-in-place
   * path. Size, observers, and the overlay stay; the compiled script and
   * its replay cursor change, and the frame redraws at the new clock.
   */
  setPlayer(player: Player<ActLike>): void;
}

export interface AttachOptions<H> {
  /**
   * Clicking the canvas toggles play/pause — the viewer default. Editors
   * pass false so clicks are free for selection.
   */
  clickToggle?: boolean;
  /** Initial overlay; see DiagramView.setOverlay. */
  overlay?: OverlayFn<H>;
}

/** Everything language-shaped the attachment needs, injected by the pack. */
export interface ViewHooks<A extends ActLike, S, P, H>
  extends CursorHooks<A, S> {
  /** Read the live theme tokens — called again when the theme class flips. */
  readPalette(): P;
  /** Draw one moment of a scene. Pure: same frame inputs, same pixels. */
  drawScene(ctx: CanvasRenderingContext2D, frame: DrawFrame<S, P, H>): void;
  /** Topmost hit at a screen point — the pack owns pick priority. */
  pick(hits: H[], sx: number, sy: number): H | null;
}

/**
 * The diagram viewer: attaches a canvas to a player through a pack's hooks.
 * Scene state is event-sourced from the compiled script — when the clock
 * moves backward (loop wrap, seek), the scene resets and replays, so any
 * moment renders identically no matter how it was reached.
 */
export function attachDiagramView<A extends ActLike, S, P, H>(
  canvas: HTMLCanvasElement,
  initial: Player<A>,
  hooks: ViewHooks<A, S, P, H>,
  opts?: AttachOptions<H>,
): DiagramView<H> | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let player = initial;
  let compiled = player.compiled;
  let reduced = player.reducedMotion;

  let palette = hooks.readPalette();
  let width = 0;
  let height = 0;
  let overlay: OverlayFn<H> | null = opts?.overlay ?? null;
  const hits: H[] = [];
  let cursor = createSceneCursor(compiled.events, hooks);

  function draw(): void {
    if (!ctx) return;
    hits.length = 0;
    hooks.drawScene(ctx, {
      scene: cursor.scene(),
      t: cursor.time(),
      width,
      height,
      palette,
      cams: compiled.cams,
      reduced,
      hits,
    });
    overlay?.(ctx, hits);
  }

  const onTick = (t: number): void => {
    cursor.sync(t);
    draw();
  };
  let offFrame = player.onFrame(onTick);

  const themeObserver = new MutationObserver(() => {
    palette = hooks.readPalette();
    draw();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const resizeObserver = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  });
  resizeObserver.observe(canvas);

  const onClick = (): void => {
    if (!reduced) player.toggle();
  };
  if (opts?.clickToggle !== false) canvas.addEventListener("click", onClick);

  cursor.sync(player.clock());
  draw();

  const view = (): View =>
    makeView(camRectAt(compiled.cams, cursor.time(), reduced), width, height);

  return {
    destroy() {
      offFrame();
      themeObserver.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("click", onClick);
    },
    redraw: draw,
    camera: () => camRectAt(compiled.cams, cursor.time(), reduced),
    toWorld(sx, sy) {
      const v = view();
      return [v.wx(sx), v.wy(sy)];
    },
    toScreen(wx, wy) {
      const v = view();
      return [v.sx(wx), v.sy(wy)];
    },
    hitTest: (sx, sy) => hooks.pick(hits, sx, sy),
    hits: () => hits.slice(),
    setOverlay(fn) {
      overlay = fn;
      draw();
    },
    setPlayer(next) {
      offFrame();
      player = next as Player<A>;
      compiled = player.compiled;
      reduced = player.reducedMotion;
      cursor = createSceneCursor(compiled.events, hooks);
      offFrame = player.onFrame(onTick);
      cursor.sync(player.clock());
      draw();
    },
  };
}
