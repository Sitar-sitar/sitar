import assert from "node:assert/strict";
import test from "node:test";

import { OpponentAi } from "../src/ai.ts";
import {
  BALL_R,
  FLOOR,
  LEVEL_PLAY,
  PADDLE_BLADE_SCALE,
  PADDLE_LIMIT,
} from "../src/config.ts";
import {
  onTable,
  predictAt,
  simLand,
  solveContactPlane,
  solveShot,
} from "../src/physics.ts";
import type { BallState, LevelId, ShotId } from "../src/types.ts";
import {
  paddleBottomExtent,
  paddleDepthRatio,
  paddleScreenRadius,
} from "../src/utils.ts";
import { createProjectionCamera, projectWorldPoint } from "../src/view/projection.ts";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const viewports = [
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 760, height: 360 },
  { width: 844, height: 390 },
  { width: 900, height: 412 },
] as const;

test("v0.2.3 AI製品経路固定母集団は全viewportで縦方向へ到達可能", () => {
  let accepted = 0;
  const minFine: Record<string, number> = {
    easy: Number.POSITIVE_INFINITY,
    mid: Number.POSITIVE_INFINITY,
    hard: Number.POSITIVE_INFINITY,
  };
  const minTouch: Record<string, number> = {
    easy: Number.POSITIVE_INFINITY,
    mid: Number.POSITIVE_INFINITY,
    hard: Number.POSITIVE_INFINITY,
  };
  let oldFineUnreachable = 0;
  let oldTouchUnreachable = 0;
  const shots = new Set<ShotId>();
  const levels = new Set<LevelId>();

  for (let seed = 1; seed <= 30; seed += 1) {
    for (const level of ["easy", "mid", "hard"] as const) {
      for (const y of [-42, -12.001, 0, 14, 22, 24, 52, 105]) {
        for (const z of [30, 100, 178]) {
          for (const x of [-30, 0, 30]) {
            for (const lastBounceZ of [30, 70]) {
              for (const playerX of [-104, 0, 104]) {
                const random = seededRandom(seed);
                const ai = new OpponentAi(random);
                ai.state.x = x;
                const ball: BallState = {
                  x,
                  y,
                  z,
                  vx: 0,
                  vy: -100,
                  vz: 400,
                  spin: y < 14 ? -0.5 : 0.5,
                  side: 0,
                  live: true,
                  hitter: "P",
                  bounces: 1,
                  serveStage: 0,
                  lastBounceZ,
                };
                const decision = ai.decideShot(ball, playerX, level);
                if (!decision) continue;
                const from = { x: ball.x, y: ball.y, z: ball.z };
                const solution = solveShot({
                  from,
                  type: decision.type,
                  direction: -1,
                  aimX: decision.aim,
                  depth: decision.depth,
                  contactQuality: decision.quality,
                  extraError: decision.blunder,
                  ballY: ball.y,
                  random,
                  // v0.2.4: 製品経路（game.ts makeShot）と同じ難易度パラメータを通す。
                  pace: LEVEL_PLAY[level].aiPace,
                  precision: LEVEL_PLAY[level].aiPrecision,
                });
                const flight = { ...from, ...solution };
                const landing = simLand(flight);
                if (
                  landing.net ||
                  landing.z >= 0 ||
                  !onTable(landing.x, landing.z)
                ) {
                  continue;
                }
                const contactPlane = solveContactPlane(flight, "P");
                const prediction = predictAt(flight, contactPlane, -1, FLOOR);
                if (!prediction || Math.abs(prediction.x) > PADDLE_LIMIT) {
                  continue;
                }

                accepted += 1;
                shots.add(decision.type);
                levels.add(level);
                for (const viewport of viewports) {
                  const camera = createProjectionCamera(viewport.width, viewport.height);
                  const projected = projectWorldPoint(
                    camera,
                    prediction.x,
                    prediction.y,
                    contactPlane,
                  );
                  const radius = paddleScreenRadius(
                    viewport.width,
                    viewport.height,
                    paddleDepthRatio(contactPlane),
                  );
                  const centerMin = 0.35 * viewport.height;
                  const centerMax = Math.min(
                    0.9 * viewport.height,
                    viewport.height - paddleBottomExtent(radius),
                  );
                  const dy = projected.y < centerMin
                    ? centerMin - projected.y
                    : projected.y > centerMax
                      ? projected.y - centerMax
                      : 0;
                  const visualRy = radius * PADDLE_BLADE_SCALE * 0.94;
                  const ballRadius = Math.max(2, BALL_R * projected.s);
                  // v0.2.4: 補助倍率は難易度スケールを含む。上級は1.0倍でv0.2.3と同値。
                  const levelScale = LEVEL_PLAY[level].assistScale;
                  minFine[level] = Math.min(
                    minFine[level]!,
                    visualRy * 0.85 * 1.2 * levelScale + ballRadius - dy,
                  );
                  minTouch[level] = Math.min(
                    minTouch[level]!,
                    visualRy * 0.85 * 1.4 * levelScale + ballRadius - dy,
                  );
                  if (viewport.width === 568 && viewport.height === 320) {
                    // Phase 10-0の負の対照: v0.2.3 assistを維持し、旧Y min
                    // 0.45・neutral tiltで到達不能件数を再現する。
                    const oldCenterMin = 0.45 * viewport.height;
                    const oldDy = projected.y < oldCenterMin
                      ? oldCenterMin - projected.y
                      : projected.y > centerMax
                        ? projected.y - centerMax
                        : 0;
                    if (visualRy * 1.2 + ballRadius - oldDy < 0) {
                      oldFineUnreachable += 1;
                    }
                    if (visualRy * 1.4 + ballRadius - oldDy < 0) {
                      oldTouchUnreachable += 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // v0.2.4: LEVELS.miss の変更で母集団自体が変わるため件数一致は受入条件にしない。
  // 受入条件は「到達不能0件（最小margin > 0）」であり、件数は母集団崩壊の検知にだけ使う。
  assert.ok(accepted >= 30_000, `accepted: ${accepted}`);
  assert.equal(shots.size, 7);
  assert.equal(levels.size, 3);
  assert.equal(oldFineUnreachable, 6);
  assert.equal(oldTouchUnreachable, 3);
  for (const level of ["easy", "mid", "hard"] as const) {
    assert.ok(minFine[level]! > 0, `${level} fine margin: ${minFine[level]}`);
    assert.ok(minTouch[level]! > 0, `${level} touch margin: ${minTouch[level]}`);
  }
  // 上級は v0.2.3 と同一の補助倍率であり、1px以上の余裕を維持する。
  assert.ok(minFine.hard! >= 1, `hard fine margin: ${minFine.hard}`);
  assert.ok(minTouch.hard! >= 1, `hard touch margin: ${minTouch.hard}`);
  // 補助拡大は単調であり、初級 >= 中級 >= 上級 の余裕になる。
  assert.ok(minFine.easy! >= minFine.mid! && minFine.mid! >= minFine.hard!);
  assert.ok(minTouch.easy! >= minTouch.mid! && minTouch.mid! >= minTouch.hard!);
});
