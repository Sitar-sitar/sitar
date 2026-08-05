import assert from "node:assert/strict";
import test from "node:test";

import { buildShotIntent } from "../src/control/shot-intent.ts";
import type { ContactEvent, StrokeMetrics } from "../src/types.ts";

function contact(metrics: StrokeMetrics, ballHeight = 35): ContactEvent {
  return {
    screenX: 0,
    screenY: 0,
    contactOffsetX: 0,
    contactOffsetY: 0,
    screenQuality: 1,
    timingQuality: 1,
    contactQuality: 1,
    ballHeight,
    ballVelocityBefore: { x: 0, y: ballHeight, z: -150, vx: 0, vy: 0, vz: -500, spin: 0, side: 0 },
    paddleMetrics: metrics,
    time: 1,
  };
}

const base: StrokeMetrics = {
  vx: 0,
  vy: 0,
  speed: 0,
  acceleration: 0,
  directionX: 0,
  directionY: 0,
  pathLength: 0,
  displacement: 0,
  curvature: 0,
  age: 0,
};

test("低速接触はpassive PUSHへ分類する", () => {
  const intent = buildShotIntent(contact(base), -80);
  assert.equal(intent.passive, true);
  assert.equal(intent.classifiedShot, "PUSH");
});

test("高速上向き入力かつ高い球はSMASHへ分類する", () => {
  const intent = buildShotIntent(
    contact({ ...base, vy: -4, speed: 4, directionY: -1 }, 50),
    -80,
  );
  assert.equal(intent.classifiedShot, "SMASH");
  assert.ok(intent.power > 0.5);
});

test("曲率はside spinへ連続変換する", () => {
  const intent = buildShotIntent(
    contact({ ...base, vx: 3, speed: 3, directionX: 1, curvature: 0.8 }),
    -80,
  );
  assert.ok(intent.sideSpin > 0);
  assert.ok(intent.aimX > 0);
});
