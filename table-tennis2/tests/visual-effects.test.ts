// v0.3.0 §9.2: U-V1 / U-V2 / U-V3 / U-V3' / U-V9 / U-V10 / U-V11 / U-V12 / U-V16
import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNCE_RING_TTL_SEC,
  CONTACT_SPARK_TTL_SEC,
  DEAD_BALL_FADE_SEC,
  DEAD_BALL_HOLD_SEC,
  EFFECT_MAX_PARTICLES,
  FLOOR,
  NET_HW,
  NET_WOBBLE_AMP,
  NET_WOBBLE_SEC,
  VISUAL_EVENT_BUFFER,
} from "../src/config.ts";
import type { VisualEvent } from "../src/types.ts";
import {
  ballBehindNet,
  createEffectState,
  deadBallAlpha,
  effectPolicy,
  netWobbleOffset,
  pushBounded,
  renderOrder,
  spawnFromEvent,
  stepEffects,
  type EffectState,
  type RenderOrderScene,
} from "../src/view/effects.ts";

const FULL = effectPolicy(false);

function sequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0.5;
}

function contactEvent(
  overrides: Partial<Extract<VisualEvent, { kind: "contact" }>> = {},
): VisualEvent {
  return {
    kind: "contact",
    side: "P",
    x: 0,
    y: 10,
    z: -100,
    shot: "DRIVE",
    passive: false,
    contactQuality: 0.8,
    time: 0,
    ...overrides,
  };
}

test("U-V1: spawnFromEvent()の個数と上限が仕様どおり", () => {
  const random = sequenceRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
  const passive = createEffectState();
  spawnFromEvent(passive, contactEvent({ passive: true, shot: "PUSH" }), 0, FULL, random);
  assert.equal(passive.particles.length, 6);

  const active = createEffectState();
  spawnFromEvent(active, contactEvent(), 0, FULL, random);
  assert.equal(active.particles.length, 10);

  const smash = createEffectState();
  spawnFromEvent(smash, contactEvent({ shot: "SMASH" }), 0, FULL, random);
  assert.equal(smash.particles.length, 16);
  assert.equal(smash.streaks.length, 1);

  const rings = createEffectState();
  spawnFromEvent(rings, { kind: "bounce", x: 10, z: 40, time: 0 }, 0, FULL, random);
  assert.equal(rings.rings.length, 1);

  const net = createEffectState();
  spawnFromEvent(net, { kind: "net", x: 5, y: 8, time: 0 }, 0, FULL, random);
  assert.notEqual(net.netWobble, null);

  // 49個目で最古が消え、総数は48を超えない。
  const bounded = createEffectState();
  for (let round = 0; round < 5; round += 1) {
    spawnFromEvent(bounded, contactEvent({ shot: "SMASH" }), 0, FULL, random);
  }
  assert.equal(bounded.particles.length, EFFECT_MAX_PARTICLES);

  // 同じ乱数列で同じ出力になる。
  const first = createEffectState();
  const second = createEffectState();
  spawnFromEvent(first, contactEvent(), 0, FULL, sequenceRandom([0.1, 0.2, 0.3]));
  spawnFromEvent(second, contactEvent(), 0, FULL, sequenceRandom([0.1, 0.2, 0.3]));
  assert.deepEqual(first.particles, second.particles);
});

test("U-V2: stepEffects()の寿命と有限性", () => {
  const state = createEffectState();
  const random = sequenceRandom([0.3, 0.6, 0.9]);
  const dt = 1 / 60;
  let spawned = 0;
  for (let frame = 0; frame < 20 * 60; frame += 1) {
    if (frame % 20 === 0) {
      const time = state.simulationTime;
      spawnFromEvent(state, contactEvent({ time }), time, FULL, random);
      spawnFromEvent(state, { kind: "bounce", x: 0, z: 30, time }, time, FULL, random);
      spawnFromEvent(state, { kind: "net", x: 0, y: 5, time }, time, FULL, random);
      spawned += 1;
    }
    stepEffects(state, dt);
    for (const particle of state.particles) {
      assert.ok(Number.isFinite(particle.x));
      assert.ok(Number.isFinite(particle.y));
      assert.ok(Number.isFinite(particle.vy));
      assert.ok(particle.age < particle.ttl);
    }
    for (const ring of state.rings) {
      assert.ok(Number.isFinite(ring.x));
      assert.ok(ring.age < ring.ttl);
    }
  }
  assert.ok(spawned > 50);

  // 寿命を十分に超えるまで進めれば全て消える。
  for (let frame = 0; frame < 120; frame += 1) stepEffects(state, dt);
  assert.equal(state.particles.length, 0);
  assert.equal(state.rings.length, 0);
  assert.equal(state.streaks.length, 0);
  assert.equal(state.netWobble, null);

  // dt <= 0 では状態が変わらない。
  const halted = createEffectState();
  spawnFromEvent(halted, contactEvent(), 0, FULL, sequenceRandom([0.5]));
  const before = JSON.stringify(halted);
  stepEffects(halted, 0);
  stepEffects(halted, -1);
  assert.equal(JSON.stringify(halted), before);

  // dt = 1.0 は 0.25 として扱う。
  const clamped = createEffectState();
  stepEffects(clamped, 1);
  assert.equal(clamped.simulationTime, 0.25);
});

