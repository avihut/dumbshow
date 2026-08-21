/**
 * webm export — the full animation as video, feature-detected.
 *
 * A zero-fps captureStream plus requestFrame gives exact offline frames;
 * MediaRecorder stamps them by wall clock, so the render is paced in real
 * time (exporting a 30s story takes ~30s — the progress notices say so).
 * Browsers without MediaRecorder webm support simply don't get the menu
 * entry; GIF is the always-available fallback.
 */

import type { Compiled } from "../engine";
import type { ActLike } from "../language";
import { createOfflineRenderer, type OfflineScene } from "./offline";

const MIMES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export function webmMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIMES)
    if (MediaRecorder.isTypeSupported?.(mime)) return mime;
  return null;
}

export interface WebmOptions<P> {
  width: number;
  height: number;
  palette?: P;
  /** Frames per second; also the real-time pacing of the export. */
  fps?: number;
  onProgress?: (frame: number, total: number) => void;
}

export async function renderWebmBlob<A extends ActLike, S, P>(
  scene: OfflineScene<A, S, P>,
  compiled: Compiled<A>,
  opts: WebmOptions<P>,
): Promise<Blob> {
  const mime = webmMimeType();
  if (!mime) throw new Error("This browser cannot record webm — export a GIF.");
  const fps = opts.fps ?? 30;
  const renderer = createOfflineRenderer(scene, compiled, {
    width: opts.width,
    height: opts.height,
    palette: opts.palette,
  });
  renderer.renderAt(0);
  const stream = renderer.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  const total = Math.max(1, Math.ceil(compiled.duration * fps)) + 1;
  for (let i = 0; i < total; i++) {
    renderer.renderAt(Math.min(i / fps, compiled.duration));
    track.requestFrame();
    opts.onProgress?.(i + 1, total);
    await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
  }
  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: mime.split(";")[0] });
}
