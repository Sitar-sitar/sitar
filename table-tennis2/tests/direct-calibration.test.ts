import assert from "node:assert/strict";
import test from "node:test";

import { buildShotIntent } from "../src/control/shot-intent.ts";
import { sweptPaddleContact } from "../src/control/contact.ts";
import { PADDLE_BLADE_SCALE } from "../src/config.ts";
import { onTable, simLand, solveDirectPlayerShot } from "../src/physics.ts";
import type { ContactEvent, PaddlePose, ShotId, StrikeMetrics } from "../src/types.ts";
import { paddleDepthRatio, paddleScreenRadius } from "../src/utils.ts";
import { createProjectionCamera, projectWorldPoint, unprojectScreenXAtZ } from "../src/view/projection.ts";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const cases = [
  { x: -45, z: -100, y: 22, smashY: 30, aimX: -0.4 },
  { x: 0, z: -100, y: 22, smashY: 52, aimX: 0 },
  { x: 45, z: -100, y: 22, smashY: 74, aimX: 0.4 },
] as const;

function intent(type: ShotId, quality: number, aimX: number, curvature = 0) {
  const active = type !== "PUSH";
  const upward = type !== "CHOP";
  const speed = type === "SMASH" ? 3.35 : 2.5;
  const strikeMetrics: StrikeMetrics = {
    vx: 0,
    vy: active ? (upward ? -speed : speed) : 0,
    speed: active ? speed : 0,
    displacement: active ? 0.08 : 0,
    directionX: 0,
    directionY: active ? (upward ? -1 : 1) : 0,
    verticality: active ? 1 : 0,
    curvature,
    age: 0,
    active,
  };
  const ballHeight = type === "SMASH" ? 52 : 30;
  const contact: ContactEvent = {
    screenX: 0,
    screenY: 0,
    contactOffsetX: -aimX / 0.65,
    contactOffsetY: 0,
    screenQuality: quality,
    timingQuality: quality,
    contactQuality: quality,
    ballHeight,
    ballVelocityBefore: { x: 0, y: ballHeight, z: -100, vx: 0, vy: 0, vz: -500, spin: 0.2, side: -0.1 },
    strikeMetrics,
    time: 1,
  };
  const built = buildShotIntent(contact, -80);
  assert.equal(built.classifiedShot, type);
  return built;
}

function cohort(type: ShotId, quality: number, seed: number): { total: number; landed: number } {
  const random = seededRandom(seed);
  let landed = 0;
  let total = 0;
  for (const sample of cases) {
    for (let trial = 0; trial < 400; trial += 1) {
      const from = {
        x: sample.x,
        y: type === "SMASH" ? sample.smashY : sample.y,
        z: sample.z,
      };
      const solution = solveDirectPlayerShot({
        from,
        incoming: { spin: 0.2, side: -0.1 },
        intent: intent(type, quality, sample.aimX),
        random,
      });
      total += 1;
      if (!solution) continue;
      const landing = simLand({ ...from, ...solution });
      if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) landed += 1;
    }
  }
  return { total, landed };
}

test("v0.2.1 fixed population: 製品intent経路の品質別台内率とミス率をseed 20260805で校正する", () => {
  const results: Record<string, { highRate: number; missGap: number }> = {};
  for (const type of ["DRIVE", "CHOP", "PUSH", "SMASH"] as const) {
    const high = cohort(type, 0.85, 20260805);
    const low = cohort(type, 0.25, 20260805);
    const highRate = high.landed / high.total;
    const lowMissRate = 1 - low.landed / low.total;
    const highMissRate = 1 - highRate;
    results[type] = { highRate, missGap: lowMissRate - highMissRate };
  }
  assert.ok(
    Object.entries(results).every(
      ([type, value]) =>
        value.highRate >= (type === "SMASH" ? 0.7 : 0.85) &&
        value.missGap >= 0.1,
    ),
    JSON.stringify(results),
  );
});

test("v0.2.1 fixed population: 製品intent経路のside spin正負平均着地点Xが0をまたぐ", () => {
  const means: number[] = [];
  for (const sideSpin of [-0.8, 0.8]) {
    const random = seededRandom(20260805);
    let xTotal = 0;
    let count = 0;
    for (let trial = 0; trial < 400; trial += 1) {
      const from = { x: 0, y: 30, z: -100 };
      const solution = solveDirectPlayerShot({
        from,
        incoming: { spin: 0, side: 0 },
        intent: intent("DRIVE", 0.85, 0, sideSpin),
        random,
      });
      if (!solution) continue;
      const landing = simLand({ ...from, ...solution });
      if (!landing.net) {
        xTotal += landing.x;
        count += 1;
      }
    }
    means.push(xTotal / count);
  }
  assert.ok(means[0]! < 0 && means[1]! > 0, `side means: ${means.join(", ")}`);
});

test("v0.2.3 fixed population: passive PUSH quality 0.40の台内率は70%以上", () => {
  const result = cohort("PUSH", 0.4, 20260805);
  assert.equal(result.total, 1_200);
  assert.ok(
    result.landed / result.total >= 0.7,
    `${result.landed}/${result.total}`,
  );
});

test("assist端contactからintentとsolverまでpassive PUSH製品経路が成立する", () => {
  const width = 900;
  const height = 412;
  const worldZ = -100;
  const camera = createProjectionCamera(width, height);
  const projected = projectWorldPoint(camera, 0, 22, worldZ);
  const visualRx = paddleScreenRadius(
    width,
    height,
    paddleDepthRatio(worldZ),
  ) * PADDLE_BLADE_SCALE;
  const pose: PaddlePose = {
    screenX: projected.x,
    screenY: projected.y,
    worldX: 0,
    worldZ,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    tilt: 0,
    pointerDown: false,
    phase: "follow",
    contactFlash: 0,
    pointerType: "touch",
  };
  const ballX = unprojectScreenXAtZ(
    camera,
    projected.x + visualRx * 1.4,
    worldZ,
  );
  const before = {
    x: ballX,
    y: 22,
    z: worldZ + 1,
    vx: 0,
    vy: -100,
    vz: -500,
    spin: 0.2,
    side: -0.1,
  };
  const current = { ...before, z: worldZ };
  const contact = sweptPaddleContact({
    previousBall: before,
    currentBall: current,
    previousPaddle: pose,
    currentPaddle: pose,
    strikeMetrics: {
      vx: 0,
      vy: 0,
      speed: 0,
      displacement: 0,
      directionX: 0,
      directionY: 0,
      verticality: 0,
      curvature: 0,
      age: 0.2,
      active: false,
    },
    width,
    height,
    time: 1,
  });
  assert.ok(contact);
  assert.equal(contact.contactQuality, 0.4);
  const shotIntent = buildShotIntent(contact, -70);
  assert.equal(shotIntent.classifiedShot, "PUSH");
  assert.equal(shotIntent.passive, true);
  const solution = solveDirectPlayerShot({
    from: { x: current.x, y: current.y, z: current.z },
    incoming: { spin: current.spin, side: current.side },
    intent: shotIntent,
    random: seededRandom(20260805),
  });
  assert.ok(solution);
  assert.ok(Object.values(solution).every(Number.isFinite));
});
