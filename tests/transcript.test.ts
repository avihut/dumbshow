import { BOXES_PACK } from "@dumbshow/boxes";
import { derive, emptyDoc, transcriptAt, visibleLines } from "@dumbshow/core";
import { describe, expect, it } from "vitest";

function term() {
  const doc = emptyDoc();
  doc.timeline = [
    { kind: "op", op: "add", args: { name: "alpha" } },
    { kind: "op", op: "add", args: { name: "beta" }, silent: true },
    { kind: "op", op: "link", args: { a: "alpha", b: "beta" } },
  ];
  return derive(doc, BOXES_PACK).compiled.term;
}

describe("transcriptAt", () => {
  it("shows nothing before the first command starts", () => {
    expect(transcriptAt(term(), 0)).toEqual({ count: 0, typing: null });
  });

  it("types the command progressively", () => {
    const lines = term();
    const cmd = lines[0];
    expect(cmd).toMatchObject({ kind: "cmd", text: "box add alpha" });
    const mid = (cmd.at + cmd.typed) / 2;
    expect(transcriptAt(lines, mid)).toEqual({
      count: 0,
      typing: cmd.text.slice(0, Math.floor(cmd.text.length * 0.5)),
    });
  });

  it("counts a command once typed and reveals output at its time", () => {
    const lines = term();
    const [cmd, out] = lines;
    expect(transcriptAt(lines, cmd.typed)).toEqual({ count: 1, typing: null });
    expect(transcriptAt(lines, out.at - 0.01).count).toBe(1);
    expect(transcriptAt(lines, out.at).count).toBe(2);
  });

  it("keeps a silent command's typing time but shows no text", () => {
    const lines = term();
    const hidden = lines.find((l) => l.hidden && l.kind === "cmd");
    expect(hidden).toBeDefined();
    if (!hidden) return;
    const mid = (hidden.at + hidden.typed) / 2;
    expect(transcriptAt(lines, mid)).toEqual({
      count: lines.indexOf(hidden),
      typing: null,
    });
    // The world moved on the same clock: the NEXT command is still unseen.
    const next = lines.find((l) => l.step === 2 && l.kind === "cmd");
    expect(next).toBeDefined();
    if (next) expect(transcriptAt(lines, next.at - 0.01).typing).toBeNull();
  });

  it("counts everything once the clock passes the last line", () => {
    const lines = term();
    const last = lines.at(-1);
    if (!last) throw new Error("empty transcript");
    expect(transcriptAt(lines, last.typed + 1)).toEqual({
      count: lines.length,
      typing: null,
    });
  });
});

describe("visibleLines", () => {
  it("drops hidden lines from the counted prefix", () => {
    const lines = term();
    const all = visibleLines(lines, lines.length);
    expect(all.every((l) => !l.hidden)).toBe(true);
    expect(all).toHaveLength(lines.filter((l) => !l.hidden).length);
    expect(visibleLines(lines, 1)).toEqual([lines[0]]);
    expect(visibleLines(lines, 0)).toEqual([]);
  });
});
