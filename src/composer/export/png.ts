/**
 * PNG still — the current state, exactly as framed, at 2x.
 *
 * Works on any document (a still IS the point): one offline render at the
 * requested clock value, transparent background preserved so the image
 * sits on any page.
 */

import type { Compiled } from "../../engine";
import type { ActLike } from "../../language";
import { createOfflineRenderer, type OfflineScene } from "./offline";

export async function renderPngBlob<A extends ActLike, S, P>(
  scene: OfflineScene<A, S, P>,
  compiled: Compiled<A>,
  t: number,
  opts: { width: number; height: number; palette?: P },
): Promise<Blob> {
  const renderer = createOfflineRenderer(scene, compiled, {
    ...opts,
    scale: 2,
  });
  renderer.renderAt(t);
  return new Promise((resolve, reject) => {
    renderer.canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
      "image/png",
    );
  });
}
