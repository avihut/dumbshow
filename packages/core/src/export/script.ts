/**
 * Compiled-script export — the derived StepDef[] as pretty JSON, the
 * lingua franca between the composer, gallery scripts, and catalog demos.
 * Pure serialization: steps are engine data, so no pack is involved.
 */

import type { StepDef } from "../engine";
import type { ActLike } from "../language";

export function scriptJson<A extends ActLike>(steps: StepDef<A>[]): string {
  return `${JSON.stringify(steps, null, 2)}\n`;
}
