/**
 * The catalog's index — everything draggable, in four groups.
 *
 * Groups mirror the language's layers: Elements are scene entities (they
 * drop on the canvas and shape the seed), Verbs and Events are timeline
 * operations from the op registry, Meta are timeline annotations. The
 * catalog derives from the pack so a new op or element appears here
 * without any catalog-side edit — this module never names one.
 */

import type { ElementSpec, OpSpecOf } from "../language";
import type { DocItem } from "./doc";

/** The slice of a language pack the vocabulary reads. */
export interface VocabLang {
  ops: OpSpecOf<unknown, unknown>[];
  entities: { elements: ElementSpec[] };
}

export type ChipKind = "element" | "op" | "meta";

export interface Chip {
  id: string;
  label: string;
  kind: ChipKind;
  /** The op is an event — dashed styling, no shell command. */
  event?: boolean;
  /** Element chips carry the pack's glyph token to draw. */
  icon?: string;
  hint?: string;
}

export interface ChipGroup {
  title: string;
  chips: Chip[];
}

export function catalogGroups(lang: VocabLang): ChipGroup[] {
  return [
    {
      title: "Elements",
      chips: lang.entities.elements.map((e) => ({
        id: e.id,
        label: e.label,
        kind: "element" as const,
        ...(e.icon ? { icon: e.icon } : {}),
        ...(e.hint ? { hint: e.hint } : {}),
      })),
    },
    {
      title: "Verbs",
      chips: lang.ops
        .filter((o) => o.kind === "verb" && !o.typedOnly)
        .map((o) => ({
          id: o.id,
          label: o.label,
          kind: "op" as const,
          hint: o.summary,
        })),
    },
    {
      title: "Events",
      chips: lang.ops
        .filter((o) => o.kind === "event")
        .map((o) => ({
          id: o.id,
          label: o.label,
          kind: "op" as const,
          event: true,
          hint: o.summary,
        })),
    },
    {
      title: "Meta",
      chips: [
        { id: "chapter", label: "chapter", kind: "meta" },
        { id: "beat", label: "beat", kind: "meta" },
      ],
    },
  ];
}

export function searchChips(groups: ChipGroup[], query: string): ChipGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      title: g.title,
      chips: g.chips.filter((c) => c.label.toLowerCase().includes(q)),
    }))
    .filter((g) => g.chips.length > 0);
}

/** Default doc item for an op chip, seeded from world-aware field values. */
export function seedOpItem(
  lang: VocabLang,
  op: string,
  world: unknown,
): DocItem | null {
  const spec = lang.ops.find((o) => o.id === op);
  if (!spec) return null;
  const args: Record<string, unknown> = {};
  for (const f of spec.fields(world)) args[f.key] = f.value;
  return { kind: "op", op, args };
}

export function seedMetaItem(id: string): DocItem | null {
  if (id === "chapter") return { kind: "chapter", title: "Chapter" };
  if (id === "beat") return { kind: "beat", secs: 1 };
  return null;
}

export function isEventOp(lang: VocabLang, op: string): boolean {
  return lang.ops.find((o) => o.id === op)?.kind === "event";
}

/** Terse row label for a timeline item — the op plus its telling args. */
export function rowLabel(
  lang: VocabLang,
  item: DocItem,
): { verb: string; rest: string } {
  if (item.kind === "chapter") return { verb: "chapter", rest: item.title };
  if (item.kind === "beat") return { verb: "beat", rest: `${item.secs}s` };
  const label = lang.ops.find((o) => o.id === item.op)?.label ?? item.op;
  const parts = Object.values(item.args)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .filter((v) => v !== "none")
    .slice(0, 2);
  return { verb: label, rest: parts.join(" ") };
}
