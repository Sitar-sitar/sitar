import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_SERVE_WEIGHTS,
  AZ,
  PZ,
  SERVE_PROFILES,
  SERVE_TYPES,
} from "../src/config.ts";
import {
  launch,
  simLand,
  simState,
  solveServe,
  tableBounce,
} from "../src/physics.ts";
import {
  chooseWeightedServe,
  isGameOver,
  opponentOf,
  rotateServerAfterPoint,
} from "../src/rules.ts";
import type { BallVector, ServeType } from "../src/types.ts";

function traceServe(
  serveType: ServeType,
  direction: 1 | -1,
  aimX: number,
): { firstX: number; secondX: number } {
  const profile = SERVE_PROFILES[serveType];
  const from = {
    x: 0,
    y: 24,
    z: direction === 1 ? PZ + 6 : AZ - 6,
  };
  const side = profile.screenCurve;
  const solution = solveServe(
    from,
    aimX,
    profile.spin,
    side,
    direction,
  );
  assert.equal(
    solution.ok,
    true,
    `${serveType} dir=${direction} aim=${aimX}`,
  );

  const velocity = launch(
    solution.speed,
    solution.elev,
    solution.azim,
  );
  const ball: BallVector = {
    ...from,
    ...velocity,
    spin: profile.spin,
    side,
  };
  const first = simLand(ball);
  assert.equal(first.net, false);
  assert.ok(first.z * direction < 0, "1バウンド目はサーバー側");

  const afterFirst = simState(ball, first.t);
  tableBounce(afterFirst);
  const second = simLand(afterFirst);
  assert.equal(second.net, false);
  assert.ok(second.z * direction > 0, "2バウンド目はレシーバー側");
  return { firstX: first.x, secondX: second.x };
}

test("5種類のサーブが両方向・代表3狙いで成立する", () => {
  for (const serveType of SERVE_TYPES) {
    for (const direction of [1, -1] as const) {
      for (const aimX of [-50, 0, 50]) {
        traceServe(serveType, direction, aimX);
      }
    }
  }
});

test("横左と横右は画面上で逆方向へ曲がる", () => {
  for (const direction of [1, -1] as const) {
    const left = traceServe("side-left", direction, 0);
    const right = traceServe("side-right", direction, 0);
    assert.ok(left.secondX < right.secondX);
  }
});

test("ナックルは縦・横回転を持たない", () => {
  assert.equal(SERVE_PROFILES.knuckle.spin, 0);
  assert.equal(SERVE_PROFILES.knuckle.screenCurve, 0);
});

test("AIサーブ重みは難易度ごとの境界を選べる", () => {
  assert.equal(chooseWeightedServe("easy", () => 0.01), "topspin");
  assert.equal(chooseWeightedServe("easy", () => 0.46), "side-left");
  assert.equal(chooseWeightedServe("easy", () => 0.56), "side-right");
  assert.equal(chooseWeightedServe("easy", () => 0.99), "knuckle");
  assert.equal(AI_SERVE_WEIGHTS.easy.backspin, 0);

  const midKinds = new Set(
    [0.01, 0.26, 0.56, 0.71, 0.99].map((value) =>
      chooseWeightedServe("mid", () => value),
    ),
  );
  assert.deepEqual(midKinds, new Set(SERVE_TYPES));
});

test("相手サイドを反転できる", () => {
  assert.equal(opponentOf("P"), "A");
  assert.equal(opponentOf("A"), "P");
});

test("通常時は2本、デュース時は1本でサーバー交代する", () => {
  assert.deepEqual(rotateServerAfterPoint("P", 0, 1, 0), {
    server: "P",
    servedCount: 1,
  });
  assert.deepEqual(rotateServerAfterPoint("P", 1, 2, 0), {
    server: "A",
    servedCount: 0,
  });
  assert.deepEqual(rotateServerAfterPoint("A", 0, 10, 10), {
    server: "P",
    servedCount: 0,
  });
});

test("11点以上かつ2点差でのみゲーム終了する", () => {
  assert.equal(isGameOver(11, 9), true);
  assert.equal(isGameOver(10, 8), false);
  assert.equal(isGameOver(11, 10), false);
  assert.equal(isGameOver(12, 10), true);
});
