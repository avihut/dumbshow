/**
 * The offline renderer — export pixels without a player or a DOM viewer.
 *
 * A detached canvas, its own scene cursor, and the same pure drawScene the
 * live viewer uses — all injected through the pack's scene hooks, so this
 * module never learns what a scene contains. Replay is deterministic, so
 * every frame is exactly reproducible and geometry-identical to the
 * screen. The one deliberate difference: Chromium gives DOM-attached
 * canvases LCD-subpixel text antialiasing, while detached ones render
 * grayscale — verified byte-equal when attached — and grayscale is the
 * right choice for a portable file (subpixel fringes assume one screen's
 * layout and look wrong in scaled GIF/video). Reduced motion is
 * hard-coded OFF — an author with reduced motion must not silently export
 * a motionless animation.
 */

import type { Compiled } from "../engine";
import type { ActLike } from "../language";
import { createSceneCursor, type DrawFrame } from "../render-core";

/** The pack hooks offline rendering needs — a language's scene half. */
export interface OfflineScene<A extends ActLike, S, P> {
  createScene(): S;
  applyAct(scene: S, act: A, at: number): void;
  drawScene(
    ctx: CanvasRenderingContext2D,
    frame: DrawFrame<S, P, unknown>,
  ): void;
  readPalette(): P;
}

export interface OfflineOptions<P> {
  width: number;
  height: number;
  /** Device-pixel multiplier baked into the bitmap (2 = crisp stills). */
  scale?: number;
  /** Defaults to the live theme tokens at creation time. */
  palette?: P;
}

export interface OfflineRenderer {
  canvas: HTMLCanvasElement;
  /** Render one absolute time. Monotonic calls replay incrementally;
   * going backward rebuilds — same contract as the live cursor. */
  renderAt(t: number): void;
}

export function createOfflineRenderer<A extends ActLike, S, P>(
  scene: OfflineScene<A, S, P>,
  compiled: Compiled<A>,
  opts: OfflineOptions<P>,
): OfflineRenderer {
  const scale = opts.scale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(opts.width * scale);
  canvas.height = Math.round(opts.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The offline renderer needs a 2d context.");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const palette = opts.palette ?? scene.readPalette();
  const cursor = createSceneCursor(compiled.events, scene);
  return {
    canvas,
    renderAt(t) {
      cursor.sync(t);
      scene.drawScene(ctx, {
        scene: cursor.scene(),
        t: cursor.time(),
        width: opts.width,
        height: opts.height,
        palette,
        cams: compiled.cams,
        reduced: false,
        hits: [],
      });
    },
  };
}

/**
 * Step the whole timeline at a fixed frame rate, yielding after each frame
 * so encoders can consume it (and the page can breathe). The callback may
 * be async; frames arrive strictly in order.
 */
export async function eachFrame<A extends ActLike, S, P>(
  scene: OfflineScene<A, S, P>,
  compiled: Compiled<A>,
  opts: OfflineOptions<P> & { fps?: number },
  fn: (
    canvas: HTMLCanvasElement,
    frame: number,
    total: number,
    t: number,
  ) => void | Promise<void>,
): Promise<void> {
  const fps = opts.fps ?? 12;
  const renderer = createOfflineRenderer(scene, compiled, opts);
  const total = Math.max(1, Math.ceil(compiled.duration * fps)) + 1;
  for (let i = 0; i < total; i++) {
    const t = Math.min(i / fps, compiled.duration);
    renderer.renderAt(t);
    await fn(renderer.canvas, i, total, t);
  }
}
