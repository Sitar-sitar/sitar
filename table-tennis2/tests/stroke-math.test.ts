import assert from "node:assert/strict";
import test from "node:test";

import {
  appendPointerSample,
  computeStrokeMetrics,
  deriveStrikeMetrics,
  normalizeStagePoint,
} from "../src/control/stroke.ts";
import type { PointerSample } from "../src/types.ts";

function sample(x: number, y: number, time: number): PointerSample {
  return {
    clientX: x,
    clientY: y,
    stageX: x / 400,
    stageY: y / 300,
    time,
    pointerType: "mouse",
  };
}

test("stage座標はcanvas内へ正規化してclampする", () => {
  assert.deepEqual(
    normalizeStagePoint(250, 170, { left: 50, top: 20, width: 400, height: 300 }),
    { stageX: 0.5, stageY: 0.5 },
  );
  assert.deepEqual(
    normalizeStagePoint(-10, 900, { left: 0, top: 0, width: 400, height: 300 }),
    { stageX: 0, stageY: 1 },
  );
});

test("単調時刻だけを保持し速度と方向を有限値で返す", () => {
  const samples: PointerSample[] = [];
  assert.equal(appendPointerSample(samples, sample(100, 200, 1)), true);
  assert.equal(appendPointerSample(samples, sample(100, 200, 1)), false);
  assert.equal(appendPointerSample(samples, sample(220, 140, 1.1)), true);
  const metrics = computeStrokeMetrics(samples, 300, 1.1);
  assert.ok(metrics.speed > 1);
  assert.ok(metrics.directionX > 0);
  assert.ok(metrics.directionY < 0);
  assert.ok(Object.values(metrics).every(Number.isFinite));
});

test("折れたストロークは曲率の符号を持つ", () => {
  const samples = [
    sample(100, 200, 1),
    sample(180, 200, 1.04),
    sample(180, 120, 1.08),
  ];
  const metrics = computeStrokeMetrics(samples, 300, 1.08);
  assert.ok(metrics.curvature < 0);
  assert.ok(Math.abs(metrics.curvature) >= 0.2);
});

test("strike metricsは直前80msだけを使いactive 3条件をAND評価する", () => {
  const active = deriveStrikeMetrics(
    [sample(0, 120, 0.8), sample(0, 100, 0.91), sample(0, 56, 0.95)],
    1_000,
    0.95,
  );
  assert.equal(active.active, true);
  assert.equal(active.verticality, 1);

  const tooSlow = deriveStrikeMetrics(
    [sample(0, 100, 1), sample(0, 56.1, 1.04)],
    1_000,
    1.04,
  );
  assert.equal(tooSlow.speed < 1.1, true);
  assert.equal(tooSlow.active, false);

  const tooShort = deriveStrikeMetrics(
    [sample(0, 100, 1), sample(0, 60.1, 1.035)],
    1_000,
    1.035,
  );
  assert.equal(tooShort.displacement < 0.04, true);
  assert.equal(tooShort.active, false);

  const horizontal = deriveStrikeMetrics(
    [sample(0, 100, 1), sample(80, 100, 1.04)],
    1_000,
    1.04,
  );
  assert.equal(horizontal.verticality, 0);
  assert.equal(horizontal.active, false);
});

test("strike metricsは2sample未満と非有限入力をpassive zeroへ戻す", () => {
  assert.equal(deriveStrikeMetrics([sample(0, 0, 1)], 300, 1).active, false);
  assert.deepEqual(
    deriveStrikeMetrics([sample(0, 0, 1), sample(0, 100, 1.04)], Number.NaN, 1.04),
    {
      vx: 0,
      vy: 0,
      speed: 0,
      displacement: 0,
      directionX: 0,
      directionY: 0,
      verticality: 0,
      curvature: 0,
      age: 0,
      active: false,
    },
  );
});
