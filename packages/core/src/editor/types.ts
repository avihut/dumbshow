/**
 * Editor-level shapes shared by every framework's editor UI: what the
 * editor can have selected, and the host chrome it takes as props. They
 * live in the core so a pack's inspector and a host can type against them
 * without depending on a UI framework.
 */

import type { DocItem } from "./doc";

/** A timeline item selected in the editor. */
export interface ItemSelection {
  type: "item";
  index: number;
  item: DocItem;
  /** World before the item ran (derived.worlds[index]) — pack data. */
  world: unknown;
  skipped: boolean;
}

/**
 * Everything the editor can have selected: a timeline item, or a scene
 * entity — a pack-shaped value (entities.select) carried opaquely.
 */
export type EditorSelection = ItemSelection | { type: "entity"; sel: unknown };

/** An entry in the editor's export menu — the menu renders whatever the
 * app can do. */
export interface ExportEntry {
  id: string;
  label: string;
  hint: string;
  run: () => void | Promise<void>;
}

/** The host's corner link out of the editor — absent hides the corner. */
export interface BackLink {
  href: string;
  /** Accessible label ("Back to …"). */
  label: string;
  /** The visible text beside the chevron. */
  text: string;
}
