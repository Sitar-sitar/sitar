import assert from "node:assert/strict";
import test from "node:test";

import { solveDirectPlayerShot } from "../src/physics.ts";
import type { ShotIntent } from "../src/types.ts";

const intent: ShotIntent = {
  power: 0.7,
  aimX: 0.4,
  depth: 0.8,
  lift: 0.2,
  topSpin: 0.6,
  sideSpin: 0.3,
  contactQuality: 0.9,
  timingQuality: 0.8,
  strokeCurvature: 0.3,
  classifiedShot: "DRIVE",
  passive: false,
  isServe: false,
};

test("direct solverは固定3乱数で有限な相手方向速度を返す", () => {
  let draws = 0;
  const solution = solveDirectPlayerShot({
    from: { x: 0, y: 25, z: -150 },
    incoming: { spin: -0.4, side: 0.2 },
    intent,
    random: () => {
      draws += 1;
      return 0.5;
    },
  });
  assert.equal(draws, 3);
  assert.ok(solution);
  assert.ok(solution.vz > 0);
  assert.ok(Object.values(solution).every(Number.isFinite));
});

test("同じ入力と乱数列は同じ解になる", () => {
  const values = [0.2, 0.7, 0.4];
  const run = () => {
    let index = 0;
    return solveDirectPlayerShot({
      from: { x: 4, y: 30, z: -145 },
      incoming: { spin: 0.1, side: -0.1 },
      intent,
      random: () => values[index++] ?? 0.5,
    });
  };
  assert.deepEqual(run(), run());
});
