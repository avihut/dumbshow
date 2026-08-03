/**
 * The boxes reference pack — the smallest honest language.
 *
 * Boxes exist, link, unlink, leave, and (the one event) pulse. The pack's
 * whole job is to be dumbshow's SECOND consumer: every contract hook the
 * daft pack implements richly, boxes implements minimally, so anything
 * daft-shaped that leaks into the generic machinery fails here first.
 *
 * The pack types itself against the real contract — `DiagramLanguage`
 * from `../src` — so the whole hook surface typechecks here.
 *
 * Document format v1 carries the daft-shaped seed schema, so the boxes
 * pack keeps seeds empty (world() ignores the seed) — a generic seed
 * schema is the planned document-version bump.
 */

import type {
  DiagramLanguage,
  OpSpecOf,
  ParseOutcomeOf,
  StepDef,
  VerbArgs,
} from "../src";

type Step = StepDef<Act>;
type OpSpec = OpSpecOf<World, Step>;

/* --------------------------------- world --------------------------------- */

export interface WorldBox {
  name: string;
  x: number;
  y: number;
}

export interface World {
  boxes: WorldBox[];
  links: [string, string][];
}

export type Act =
  | { kind: "box"; name: string; x: number; y: number }
  | { kind: "link"; a: string; b: string }
  | { kind: "unlink"; a: string; b: string }
  | { kind: "unbox"; name: string }
  | { kind: "pulse"; name: string };

const NAMES = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
const SPOTS = [
  { x: 0, y: 0 },
  { x: 220, y: -90 },
  { x: 200, y: 130 },
  { x: -210, y: 110 },
  { x: -200, y: -120 },
  { x: 380, y: 20 },
];

function emptyWorld(): World {
  return { boxes: [], links: [] };
}

function findBox(world: World, name: string): WorldBox | undefined {
  return world.boxes.find((b) => b.name === name);
}

