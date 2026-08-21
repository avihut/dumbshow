/**
 * The diagram engine — a timeline of steps, compiled and played.
 *
 * A diagram is a script of steps; each step is a list of beats (terminal
 * lines, scene acts, camera moves). `compile` flattens the script onto one
 * absolute timeline, and the headless player owns a clock over it: state is
 * event-sourced, so pausing, stepping, and seeking backwards are all just
 * "set the clock and replay". Nothing is random — every replay is identical.
 *
 * The engine is generic over a language's acts (./language.ts): it schedules
 * them and carries them through compiled events, but never reads anything
 * beyond `kind`. What acts mean — scene state, drawing, viewer attachment —
 * lives on the pack side, behind the scene hooks the contract declares.
 */

import type { ActLike } from "./language";

export interface CamRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Output-line tones mirror the diagram's color law: `ok` teal = setup and
 * checks, `agent` purple = AI agents, `rust` = destructive operations,
 * `dim` = commentary. Commands render their leading verb in the accent
 * color — the pack names it through `shellVerb`.
 */
export type TermTone = "ok" | "dim" | "agent" | "rust";

export type Beat<A extends ActLike> =
  | { cmd: string }
  | { out: string; tone?: TermTone }
  | { act: A }
  | { pause: number }
  | { cam: CamRect };

export interface StepDef<A extends ActLike> {
  title: string;
  cam: CamRect;
  beats: Beat<A>[];
  /** Hide this step's terminal lines; scene effects and timing still run. */
  silent?: boolean;
}

export interface TermLine {
  at: number;
  /** For cmd lines, when typing finishes; for output lines, equal to `at`. */
  typed: number;
  kind: "cmd" | "out" | TermTone;
  text: string;
  /** Index of the step this line belongs to. */
  step: number;
  /** True on the first command of a step — the clickable checkpoint. */
  checkpoint: boolean;
  /** Hidden from terminal rendering — the owning step is silent. */
  hidden?: boolean;
}

export interface SceneEvent<A extends ActLike> {
  at: number;
  act: A;
}

export interface CamKey {
  at: number;
  rect: CamRect;
}

export interface CompiledStep {
  at: number;
  end: number;
  /** Checkpoint pause point: just after the step's first command is typed. */
  cue: number;
  title: string;
  /** The source step was silent — its terminal lines are hidden. */
  silent?: boolean;
}

export interface Compiled<A extends ActLike> {
  duration: number;
  steps: CompiledStep[];
  term: TermLine[];
  events: SceneEvent<A>[];
  cams: CamKey[];
}

const TYPE_SECS_PER_CHAR = 0.024;
const CMD_LEAD = 0.45;
const CMD_TAIL = 0.4;
const OUT_GAP = 0.55;
const STEP_TAIL = 1.5;

export function compile<A extends ActLike>(steps: StepDef<A>[]): Compiled<A> {
  const term: TermLine[] = [];
  const events: SceneEvent<A>[] = [];
  const cams: CamKey[] = [];
  const outSteps: CompiledStep[] = [];
  let t = 0.6;

  steps.forEach((step, si) => {
    const at = t;
    let cue = at;
    let firstCmd = true;
    cams.push({ at, rect: step.cam });
    for (const beat of step.beats) {
      if ("cmd" in beat) {
        const dur = CMD_LEAD + beat.cmd.length * TYPE_SECS_PER_CHAR;
        term.push({
          at: t,
          typed: t + dur,
          kind: "cmd",
          text: beat.cmd,
          step: si,
          checkpoint: firstCmd,
          ...(step.silent ? { hidden: true } : {}),
        });
        if (firstCmd) cue = t + dur;
        firstCmd = false;
        t += dur + CMD_TAIL;
      } else if ("out" in beat) {
        const kind = beat.tone ?? "out";
        term.push({
          at: t,
          typed: t,
          kind,
          text: beat.out,
          step: si,
          checkpoint: false,
          ...(step.silent ? { hidden: true } : {}),
        });
        t += OUT_GAP;
      } else if ("act" in beat) {
        events.push({ at: t, act: beat.act });
      } else if ("cam" in beat) {
        cams.push({ at: t, rect: beat.cam });
      } else {
        t += beat.pause;
      }
    }
    t += STEP_TAIL;
    outSteps.push({
      at,
      end: t,
      cue,
      title: step.title,
      ...(step.silent ? { silent: true } : {}),
    });
  });

  return { duration: t + 0.8, steps: outSteps, term, events, cams };
}

/* -------------------------------- player --------------------------------- */

export interface PlayerOptions<A extends ActLike> {
  script: StepDef<A>[];
  /** Ignored (forced off) when the user prefers reduced motion. */
  autoplay?: boolean;
  /** Wrap to the start when the timeline ends (default). Off = end paused. */
  loop?: boolean;
  /**
   * Assign the player to `window[devHandle]` so the timeline can be driven
   * from the console or a test harness. Hosts gate this on their own dev
   * mode — the engine assigns whenever a name is given.
   */
  devHandle?: string;
}

/**
 * The headless timeline player: one clock per diagram, no rendering. Viewers
 * (the canvas diagram, the terminal) subscribe via `onFrame` and derive their
 * entire presentation from the compiled script plus the clock value — which
 * is what keeps any number of viewers in perfect sync, and what makes seeks
 * in either direction safe: a viewer that sees time move backward replays
 * its state from scratch.
 */
