/**
 * The language-pack seam — the contract between the generic diagram
 * machinery (engine clock, editor, exports) and a concrete diagram
 * language, assembled by whichever pack a host loads.
 *
 * The generic side owns documents, time, pointers, and pixels-as-plumbing:
 * compile/player, the editor chrome, drag mechanics, offline frame
 * stepping, persistence. A language owns MEANING: what entities exist
 * (the world), what can be said about them (ops), what happenings look
 * like (acts + scene + drawing), and how its shell spells things. This
 * file declares the shapes a pack provides; nothing here may name a pack
 * concept — the seam rule in CLAUDE.md keeps it that way.
 *
 * The contract grows only as the generic side consumes it (engine first,
 * then render scaffolding, then the editor); the reference pack in the
 * dumbshow harness is the honesty check that nothing pack-shaped leaks in.
 */

/** An act: one timed happening in a scene. The generic side never reads
 * anything but `kind` (and per-beat timing it assigned itself); packs
 * carry whatever payload their applyAct needs. */
export interface ActLike {
  kind: string;
}

export type VerbArgs = Record<string, unknown>;

export interface FieldSpec {
  key: string;
  label: string;
  kind: "text" | "choice";
  choices?: string[];
  /** World-aware default. */
  value: string;
}

/**
 * One shape for everything a timeline can hold: verbs print a command and
 * act; events act without a command — they are world happenings, not
 * things you type. `Step` is the pack's step type (the engine's StepDef
 * over the pack's acts).
 */
export interface OpSpecOf<W, Step> {
  id: string;
  kind: "verb" | "event";
  /** Reachable only by typing in the shell — not offered in the catalog. */
  typedOnly?: boolean;
  /** Short palette label. */
  label: string;
  /** How the command is written (verbs) or the happening phrased (events). */
  syntax: string;
  summary: string;
  /** Can this op do anything in this world? Gates the composer palette. */
  available(world: W): boolean;
  /** Composer form fields, with world-aware defaults and choices. */
  fields(world: W): FieldSpec[];
  /**
   * The exact shell command this invocation prints, resolved against the
   * world BEFORE the op runs — the single source of command text for
   * every surface. Events print no command and return null.
   */
  command(world: W, args: VerbArgs): string | null;
  /** Expand into one step, mutating the world. */
  run(world: W, args: VerbArgs): Step;
}

/** A typed line's parse outcome — the reverse of OpSpec.command(). */
export type ParseOutcomeOf =
  | { ok: true; op: string; args: VerbArgs }
  | { ok: false; error: string };

/** A catalog entry that drops on the canvas to build the seed. */
export interface ElementSpec {
  id: string;
  label: string;
  /** Glyph token for the catalog chip; the pane maps it to styling. */
  icon?: string;
  hint?: string;
}

/**
 * Scene-entity semantics the editor needs during direct manipulation.
 * Hits and selections are pack-shaped values the editor carries opaquely:
 * only the pack that drew them can read them.
 */
export interface EntityHooks<W, A extends ActLike> {
  /** The droppable element palette. */
  elements: ElementSpec[];
  /** Short human label for a scene entity (a draw-pass hit) — the editor
   * uses it wherever an entity is named in chrome. */
  label(hit: unknown): string;
  /** The pack's selection value for a picked hit — carried opaquely by
   * the editor and handed back to pack surfaces (inspector, overlay). */
  select(hit: unknown): unknown;
  /** The selection ring (or any marker) painted over each frame's hits
   * while this selection is active; null = nothing to paint. */
  selectionOverlay(
    selection: unknown,
  ): ((ctx: CanvasRenderingContext2D, hits: unknown[]) => void) | null;
  /**
   * The hover marker: painted over each frame's hits while the pointer
   * rests on this entity (its selection value), and over a drop target
   * while a drag passes across it. Absent or null = no marker.
   */
  hoverOverlay?(
    selection: unknown,
  ): ((ctx: CanvasRenderingContext2D, hits: unknown[]) => void) | null;
  /**
   * The lifted marker: painted over the entity being dragged, riding it
   * through the live preview. Absent or null = no marker.
   */
  dragOverlay?(
    selection: unknown,
  ): ((ctx: CanvasRenderingContext2D, hits: unknown[]) => void) | null;
  /**
   * Can this hit be dragged? A press on a non-draggable entity taps
   * (selects) however far it travels. Absent = every hit drags.
   */
  draggable?(hit: unknown): boolean;
  /**
   * Apply a canvas drop — an element chip or a dragged scene node — to
   * the document. The pack edits the document through the editor's pure
   * mutation helpers and returns the next document, an error to surface,
   * or null when the pair means nothing. `select` is the pack's entity
   * selection, handed back to the editor opaquely.
   */
  canvasDrop(drop: {
    doc: unknown;
    world: W;
    /** Compiled events at the drop moment — for freezing rendered slots. */
    compiled: { events: { at: number; act: A }[] };
    source: { kind: "element"; id: string } | { kind: "node"; hit: unknown };
    wx: number;
    wy: number;
    over: unknown;
  }): { doc: unknown; select?: unknown } | { error: string } | null;
}

