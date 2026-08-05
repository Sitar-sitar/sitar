import assert from "node:assert/strict";
import test from "node:test";

import { onTable, simLand, solveDirectPlayerShot } from "../src/physics.ts";
import type { ShotId, ShotIntent } from "../src/types.ts";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const cases = [
  { x: -45, z: -160, y: 8, smashY: 30, aimX: -0.8 },
  { x: 0, z: -100, y: 30, smashY: 52, aimX: 0 },
  { x: 45, z: -45, y: 52, smashY: 74, aimX: 0.8 },
] as const;

function intent(type: ShotId, quality: number, aimX: number, sideSpin = 0): ShotIntent {
  const topSpin = type === "CHOP" ? -0.75 : type === "PUSH" ? 0 : 0.7;
  return {
    power: type === "SMASH" ? 0.9 : 0.72,
    aimX,
    depth: type === "PUSH" ? 0.62 : 0.78,
    lift: topSpin,
    topSpin,
    sideSpin,
    contactQuality: quality,
    timingQuality: quality,
    strokeCurvature: sideSpin,
    classifiedShot: type,
    passive: type === "PUSH",
    isServe: false,
  };
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

test("v0.2.0 fixed population: 品質別の台内率とミス率をseed 20260805で校正する", () => {
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

test("v0.2.0 fixed population: side spin正負の平均着地点Xが0をまたぐ", () => {
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