export interface Player<A extends ActLike> {
  compiled: Compiled<A>;
  reducedMotion: boolean;
  playing(): boolean;
  clock(): number;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Jump to an absolute time (seconds); play state is left untouched. */
  seek(t: number): void;
  seekStep(index: number): void;
  /**
   * Jump to a step's checkpoint — its first command just typed — and pause,
   * so play resumes by executing that command.
   */
  seekCheckpoint(index: number): void;
  /** Jump to the settled end state of a step without animating into it. */
  settle(index: number): void;
  next(): void;
  prev(): void;
  current(): number;
  setRate(rate: number): void;
  setLoop(on: boolean): void;
  /**
   * Visibility gating, owned by whoever created the player: `suspend` stops
   * the frame loop without touching play state, `resume` picks it back up.
   */
  suspend(): void;
  resume(): void;
  onFrame(fn: (t: number) => void): () => void;
  onStep(fn: (index: number) => void): () => void;
  onPlayState(fn: (playing: boolean) => void): () => void;
  destroy(): void;
}

export function createPlayer<A extends ActLike>(
  opts: PlayerOptions<A>,
): Player<A> {
  const compiled = compile(opts.script);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let clock = 0;
  let playing = false;
  let suspended = false;
  let raf = 0;
  let lastFrame = 0;
  let stepIdx = -1;
  let rate = 1;
  let loop = opts.loop !== false;

  const frameSubs = new Set<(t: number) => void>();
  const stepSubs = new Set<(index: number) => void>();
  const playSubs = new Set<(playing: boolean) => void>();

  function emitFrame(): void {
    for (const fn of frameSubs) fn(clock);
  }

  function currentStep(): number {
    let i = 0;
    for (let k = 0; k < compiled.steps.length; k++) {
      if (compiled.steps[k].at <= clock) i = k;
    }
    return i;
  }

  function notifyStep(): void {
    const i = currentStep();
    if (i !== stepIdx) {
      stepIdx = i;
      for (const fn of stepSubs) fn(i);
    }
  }

  function schedule(): void {
    if (playing && !suspended && !raf) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function setPlaying(on: boolean): void {
    if (playing === on) return;
    playing = on;
    for (const fn of playSubs) fn(on);
    schedule();
  }

  function frame(now: number): void {
    raf = 0;
    if (!playing || suspended) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.05) * rate;
    lastFrame = now;
    clock += dt;
    if (clock > compiled.duration) {
      if (loop) {
        clock = 0; // viewers see time move backward and replay from scratch
      } else {
        clock = compiled.duration;
        setPlaying(false);
      }
    }
    notifyStep();
    emitFrame();
    schedule();
  }

  function setClock(t: number): void {
    clock = Math.min(Math.max(t, 0), compiled.duration);
    notifyStep();
    emitFrame();
  }

  function stepAt(index: number): CompiledStep {
    return compiled.steps[
      Math.min(Math.max(index, 0), compiled.steps.length - 1)
    ];
  }

  function settle(index: number): void {
    const step = stepAt(index);
    // A very short step's end-epsilon could precede its own start — clamp.
    setClock(Math.max(step.at, step.end - 0.05));
  }

  function seekStep(index: number): void {
    // Reduced motion lands on the settled end of the step; otherwise the
    // step replays animated from its start.
    if (reduced) {
      settle(index);
      return;
    }
    setClock(stepAt(index).at);
  }

  function seekCheckpoint(index: number): void {
    setPlaying(false);
    if (reduced) {
      settle(index);
      return;
    }
    const step = stepAt(index);
    setClock(Math.min(step.cue + 0.02, step.end - 0.05));
  }

  const player: Player<A> = {
    compiled,
    reducedMotion: reduced,
    playing: () => playing,
    clock: () => clock,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying(!playing),
    seek: setClock,
    seekStep,
    seekCheckpoint,
    settle,
    next: () =>
      seekStep(Math.min(currentStep() + 1, compiled.steps.length - 1)),
    prev: () => seekStep(Math.max(currentStep() - 1, 0)),
    current: currentStep,
    setRate(value: number) {
      rate = Math.min(Math.max(value, 0.1), 4);
    },
    setLoop(on: boolean) {
      loop = on;
    },
    suspend() {
      suspended = true;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    resume() {
      suspended = false;
      schedule();
    },
    onFrame(fn) {
      frameSubs.add(fn);
      return () => frameSubs.delete(fn);
    },
    onStep(fn) {
      stepSubs.add(fn);
      return () => stepSubs.delete(fn);
    },
    onPlayState(fn) {
      playSubs.add(fn);
      return () => playSubs.delete(fn);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      frameSubs.clear();
      stepSubs.clear();
      playSubs.clear();
    },
  };

  if (reduced) seekStep(compiled.steps.length - 1);
  else if (opts.autoplay !== false) setPlaying(true);
  notifyStep();

  // Host-named handle so the timeline can be driven from the console/tests.
  if (opts.devHandle && typeof window !== "undefined")
    Object.assign(window, { [opts.devHandle]: player });

  return player;
}

/**
 * Pause a player's frame loop while `el` is offscreen. Wire this from the
 * component that owns the player — a solo viewer, or the host composing two
 * viewers around one — and disconnect with the returned function.
 */
export function observeVisibility<A extends ActLike>(
  el: Element,
  player: Player<A>,
): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) player.resume();
        else player.suspend();
      }
    },
    { threshold: 0.05 },
  );
  io.observe(el);
  return () => io.disconnect();
}
