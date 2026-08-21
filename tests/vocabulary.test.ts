import { BOXES_PACK } from "@dumbshow/boxes";
import {
  catalogGroups,
  isEventOp,
  rowLabel,
  searchChips,
  seedMetaItem,
  seedOpItem,
} from "@dumbshow/core";
import { describe, expect, it } from "vitest";

describe("the catalog derives from the pack", () => {
  it("groups elements, verbs, events, and meta", () => {
    const groups = catalogGroups(BOXES_PACK);
    expect(groups.map((g) => g.title)).toEqual([
      "Elements",
      "Verbs",
      "Events",
      "Meta",
    ]);
    expect(groups[0].chips).toEqual([]); // boxes drop nothing from a palette
    expect(groups[1].chips.map((c) => c.id)).toEqual([
      "add",
      "link",
      "unlink",
      "remove",
    ]);
    expect(groups[2].chips).toEqual([
      {
        id: "pulse",
        label: "pulse",
        kind: "op",
        event: true,
        hint: "A box draws attention to itself for a beat.",
      },
    ]);
    expect(groups[3].chips.map((c) => c.id)).toEqual(["chapter", "beat"]);
  });

  it("searches by label and drops empty groups", () => {
    const groups = catalogGroups(BOXES_PACK);
    expect(searchChips(groups, "  ")).toBe(groups);
    const hits = searchChips(groups, "LINK");
    expect(hits.map((g) => [g.title, g.chips.map((c) => c.id)])).toEqual([
      ["Verbs", ["link", "unlink"]],
    ]);
    expect(searchChips(groups, "nothing-here")).toEqual([]);
  });

  it("seeds items from world-aware field defaults", () => {
    const world = BOXES_PACK.emptyWorld();
    expect(seedOpItem(BOXES_PACK, "add", world)).toEqual({
      kind: "op",
      op: "add",
      args: { name: "alpha" },
    });
    expect(seedOpItem(BOXES_PACK, "nope", world)).toBeNull();
    expect(seedMetaItem("chapter")).toEqual({
      kind: "chapter",
      title: "Chapter",
    });
    expect(seedMetaItem("beat")).toEqual({ kind: "beat", secs: 1 });
    expect(seedMetaItem("x")).toBeNull();
    expect(isEventOp(BOXES_PACK, "pulse")).toBe(true);
    expect(isEventOp(BOXES_PACK, "add")).toBe(false);
  });

  it("labels timeline rows tersely", () => {
    expect(rowLabel(BOXES_PACK, { kind: "chapter", title: "Two" })).toEqual({
      verb: "chapter",
      rest: "Two",
    });
    expect(rowLabel(BOXES_PACK, { kind: "beat", secs: 2 })).toEqual({
      verb: "beat",
      rest: "2s",
    });
    expect(
      rowLabel(BOXES_PACK, {
        kind: "op",
        op: "link",
        args: { a: "alpha", b: "beta", c: "gamma", d: "none", e: 3 },
      }),
    ).toEqual({ verb: "link", rest: "alpha beta" });
    expect(
      rowLabel(BOXES_PACK, { kind: "op", op: "unknown", args: {} }),
    ).toEqual({ verb: "unknown", rest: "" });
  });
});
