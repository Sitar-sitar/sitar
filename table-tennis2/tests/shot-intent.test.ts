import assert from "node:assert/strict";
import test from "node:test";

import { buildShotIntent } from "../src/control/shot-intent.ts";
import type { ContactEvent, StrikeMetrics } from "../src/types.ts";

function contact(metrics: StrikeMetrics, ballHeight = 35): ContactEvent {
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
    strikeMetrics: metrics,
    time: 1,
  };
}

const base: StrikeMetrics = {
  vx: 0,
  vy: 0,
  speed: 0,
  directionX: 0,
  directionY: 0,
  displacement: 0,
  curvature: 0,
  age: 0,
  verticality: 0,
  active: false,
};

test("低速接触はpassive PUSHへ分類する", () => {
  const intent = buildShotIntent(contact(base), -80);
  assert.equal(intent.passive, true);
  assert.equal(intent.classifiedShot, "PUSH");
});

test("高速上向き入力かつ高い球はSMASHへ分類する", () => {
  const intent = buildShotIntent(
    contact({ ...base, vy: -4, speed: 4, directionY: -1, displacement: 0.08, verticality: 1, active: true }, 50),
    -80,
  );
  assert.equal(intent.classifiedShot, "SMASH");
  assert.ok(intent.power > 0.5);
});

test("曲率はside spinへ連続変換する", () => {
  const intent = buildShotIntent(
    contact({ ...base, vx: 1, vy: -3, speed: 3.2, directionX: 0.31, directionY: -0.95, displacement: 0.08, verticality: 0.95, curvature: 0.8, active: true }),
    -80,
  );
  assert.ok(intent.sideSpin > 0);
  assert.ok(Math.abs(intent.aimX) < Number.EPSILON);
});

test("horizontal-only追従はpassiveでaimとspinへ流入しない", () => {
  const left = contact({
    ...base,
    vx: -3,
    speed: 3,
    directionX: -1,
    displacement: 0.2,
    curvature: -0.8,
  });
  const right = contact({
    ...base,
    vx: 3,
    speed: 3,
    directionX: 1,
    displacement: 0.2,
    curvature: 0.8,
  });
  left.contactOffsetX = right.contactOffsetX = 0.4;
  const leftIntent = buildShotIntent(left, -80);
  const rightIntent = buildShotIntent(right, -80);
  assert.equal(leftIntent.passive, true);
  assert.equal(rightIntent.passive, true);
  assert.equal(leftIntent.aimX, rightIntent.aimX);
  assert.equal(leftIntent.sideSpin, 0);
  assert.equal(rightIntent.sideSpin, 0);
});

test("active strikeは7技を既存分類境界で選ぶ", () => {
  const up = { ...base, vy: -2, speed: 2, displacement: 0.08, directionY: -1, verticality: 1, active: true };
  const down = { ...base, vy: 2, speed: 2, displacement: 0.08, directionY: 1, verticality: 1, active: true };
  assert.equal(buildShotIntent(contact(base, 20), -80).classifiedShot, "PUSH");
  assert.equal(buildShotIntent(contact(down, 15), -30).classifiedShot, "STOP");
  assert.equal(buildShotIntent(contact(up, 15), -30).classifiedShot, "FLICK");
  assert.equal(buildShotIntent(contact(up, -10), -80).classifiedShot, "LOB");
  assert.equal(buildShotIntent(contact({ ...up, speed: 2.9 }, 50), -80).classifiedShot, "SMASH");
  assert.equal(buildShotIntent(contact(up, 20), -80).classifiedShot, "DRIVE");
  assert.equal(buildShotIntent(contact(down, 20), -80).classifiedShot, "CHOP");
});

test("aimはcontactOffsetだけで[-0.65,0.65]へ単調減少する", () => {
  const aims = [-2, -1, 0, 1, 2].map((offset) => {
    const event = contact(base);
    event.contactOffsetX = offset;
    return buildShotIntent(event, -80).aimX;
  });
  assert.deepEqual(aims, [0.65, 0.65, -0, -0.65, -0.65]);
  assert.ok(aims.every((value, index) => index === 0 || value <= aims[index - 1]!));
});

test("side spinはactiveかつ曲率0.30以上だけ発生する", () => {
  const active = { ...base, vy: -2, speed: 2, displacement: 0.08, directionY: -1, verticality: 1, active: true };
  assert.equal(buildShotIntent(contact({ ...active, curvature: 0.299 }), -80).sideSpin, 0);
  assert.ok(buildShotIntent(contact({ ...active, curvature: 0.3 }), -80).sideSpin > 0);
  assert.ok(buildShotIntent(contact({ ...active, curvature: -0.3 }), -80).sideSpin < 0);
});
