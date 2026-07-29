import assert from "node:assert/strict";
import test from "node:test";

import { OpponentAi } from "../src/ai.ts";
import { HW, LEVELS, PADDLE_LIMIT } from "../src/config.ts";
import type { BallState } from "../src/types.ts";

function scriptedRandom(values: readonly number[]): {
  random: () => number;
  consumed: () => number;
} {
  let index = 0;
  return {
    random: () => {
      const value = values[index];
      if (value === undefined) {
        throw new Error(`乱数列が不足: ${index + 1}本目の要求`);
      }
      index += 1;
      return value;
    },
    consumed: () => index,
  };
}

function makeBall(overrides: Partial<BallState> = {}): BallState {
  return {
    x: 0,
    y: 10,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0.5,
    side: 0,
    live: true,
    hitter: "P",
    bounces: 1,
    serveStage: 0,
    ...overrides,
  };
}

function assertClose(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${actual} !== ${expected}`,
  );
}

test("decideShotは射程外・高さ外でnullを返す", () => {
  const sequence = scriptedRandom([]);
  const ai = new OpponentAi(sequence.random);

  assert.equal(ai.decideShot(makeBall({ x: 100 }), 0, "mid"), null);
  assert.equal(ai.decideShot(makeBall({ y: -43 }), 0, "mid"), null);
  assert.equal(ai.decideShot(makeBall({ y: 106 }), 0, "mid"), null);
  assert.equal(sequence.consumed(), 0);
});

test("decideShotはボール高さと回転からショット種別を選ぶ", () => {
  const cases = [
    {
      ball: makeBall({ y: -20 }),
      values: [0.5, 0.5, 0.9],
      type: "LOB",
      consumed: 3,
    },
    {
      ball: makeBall({ y: 30 }),
      values: [0.1, 0.5, 0.5, 0.9],
      type: "SMASH",
      consumed: 4,
    },
    {
      ball: makeBall({ y: 10, spin: -0.5 }),
      values: [0.1, 0.5, 0.5, 0.9],
      type: "CHOP",
      consumed: 4,
    },
    {
      ball: makeBall({ y: 10, spin: -0.5 }),
      values: [0.9, 0.5, 0.5, 0.9],
      type: "PUSH",
      consumed: 4,
    },
    {
      ball: makeBall({ y: 10, spin: 0.5 }),
      values: [0.9, 0.5, 0.5, 0.9],
      type: "DRIVE",
      consumed: 4,
    },
  ] as const;

  for (const item of cases) {
    const sequence = scriptedRandom(item.values);
    const ai = new OpponentAi(sequence.random);
    const decision = ai.decideShot(item.ball, 0, "mid");
    assert.ok(decision);
    assert.equal(decision.type, item.type);
    assert.equal(sequence.consumed(), item.consumed);
  }
});

test("decideShotは難易度で狙いを変える", () => {
  for (const level of ["hard", "mid"] as const) {
    const sequence = scriptedRandom([0.9, 0.5, 0.5, 0.9]);
    const ai = new OpponentAi(sequence.random);
    const decision = ai.decideShot(makeBall(), 50, level);
    assert.ok(decision);

    if (level === "hard") {
      assert.ok(decision.aim < 0);
      assert.ok(Math.abs(decision.aim) <= HW * 0.72);
    } else {
      assertClose(
        decision.aim,
        (0.5 * 2 - 1) * HW * 0.8 * LEVELS.mid.spread,
      );
    }
    assertClose(
      decision.depth,
      LEVELS[level].depth * (0.82 + 0.3 * 0.5),
    );
    assert.equal(decision.blunder, 0);
  }
});

test("chooseServeは乱数からサーブ種別と狙いを決める", () => {
  const sequence = scriptedRandom([0.6, 0.6]);
  const ai = new OpponentAi(sequence.random);
  const serve = ai.chooseServe("mid");

  assert.equal(serve.serveType, "side-left");
  assertClose(
    serve.aim,
    (0.6 * 2 - 1) * HW * 0.7 * LEVELS.mid.spread,
  );
  assert.equal(sequence.consumed(), 2);
});

test("plan/update/resetは反応待ち・移動量・クランプを守る", () => {
  const sequence = scriptedRandom([0.5, 0.5]);
  const ai = new OpponentAi(sequence.random);
  const ball = makeBall({
    x: 50,
    y: 100,
    vy: 200,
    vz: 300,
  });
  const planTime = 10;

  ai.plan(ball, planTime, "mid");
  assert.ok(ai.state.plan);
  ai.update(0.1, planTime + 0.05, ball, "mid");
  assert.equal(ai.state.x, 0);

  ai.update(0.1, planTime + 0.2, ball, "mid");
  assert.ok(Math.abs(ai.state.x) <= LEVELS.mid.speed * 0.1);

  ai.state.plan = { x: 1000, y: 0 };
  ai.state.react = -1;
  ai.state.nextRefine = Number.POSITIVE_INFINITY;
  for (let index = 0; index < 20; index += 1) {
    ai.update(0.1, 20 + index, ball, "mid");
  }
  assert.equal(ai.state.x, PADDLE_LIMIT);

  ai.state.plan = { x: -1000, y: 0 };
  for (let index = 0; index < 20; index += 1) {
    ai.update(0.1, 40 + index, ball, "mid");
  }
  assert.equal(ai.state.x, -PADDLE_LIMIT);

  ai.reset();
  assert.equal(ai.state.x, 0);
  assert.equal(ai.state.tx, 0);
  assert.equal(ai.state.plan, null);
});