test("U-V3: deadBallAlpha()とDeadBallの生成・消去", () => {
  assert.equal(deadBallAlpha(0), 1);
  assert.equal(deadBallAlpha(DEAD_BALL_HOLD_SEC), 1);
  assert.equal(deadBallAlpha(0.875), 0.5);
  assert.equal(deadBallAlpha(DEAD_BALL_HOLD_SEC + DEAD_BALL_FADE_SEC), 0);

  const state = createEffectState();
  const random = sequenceRandom([0.5]);
  // 台の外（床）へ落ちた得点は FLOOR に置く。
  spawnFromEvent(
    state,
    {
      kind: "point",
      winner: "P",
      reason: "アウト",
      scP: 1,
      scA: 0,
      ball: { x: 300, y: FLOOR - 40, z: 400 },
      time: 0,
    },
    0,
    FULL,
    random,
  );
  assert.equal(state.deadBall?.y, FLOOR);

  // 台上で止まった得点は 0 に置く。
  spawnFromEvent(
    state,
    {
      kind: "point",
      winner: "A",
      reason: "ネット",
      scP: 1,
      scA: 1,
      ball: { x: 10, y: 3, z: 0 },
      time: 0,
    },
    0,
    FULL,
    random,
  );
  assert.equal(state.deadBall?.y, 0);
  assert.equal(state.deadBall?.z, 0);

  // serve イベントで消える。
  spawnFromEvent(
    state,
    {
      kind: "serve",
      side: "P",
      serveType: "topspin",
      serveLength: "middle",
      time: 0,
    },
    0,
    FULL,
    random,
  );
  assert.equal(state.deadBall, null);

  // 寿命で消える。
  spawnFromEvent(
    state,
    {
      kind: "point",
      winner: "P",
      reason: "返せず",
      scP: 2,
      scA: 1,
      ball: { x: 0, y: 0, z: 0 },
      time: 0,
    },
    0,
    FULL,
    random,
  );
  assert.notEqual(state.deadBall, null);
  for (let frame = 0; frame < 90; frame += 1) stepEffects(state, 1 / 60);
  assert.equal(state.deadBall, null);
});

test("U-V3': spawnFromEvent()のage補正", () => {
  const state = createEffectState();
  spawnFromEvent(
    state,
    contactEvent({ time: 0.4 }),
    0.5,
    FULL,
    sequenceRandom([0.5]),
  );
  assert.equal(state.particles.length, 10);
  for (const particle of state.particles) {
    assert.ok(Math.abs(particle.age - 0.1) < 1e-9);
  }

  // age >= ttl のイベントは何も生成しない。
  const stale = createEffectState();
  spawnFromEvent(
    stale,
    contactEvent({ time: 0 }),
    CONTACT_SPARK_TTL_SEC,
    FULL,
    sequenceRandom([0.5]),
  );
  assert.equal(stale.particles.length, 0);
  spawnFromEvent(
    stale,
    { kind: "bounce", x: 0, z: 0, time: 0 },
    BOUNCE_RING_TTL_SEC,
    FULL,
    sequenceRandom([0.5]),
  );
  assert.equal(stale.rings.length, 0);
  spawnFromEvent(
    stale,
    { kind: "net", x: 0, y: 0, time: 0 },
    NET_WOBBLE_SEC,
    FULL,
    sequenceRandom([0.5]),
  );
  assert.equal(stale.netWobble, null);
});

test("U-V9: netWobbleOffset()の境界", () => {
  assert.equal(netWobbleOffset(0, 0), 0);
  assert.equal(netWobbleOffset(0.1, NET_HW), 0);
  assert.equal(netWobbleOffset(0.1, -NET_HW), 0);
  assert.equal(netWobbleOffset(NET_WOBBLE_SEC, 0), 0);
  assert.equal(netWobbleOffset(NET_WOBBLE_SEC + 0.1, 0), 0);
  for (let t = 0; t < NET_WOBBLE_SEC; t += 0.002) {
    for (const x of [-NET_HW, -40, 0, 40, NET_HW]) {
      assert.ok(Math.abs(netWobbleOffset(t, x)) <= NET_WOBBLE_AMP + 1e-12);
    }
  }
});

test("U-V10: ballBehindNet()の境界", () => {
  assert.equal(ballBehindNet(0.001), true);
  assert.equal(ballBehindNet(0), false);
  assert.equal(ballBehindNet(-0.001), false);
});

