import assert from "node:assert/strict";
import test from "node:test";

import { planFixedSteps } from "../src/utils.ts";

test("U37: 固定刻みは通常フレームの剰余を保持する", () => {
  const plan = planFixedSteps(0, 1 / 60);
  assert.equal(plan.frameDelta, 1 / 60);
  assert.equal(plan.steps, 4);
  assert.ok(plan.nextAccumulator >= 0);
  assert.ok(plan.nextAccumulator < 1 / 240);
  assert.equal(plan.dropped, false);
});

test("U38: 長いフレームは50ms・12ステップへ制限して剰余を捨てる", () => {
  assert.deepEqual(planFixedSteps(0, 1), {
    frameDelta: 0.05,
    steps: 12,
    nextAccumulator: 0,
    dropped: true,
  });
});

test("U39: 負値と非有限のフレーム時間は0として扱う", () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(planFixedSteps(0, value), {
      frameDelta: 0,
      steps: 0,
      nextAccumulator: 0,
      dropped: false,
    });
  }
});
