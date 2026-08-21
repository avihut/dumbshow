import { type Act, BOXES_PACK } from "@dumbshow/boxes";
import {
  compile,
  type DocItem,
  derive,
  emptyDoc,
  type StepDef,
} from "@dumbshow/core";
import { describe, expect, it } from "vitest";

const op = (op: string, args: Record<string, unknown>): DocItem => ({
  kind: "op",
  op,
  args,
});

/** A script with every beat flavour the engine schedules. */
function script(): StepDef<Act>[] {
  const doc = emptyDoc();
  doc.timeline = [
    op("add", { name: "alpha" }), // cmd + act + out
    op("add", { name: "beta" }),
    op("link", { a: "alpha", b: "beta" }), // cmd + act
    op("pulse", { name: "beta" }), // act + pause (an event: no cmd)
    { kind: "op", op: "remove", args: { name: "alpha" }, silent: true },
  ];
  return derive(doc, BOXES_PACK).steps;
}

describe("compile", () => {
  it("is deterministic", () => {
    const steps = script();
    expect(compile(steps)).toEqual(compile(steps));
    expect(JSON.stringify(compile(script()))).toBe(
      JSON.stringify(compile(script())),
    );
  });

  it("lays steps on one monotonic timeline", () => {
    const c = compile(script());
    expect(c.steps[0].at).toBeCloseTo(0.6);
    for (let i = 0; i < c.steps.length; i++) {
      const s = c.steps[i];
      expect(s.end).toBeGreaterThan(s.at);
      if (i > 0) expect(s.at).toBeCloseTo(c.steps[i - 1].end);
    }
    expect(c.duration).toBeCloseTo(c.steps[c.steps.length - 1].end + 0.8);
    const ats = c.term.map((l) => l.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
  });

  it("puts the checkpoint cue right after a step's first command is typed", () => {
    const c = compile(script());
    const first = c.term.filter((l) => l.step === 0);
    expect(first[0]).toMatchObject({ kind: "cmd", checkpoint: true });
    expect(c.steps[0].cue).toBeCloseTo(first[0].typed);
    expect(first[0].typed - first[0].at).toBeCloseTo(
      0.45 + first[0].text.length * 0.024,
    );
    expect(first.slice(1).every((l) => !l.checkpoint)).toBe(true);
    expect(first[1]).toMatchObject({
      kind: "ok",
      text: "alpha is on the board",
    });
  });

  it("schedules acts and camera keys at their beat time", () => {
    const steps = script();
    const c = compile(steps);
    const acts = steps.flatMap((s) => s.beats.filter((b) => "act" in b));
    expect(c.events).toHaveLength(acts.length);
    for (const e of c.events) {
      const host = c.steps.find((s) => e.at >= s.at && e.at <= s.end);
      expect(host).toBeDefined();
    }
    expect(c.cams).toHaveLength(steps.length); // one key per step, no cam beats
    expect(c.cams.map((k) => k.at)).toEqual(c.steps.map((s) => s.at));
  });

  it("gives an event step its pause and tail but no terminal lines", () => {
    const c = compile(script());
    const pulse = c.steps[3];
    expect(pulse.title).toBe("beta pulses");
    expect(c.term.some((l) => l.step === 3)).toBe(false);
    expect(pulse.end - pulse.at).toBeCloseTo(1 + 1.5);
    expect(pulse.cue).toBeCloseTo(pulse.at);
  });

  it("hides a silent step's terminal lines but keeps its time", () => {
    const c = compile(script());
    const silent = c.term.filter((l) => l.step === 4);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((l) => l.hidden)).toBe(true);
    expect(c.steps[4].silent).toBe(true);
    expect(c.steps[4].end - c.steps[4].at).toBeGreaterThan(1.5);
    expect(c.term.filter((l) => l.step !== 4).some((l) => l.hidden)).toBe(
      false,
    );
  });
});