test("U-V11: effectPolicy()がreduced-motion表と完全一致する", () => {
  assert.deepEqual(effectPolicy(false), {
    contactSpark: true,
    smashStreak: true,
    netWobble: true,
    hudPulse: true,
    opponentIdleSway: true,
    smashGlowPulse: true,
    bounceRing: true,
    deadBall: true,
    informational: true,
  });
  assert.deepEqual(effectPolicy(true), {
    contactSpark: false,
    smashStreak: false,
    netWobble: false,
    hudPulse: false,
    opponentIdleSway: false,
    smashGlowPulse: false,
    bounceRing: true,
    deadBall: true,
    informational: true,
  });
});

test("U-V12: pushBounded()は上限で最古を捨てる", () => {
  const buffer: number[] = [];
  for (let index = 0; index < VISUAL_EVENT_BUFFER + 1; index += 1) {
    pushBounded(buffer, index, VISUAL_EVENT_BUFFER);
  }
  assert.equal(buffer.length, VISUAL_EVENT_BUFFER);
  assert.equal(buffer[0], 1);
  assert.equal(buffer.at(-1), VISUAL_EVENT_BUFFER);
  const drained = buffer.splice(0, buffer.length);
  assert.equal(drained.length, VISUAL_EVENT_BUFFER);
  assert.equal(buffer.length, 0);
});

function orderScene(
  overrides: Partial<RenderOrderScene> = {},
  game: Partial<RenderOrderScene["game"]> = {},
  ball: Partial<RenderOrderScene["ball"]> = {},
): RenderOrderScene {
  return {
    game: { phase: "rally", server: "A", paused: false, ...game },
    ball: { z: -50, live: true, ...ball },
    mark: null,
    playerContactGuide: null,
    debugInput: false,
    debugStroke: { length: 0 },
    ...overrides,
  };
}

test("U-V16: renderOrder()が球とネットの前後・着地帯・debugを決める", () => {
  const effects: EffectState = createEffectState();

  const countOf = (steps: readonly string[], step: string): number =>
    steps.filter((value) => value === step).length;

  const behind = renderOrder(orderScene({}, {}, { z: 10 }), effects);
  assert.equal(countOf(behind, "ball"), 1, "球は必ず1回だけ描く");
  assert.equal(countOf(behind, "net"), 1);
  assert.ok(behind.indexOf("ball") < behind.indexOf("net"));

  const front = renderOrder(orderScene({}, {}, { z: -10 }), effects);
  assert.equal(countOf(front, "ball"), 1, "球は必ず1回だけ描く");
  assert.ok(front.indexOf("ball") > front.indexOf("net"));

  const zeroZ = renderOrder(orderScene({}, {}, { z: 0 }), effects);
  assert.equal(countOf(zeroZ, "ball"), 1, "球は必ず1回だけ描く");
  assert.ok(zeroZ.indexOf("ball") > zeroZ.indexOf("net"));

  // 死球も同じ規則。
  const withDeadBallBehind: EffectState = {
    ...createEffectState(),
    deadBall: { x: 0, y: 0, z: 20, startedAt: 0 },
  };
  const deadBehind = renderOrder(orderScene(), withDeadBallBehind);
  assert.equal(countOf(deadBehind, "deadBall"), 1, "死球は必ず1回だけ描く");
  assert.ok(deadBehind.indexOf("deadBall") < deadBehind.indexOf("net"));

  const withDeadBallFront: EffectState = {
    ...createEffectState(),
    deadBall: { x: 0, y: 0, z: -20, startedAt: 0 },
  };
  const deadFront = renderOrder(orderScene(), withDeadBallFront);
  assert.equal(countOf(deadFront, "deadBall"), 1, "死球は必ず1回だけ描く");
  assert.ok(deadFront.indexOf("deadBall") > deadFront.indexOf("net"));

  // 死球がないときは deadBall を含まない。
  assert.equal(countOf(renderOrder(orderScene(), effects), "deadBall"), 0);

  // サーブ着地帯は player serve のときだけ。
  const playerServe = renderOrder(
    orderScene({}, { phase: "serve", server: "P" }, { live: false }),
    effects,
  );
  assert.ok(playerServe.includes("serveZone"));
  assert.ok(!renderOrder(orderScene(), effects).includes("serveZone"));
  assert.ok(
    !renderOrder(
      orderScene({}, { phase: "serve", server: "A" }, { live: false }),
      effects,
    ).includes("serveZone"),
  );
  assert.ok(
    !renderOrder(
      orderScene({}, { phase: "serve", server: "P", paused: true }, { live: false }),
      effects,
    ).includes("serveZone"),
  );

  // debug 無効時に debugStroke を含まない。
  assert.ok(!renderOrder(orderScene(), effects).includes("debugStroke"));
  assert.ok(
    renderOrder(
      orderScene({ debugInput: true, debugStroke: { length: 4 } }),
      effects,
    ).includes("debugStroke"),
  );
});