/**
 * The seed half: a document's opening state is pack-schema data — the pack
 * defined what a seed can declare, so only the pack can read one. `seed`
 * and `placements` arrive as the document's own JSON, opaque to the
 * generic side; the world and step that come back are how the story opens.
 */
export interface SeedHooks<W, Step> {
  /** Build the pre-story world the document's seed declares. */
  world(seed: unknown, placements: unknown): W;
  /** The opening step: the seed drawn as scene only, no terminal lines. */
  step(world: W, placements: unknown): Step;
}

/**
 * Author-pinned geometry semantics. Placement data is document JSON with a
 * pack-defined schema and key grammar; the generic side only stores it and
 * hands it back through these hooks.
 */
export interface PlacementHooks<Step> {
  /** Stamp author-pinned slots onto a freshly built step's acts. */
  patchStep(step: Step, placements: unknown): void;
  /**
   * The geometry a compiled scene actually renders with — replayed through
   * the pack's own act application, so derived positions come out exactly
   * as drawn. Feeds freezing before edits that would reshuffle them.
   */
  fromCompiled(compiled: { events: { at: number; act: ActLike }[] }): unknown;
}

/**
 * One frame's draw input: the scene at a moment, the camera keys, the
 * pack-shaped palette, and the sink the draw pass records pickable
 * geometry into. Declared here — structurally identical to the render
 * core's `DrawFrame` — so scene hooks are fully typed without the
 * contract importing the machinery.
 */
export interface SceneFrame<S, P, H> {
  scene: S;
  t: number;
  width: number;
  height: number;
  palette: P;
  cams: { at: number; rect: { x: number; y: number; w: number; h: number } }[];
  reduced: boolean;
  /** The draw pass records pickable geometry into it. */
  hits: H[];
}

/**
 * The scene half: the pack owns its scene state shape, how acts apply to
 * it, and how a frame is drawn. The generic side owns the replay cursor,
 * the camera, and the canvas plumbing around these three.
 */
export interface SceneHooks<W, A extends ActLike, S> {
  createScene(): S;
  /** Apply one act at its absolute time — pure state, no drawing. */
  applyAct(scene: S, act: A, at: number): void;
  /** Draw one frame — the render core and the exports both drive this
   * with a `SceneFrame`; palette and hits stay pack-shaped. */
  drawScene(
    ctx: CanvasRenderingContext2D,
    frame: SceneFrame<S, unknown, unknown>,
  ): void;
  /** Fit-camera over a world — the opening frame's rect. */
  camFor(world: W): { x: number; y: number; w: number; h: number };
  /** Read the live theme tokens — called again when the theme flips. The
   * palette is pack-shaped; the generic side carries it opaquely. */
  readPalette(): unknown;
  /** Topmost hit at a screen point — the pack owns pick priority. */
  pick(hits: unknown[], sx: number, sy: number): unknown;
}

/**
 * A diagram language. `W` = world, `A` = act union, `S` = scene state,
 * `Step` = the engine step over `A`.
 */
export interface DiagramLanguage<W, A extends ActLike, S, Step> {
  /** The op registry — palette, shell, attributes, and derive all resolve
   * through it. */
  ops: OpSpecOf<W, Step>[];
  emptyWorld(): W;
  scene: SceneHooks<W, A, S>;
  seed: SeedHooks<W, Step>;
  placements: PlacementHooks<Step>;
  entities: EntityHooks<W, A>;
  /** Parse a typed shell line against a world (the pack tracks its own
   * cwd inside the world). Absent = the language has no shell. */
  parseCommand?(line: string, world: W): ParseOutcomeOf;
  /** The highlighted verb prefix of a command line ("" = none) — how the
   * shell knows which leading word to set in the accent color. */
  shellVerb?(text: string): string;
  /** Aria copy for the shell's input line — the language's own invitation
   * to type. Absent = the editor's generic default. */
  shellInputLabel?: string;
  /** A docs-ready embed snippet for a compiled script. Absent = the
   * language has no embedding story. */
  embedSnippet?(steps: Step[]): string;
}
