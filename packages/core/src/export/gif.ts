/**
 * GIF export — the full animation, looping, encoded offline.
 *
 * Frames come from the offline renderer at a fixed rate and feed gifenc
 * frame by frame (per-frame palettes, yielding between frames so the page
 * breathes). GIF has no alpha, so frames composite onto the page
 * background first; the longest edge caps at 900px to keep encode time
 * and file size sane — the cap is reported through onProgress totals, not
 * silently.
 */

import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { Compiled } from "../engine";
import type { ActLike } from "../language";
import { eachFrame, type OfflineScene } from "./offline";

export interface GifOptions<P> {
  width: number;
  height: number;
  palette?: P;
  /** Frames per second; 12 keeps files small and motion legible. */
  fps?: number;
  /** Opaque backdrop — defaults to the live page background token. */
  background?: string;
  onProgress?: (frame: number, total: number) => void;
}

const MAX_EDGE = 900;

export async function renderGifBlob<A extends ActLike, S, P>(
  scene: OfflineScene<A, S, P>,
  compiled: Compiled<A>,
  opts: GifOptions<P>,
): Promise<Blob> {
  const fps = opts.fps ?? 12;
  const k = Math.min(1, MAX_EDGE / Math.max(opts.width, opts.height));
  const width = Math.round(opts.width * k);
  const height = Math.round(opts.height * k);
  // `--dx-bg` always resolves — the editor stylesheet ships a default for
  // it — but an unstyled document would hand back "", which is not
  // nullish and would slip past `??` into fillStyle as a no-op.
  const background =
    opts.background ||
    getComputedStyle(document.documentElement)
      .getPropertyValue("--dx-bg")
      .trim() ||
    "#ffffff";

  const encoder = GIFEncoder();
  const compositor = document.createElement("canvas");
  compositor.width = width;
  compositor.height = height;
  const ctx = compositor.getContext("2d");
  if (!ctx) throw new Error("GIF encoding needs a 2d context.");

  await eachFrame(
    scene,
    compiled,
    { width, height, fps, palette: opts.palette },
    async (canvas, frame, total) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0);
      const { data } = ctx.getImageData(0, 0, width, height);
      const framePalette = quantize(data, 256);
      const indexed = applyPalette(data, framePalette);
      encoder.writeFrame(indexed, width, height, {
        palette: framePalette,
        delay: Math.round(1000 / fps),
      });
      opts.onProgress?.(frame + 1, total);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  );
  encoder.finish();
  return new Blob([encoder.bytes()], { type: "image/gif" });
}