function linked(world: World, a: string, b: string): boolean {
  return world.links.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

function nextName(world: World): string {
  return (
    NAMES.find((n) => !findBox(world, n)) ?? `box${world.boxes.length + 1}`
  );
}

function str(args: VerbArgs, key: string, fallback: string): string {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function camFor(world: World): { x: number; y: number; w: number; h: number } {
  if (!world.boxes.length) return { x: 0, y: 0, w: 460, h: 400 };
  const xs = world.boxes.map((b) => b.x);
  const ys = world.boxes.map((b) => b.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    w: Math.max(maxX - minX + 320, 460),
    h: Math.max(maxY - minY + 280, 400),
  };
}

/* --------------------------------- scene --------------------------------- */

interface BoxState {
  name: string;
  x: number;
  y: number;
  birth: number;
  removed?: number;
}

interface LinkState {
  a: string;
  b: string;
  birth: number;
  removed?: number;
}

export interface Scene {
  boxes: BoxState[];
  links: LinkState[];
  pulses: { name: string; at: number }[];
}

function createScene(): Scene {
  return { boxes: [], links: [], pulses: [] };
}

function applyAct(scene: Scene, act: Act, at: number): void {
  switch (act.kind) {
    case "box":
      scene.boxes.push({ name: act.name, x: act.x, y: act.y, birth: at });
      break;
    case "link":
      scene.links.push({ a: act.a, b: act.b, birth: at });
      break;
    case "unlink":
      for (const l of scene.links) {
        const match =
          (l.a === act.a && l.b === act.b) || (l.a === act.b && l.b === act.a);
        if (match && l.removed === undefined) l.removed = at;
      }
      break;
    case "unbox": {
      const box = scene.boxes.find(
        (b) => b.name === act.name && b.removed === undefined,
      );
      if (box) box.removed = at;
      for (const l of scene.links)
        if ((l.a === act.name || l.b === act.name) && l.removed === undefined)
          l.removed = at;
      break;
    }
    case "pulse":
      scene.pulses.push({ name: act.name, at });
      break;
  }
}

interface Palette {
  ink: string;
  faint: string;
  accent: string;
  halo: string;
}

function readPalette(): Palette {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  return dark
    ? { ink: "#e5e2dc", faint: "#8a877f", accent: "#4fb3bf", halo: "#1b1a18" }
    : { ink: "#2c2a26", faint: "#a09d95", accent: "#12777f", halo: "#f5f3ef" };
}

export interface Hit {
  name: string;
  sx: number;
  sy: number;
  r: number;
}

function pick(hits: Hit[], sx: number, sy: number): Hit | null {
  return hits.find((h) => Math.hypot(sx - h.sx, sy - h.sy) <= h.r + 4) ?? null;
}

function ease(x: number): number {
  return 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;
}

interface DrawFrame {
  scene: Scene;
  t: number;
  width: number;
  height: number;
  palette: Palette;
  cams: { at: number; rect: { x: number; y: number; w: number; h: number } }[];
  reduced: boolean;
  hits: Hit[];
}

function drawScene(ctx: CanvasRenderingContext2D, frame: DrawFrame): void {
  const { scene, t, width, height, palette, cams, reduced } = frame;
  ctx.clearRect(0, 0, width, height);
  let rect = cams[0]?.rect ?? { x: 0, y: 0, w: 460, h: 400 };
  let prev = rect;
  for (const key of cams) {
    if (key.at <= t) {
      prev = rect;
      rect = key.rect;
    }
  }
  const p = reduced ? 1 : ease(t);
  const cam = {
    x: prev.x + (rect.x - prev.x) * p,
    y: prev.y + (rect.y - prev.y) * p,
    w: prev.w + (rect.w - prev.w) * p,
    h: prev.h + (rect.h - prev.h) * p,
  };
  const s = Math.min(width / cam.w, height / cam.h);
  const sx = (wx: number): number => width / 2 + (wx - cam.x) * s;
  const sy = (wy: number): number => height / 2 + (wy - cam.y) * s;
  const alive = (birth: number, removed?: number): number => {
    const grown = ease((t - birth) / 0.6);
    if (removed === undefined) return grown;
    return grown * Math.max(0, 1 - (t - removed) / 0.8);
  };

  ctx.lineWidth = 1.4;
  for (const link of scene.links) {
    const a = scene.boxes.find((b) => b.name === link.a);
    const b = scene.boxes.find((b) => b.name === link.b);
    if (!a || !b) continue;
    const k = alive(link.birth, link.removed);
    if (k <= 0) continue;
    ctx.globalAlpha = k * 0.8;
    ctx.strokeStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.stroke();
  }

  for (const box of scene.boxes) {
    const k = alive(box.birth, box.removed);
    if (k <= 0) continue;
    const half = 16 * k;
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.halo;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(sx(box.x) - half, sy(box.y) - half, half * 2, half * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.globalAlpha = k;
    ctx.fillText(box.name, sx(box.x), sy(box.y) + half + 12);
    if (box.removed === undefined)
      frame.hits.push({ name: box.name, sx: sx(box.x), sy: sy(box.y), r: 20 });
  }

  for (const pulse of scene.pulses) {
    const k = (t - pulse.at) / 0.9;
    if (k < 0 || k > 1) continue;
    const box = scene.boxes.find((b) => b.name === pulse.name);
    if (!box) continue;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(sx(box.x), sy(box.y), 18 + k * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------- ops ----------------------------------- */

function addStep(world: World, name: string): Step {
  const spot = SPOTS[world.boxes.length % SPOTS.length];
  world.boxes.push({ name, x: spot.x, y: spot.y });
  return {
    title: `Add ${name}`,
    cam: camFor(world),
    beats: [
      { cmd: `box add ${name}` },
      { act: { kind: "box", name, x: spot.x, y: spot.y } },
      { out: `${name} is on the board`, tone: "ok" },
    ],
  };
}

const OPS: OpSpec[] = [
  {
    id: "add",
    kind: "verb",
    label: "add",
    syntax: "box add <name>",
    summary: "Put a new box on the board.",
    available: () => true,
    fields: (world) => [
      { key: "name", label: "Name", kind: "text", value: nextName(world) },
    ],
    command: (world, args) => `box add ${str(args, "name", nextName(world))}`,
    run: (world, args) => addStep(world, str(args, "name", nextName(world))),
  },
  {
    id: "link",
    kind: "verb",
    label: "link",
    syntax: "box link <a> <b>",
    summary: "Join two boxes with a line.",
    available: (world) =>
      world.boxes.length >= 2 &&
      world.boxes.some((a) =>
        world.boxes.some(
          (b) => a.name < b.name && !linked(world, a.name, b.name),
        ),
      ),
    fields: (world) => {
      const names = world.boxes.map((b) => b.name);
      return [
        {
          key: "a",
          label: "From",
          kind: "choice",
          choices: names,
          value: names[0] ?? "",
        },
        {
          key: "b",
          label: "To",
          kind: "choice",
          choices: names,
          value: names[1] ?? "",
        },
      ];
    },
    command: (_world, args) =>
      `box link ${str(args, "a", "")} ${str(args, "b", "")}`,
    run: (world, args) => {
      const a = str(args, "a", "");
      const b = str(args, "b", "");
      world.links.push([a, b]);
      return {
        title: `Link ${a} and ${b}`,
        cam: camFor(world),
        beats: [{ cmd: `box link ${a} ${b}` }, { act: { kind: "link", a, b } }],
      };
    },
  },
  {
    id: "unlink",
    kind: "verb",
    label: "unlink",
    syntax: "box unlink <a> <b>",
    summary: "Cut the line between two boxes.",
    available: (world) => world.links.length > 0,
    fields: (world) => {
      const pairs = world.links.map(([a, b]) => `${a} ${b}`);
      return [
        {
          key: "pair",
          label: "Link",
          kind: "choice",
          choices: pairs,
          value: pairs[0] ?? "",
        },
      ];
    },
    command: (_world, args) => `box unlink ${str(args, "pair", "")}`,
    run: (world, args) => {
      const [a = "", b = ""] = str(args, "pair", "").split(" ");
      world.links = world.links.filter(
        ([x, y]) => !((x === a && y === b) || (x === b && y === a)),
      );
      return {
        title: `Unlink ${a} and ${b}`,
        cam: camFor(world),
        beats: [
          { cmd: `box unlink ${a} ${b}` },
          { act: { kind: "unlink", a, b } },
        ],
      };
    },
  },
  {
    id: "remove",
    kind: "verb",
    label: "remove",
    syntax: "box rm <name>",
    summary: "Take a box off the board; its links go with it.",
    available: (world) => world.boxes.length > 0,
    fields: (world) => {
      const names = world.boxes.map((b) => b.name);
      return [
        {
          key: "name",
          label: "Box",
          kind: "choice",
          choices: names,
          value: names[0] ?? "",
        },
      ];
    },
    command: (_world, args) => `box rm ${str(args, "name", "")}`,
    run: (world, args) => {
      const name = str(args, "name", "");
      world.boxes = world.boxes.filter((b) => b.name !== name);
      world.links = world.links.filter(([a, b]) => a !== name && b !== name);
      return {
        title: `Remove ${name}`,
        cam: camFor(world),
        beats: [
          { cmd: `box rm ${name}` },
          { act: { kind: "unbox", name } },
          { out: `${name} left the board`, tone: "rust" },
        ],
      };
    },
  },
  {
    id: "pulse",
    kind: "event",
    label: "pulse",
    syntax: "a box pulses",
    summary: "A box draws attention to itself for a beat.",
    available: (world) => world.boxes.length > 0,
    fields: (world) => {
      const names = world.boxes.map((b) => b.name);
      return [
        {
          key: "name",
          label: "Box",
          kind: "choice",
          choices: names,
          value: names[0] ?? "",
        },
      ];
    },
    command: () => null,
    run: (world, args) => {
      const name = str(args, "name", "");
      return {
        title: `${name} pulses`,
        cam: camFor(world),
        beats: [{ act: { kind: "pulse", name } }, { pause: 1 }],
      };
    },
  },
];

/* --------------------------------- shell ---------------------------------- */

function parseCommand(line: string, world: World): ParseOutcomeOf {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== "box")
    return { ok: false, error: "boxes speak `box <verb>`" };
  switch (parts[1]) {
    case "add":
      return {
        ok: true,
        op: "add",
        args: { name: parts[2] ?? nextName(world) },
      };
    case "link":
      if (!parts[2] || !parts[3])
        return { ok: false, error: "box link <a> <b>" };
      return { ok: true, op: "link", args: { a: parts[2], b: parts[3] } };
    case "unlink":
      if (!parts[2] || !parts[3])
        return { ok: false, error: "box unlink <a> <b>" };
      return {
        ok: true,
        op: "unlink",
        args: { pair: `${parts[2]} ${parts[3]}` },
      };
    case "rm":
      if (!parts[2] || !findBox(world, parts[2]))
        return { ok: false, error: `no box named ${parts[2] ?? "?"}` };
      return { ok: true, op: "remove", args: { name: parts[2] } };
    default:
      return { ok: false, error: `box knows add, link, unlink, rm` };
  }
}

/* --------------------------------- pack ----------------------------------- */

/**
 * Seeds stay empty under document format v1 (its seed schema belongs to
 * the daft pack); placements pass through untouched.
 */
export const BOXES_PACK: DiagramLanguage<World, Act, Scene, Step> = {
  ops: OPS,
  emptyWorld,
  scene: { createScene, applyAct, drawScene, camFor, readPalette, pick },
  seed: {
    world: (): World => emptyWorld(),
    step: (world: World): Step => ({
      title: "Scene",
      cam: camFor(world),
      beats: [{ pause: 0.4 }],
      silent: true,
    }),
  },
  placements: {
    patchStep: (): void => {},
    fromCompiled: (): {
      repos: Record<string, never>;
      wts: Record<string, never>;
    } => ({
      repos: {},
      wts: {},
    }),
  },
  entities: {
    elements: [],
    label: (hit: unknown): string => (hit as Hit).name,
    select: (hit: unknown): unknown => hit,
    selectionOverlay: (): null => null,
    canvasDrop: (): null => null,
  },
  parseCommand,
  shellVerb: (text: string): string => (text.startsWith("box") ? "box" : ""),
  shellInputLabel: "Type a box command — it lands on the timeline",
};
