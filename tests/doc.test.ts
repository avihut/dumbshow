import { DOC_VERSION, emptyDoc, parseDoc, serializeDoc } from "@dumbshow/core";
import { describe, expect, it } from "vitest";

describe("document model", () => {
  it("starts empty at the current format version", () => {
    const doc = emptyDoc();
    expect(doc.version).toBe(DOC_VERSION);
    expect(doc.title).toBe("Untitled scenario");
    expect(doc.timeline).toEqual([]);
    expect(doc.seed).toEqual({ repos: [], rels: [] });
    expect(doc.placements).toEqual({ repos: {}, wts: {} });
  });

  it("round-trips through serialize and parse", () => {
    const doc = emptyDoc();
    doc.title = "Round trip";
    doc.timeline.push(
      { kind: "chapter", title: "One" },
      { kind: "op", op: "add", args: { name: "alpha" }, silent: true },
      { kind: "beat", secs: 2 },
    );
    doc.placements.repos.alpha = { x: 10, y: -20 };
    doc.placements.wts["alpha:main"] = { ang: 1.5, dist: 140 };
    expect(parseDoc(serializeDoc(doc))).toEqual(doc);
  });

  it("serializes as pretty JSON with a trailing newline", () => {
    const text = serializeDoc(emptyDoc());
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "version": ');
    expect(JSON.parse(text).version).toBe(DOC_VERSION);
  });

  it("refuses documents written by a newer composer", () => {
    expect(() =>
      parseDoc(JSON.stringify({ version: DOC_VERSION + 1 })),
    ).toThrow(/newer composer/);
  });

  it("rejects malformed input with a readable reason", () => {
    expect(() => parseDoc("{not json")).toThrow(/not valid JSON/);
    expect(() => parseDoc("[]")).toThrow(/top level/);
    expect(() => parseDoc(JSON.stringify({ title: "x" }))).toThrow(
      /missing version/,
    );
    expect(() =>
      parseDoc(JSON.stringify({ version: 1, timeline: [{ kind: "op" }] })),
    ).toThrow(/names no operation/);
    expect(() =>
      parseDoc(JSON.stringify({ version: 1, timeline: [{ kind: "mystery" }] })),
    ).toThrow(/unknown kind/);
    expect(() =>
      parseDoc(JSON.stringify({ version: 1, seed: { repos: [{}], rels: [] } })),
    ).toThrow(/has no name/);
    expect(() =>
      parseDoc(
        JSON.stringify({
          version: 1,
          placements: { repos: { a: { x: "1" } } },
        }),
      ),
    ).toThrow(/malformed/);
  });

  it("fills defaults and normalizes loose fields", () => {
    const doc = parseDoc(
      JSON.stringify({
        version: 1,
        timeline: [
          { kind: "beat", secs: -3 },
          { kind: "op", op: "add", silent: false },
        ],
      }),
    );
    expect(doc.title).toBe("Untitled scenario");
    expect(doc.timeline[0]).toEqual({ kind: "beat", secs: 1 });
    expect(doc.timeline[1]).toEqual({ kind: "op", op: "add", args: {} });
    expect(doc.placements).toEqual({ repos: {}, wts: {} });
  });

  it("keeps only true flags and real ports on seed worktrees", () => {
    const doc = parseDoc(
      JSON.stringify({
        version: 1,
        seed: {
          repos: [
            {
              name: "r",
              wts: [{ branch: "main", agent: false, merged: true, port: "" }],
            },
          ],
          rels: [["r", "s"]],
        },
      }),
    );
    expect(doc.seed.repos[0].wts[0]).toEqual({ branch: "main", merged: true });
    expect(doc.seed.rels).toEqual([["r", "s"]]);
  });
});
