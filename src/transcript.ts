/**
 * daft terminal transcript — the shell projection of a compiled timeline.
 *
 * Given a compiled script's term lines and a clock value, compute what the
 * shell shows at that moment: how many lines are fully visible, and the
 * partial text of a command still being typed. Pure and window-free — it
 * runs during SSR — and shared by every terminal presentation of a script,
 * so they can never disagree about what the shell said at time t.
 */

import type { TermLine } from "./engine";

export interface Transcript {
  /** Fully visible lines: the first `count` entries of the term list. */
  count: number;
  /** Partial text of the command being typed at t, or null if none. */
  typing: string | null;
}

export function transcriptAt(term: TermLine[], t: number): Transcript {
  let count = 0;
  let typing: string | null = null;
  for (const line of term) {
    if (line.at > t) break;
    if (line.kind === "cmd" && t < line.typed) {
      // A silent step's command still takes its typing time — the world
      // moves on the same clock — but shows no caret and no text.
      if (!line.hidden) {
        const progress = (t - line.at) / (line.typed - line.at);
        typing = line.text.slice(
          0,
          Math.floor(line.text.length * Math.max(0, progress)),
        );
      }
      break;
    }
    count++;
  }
  return { count, typing };
}

/** The renderable prefix: silent steps' lines are counted but never shown. */
export function visibleLines(term: TermLine[], count: number): TermLine[] {
  return term.slice(0, count).filter((l) => !l.hidden);
}
