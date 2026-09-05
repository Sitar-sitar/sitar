import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OpponentAi } from "../src/ai.ts";
import {
  ACTIVE_SIDE_CARRY,
  ACTIVE_SPIN_CARRY,
  AI_SHOT_SPEED_MARGIN,
  CONTACT_ASSIST_FINE,
  CONTACT_ASSIST_TOUCH,
  FIXED_STEP,
  FLOOR,
  HL,
  HW,
  LEVELS,
  LEVEL_PLAY,
  MAX_SIDE_SPIN,
  MAX_TOP_SPIN,
  NET_H,
  PADDLE_BLADE_SCALE,
  PASSIVE_SIDE_CARRY,
  PASSIVE_SPIN_CARRY,
  PLAYER_SHOT_SPEED_MARGIN,
  SHOTS,
  SHOT_ORIGIN_Y_MIN,
} from "../src/config.ts";
import { buildShotIntent } from "../src/control/shot-intent.ts";
import { sweptPaddleContact } from "../src/control/contact.ts";
import { PaddleController } from "../src/control/paddle.ts";
import {
  integrate,
  minimumViableSpeed,
  onTable,
  simLand,
  solveContactPlane,
  solveDirectPlayerShot,
  solveShot,
  tableBounce,
} from "../src/physics.ts";
import type {
  BallState,
  ContactEvent,
  LevelId,
  PaddlePose,
  PointerKind,
  PointerSample,
  ShotId,
  ShotIntent,
} from "../src/types.ts";
import { paddleDepthRatio, paddleScreenRadius } from "../src/utils.ts";
import {
  createProjectionCamera,
  projectWorldPoint,
  unprojectScreenXAtZ,
} from "../src/view/projection.ts";

const SEED = 20260903;
const LEVEL_IDS: readonly LevelId[] = ["easy", "mid", "hard"];

/** 変更前コミット 0d324cd の solver 出力。scripts/generate-solver-fixture.mjs で再生成する。 */
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/v023-solver.json", import.meta.url), "utf8"),
) as {
  seed: number;
  solveShotCases: {
    input: {
      from: { x: number; y: number; z: number };
      type: ShotId;
      direction: number;
      aimX: number;
      depth: number;
      contactQuality: number;
      extraError: number;
      ballY: number;
    };
    output: { vx: number; vy: number; vz: number; spin: number; side: number };
  }[];
  directCases: {
    from: { x: number; y: number; z: number };
    incoming: { spin: number; side: number };
    intent: ShotIntent;
    output: { vx: number; vy: number; vz: number; spin: number; side: number };
  }[];
};

/** fixture生成と同じLCG。 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const lerp = (a: number, b: number, ratio: number): number => a + (b - a) * ratio;
const clampValue = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * 既存 tests/direct-calibration.test.ts と同じ母集団・LCG・製品intent経路を共有する。
 * 物理処理を複製しないため solveDirectPlayerShot() をそのまま呼ぶ。
 */
const CALIBRATION_CASES = [
  { x: -45, z: -100, y: 22, smashY: 30, aimX: -0.4 },
  { x: 0, z: -100, y: 22, smashY: 52, aimX: 0 },
  { x: 45, z: -100, y: 22, smashY: 74, aimX: 0.4 },
] as const;

function calibrationIntent(type: ShotId, quality: number, aimX: number) {
  const active = type !== "PUSH";
  const upward = type !== "CHOP";
  const speed = type === "SMASH" ? 3.35 : 2.5;
  const ballHeight = type === "SMASH" ? 52 : 30;
  const built = buildShotIntent(
    {
      screenX: 0,
      screenY: 0,
      contactOffsetX: -aimX / 0.65,
      contactOffsetY: 0,
      screenQuality: quality,
      timingQuality: quality,
      contactQuality: quality,
      ballHeight,
      ballVelocityBefore: {
        x: 0,
        y: ballHeight,
        z: -100,
        vx: 0,
        vy: 0,
        vz: -500,
        spin: 0.2,
        side: -0.1,
      },
      strikeMetrics: {
        vx: 0,
        vy: active ? (upward ? -speed : speed) : 0,
        speed: active ? speed : 0,
        displacement: active ? 0.08 : 0,
        directionX: 0,
        directionY: active ? (upward ? -1 : 1) : 0,
        verticality: active ? 1 : 0,
        curvature: 0,
        age: 0,
        active,
      },
      time: 1,
    },
    -80,
  );
  assert.equal(built.classifiedShot, type);
  return built;
}

function calibrationCohort(type: ShotId, quality: number, seed: number) {
  const random = lcg(seed);
  let landed = 0;
  let total = 0;
  for (const sample of CALIBRATION_CASES) {
    for (let trial = 0; trial < 400; trial += 1) {
      const from = {
        x: sample.x,
        y: type === "SMASH" ? sample.smashY : sample.y,
        z: sample.z,
      };
      const solution = solveDirectPlayerShot({
        from,
        incoming: { spin: 0.2, side: -0.1 },
        intent: calibrationIntent(type, quality, sample.aimX),
        random,
      });
      total += 1;
      if (!solution) continue;
      const landing = simLand({ ...from, ...solution });
      if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
        landed += 1;
      }
    }
  }
  return { total, landed };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function passiveContact(quality: number, ballHeight: number, z: number): ContactEvent {
  return {
    screenX: 0,
    screenY: 0,
    contactOffsetX: 0,
    contactOffsetY: 0,
    screenQuality: quality,
    timingQuality: quality,
    contactQuality: quality,
    ballHeight,
    ballVelocityBefore: {
      x: 0,
      y: ballHeight,
      z,
      vx: 0,
      vy: -100,
      vz: -500,
      spin: 0,
      side: 0,
    },
    strikeMetrics: {
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
    time: 1,
  };
}

const PLANES = [-30, -60, -90, -120, -150, -178] as const;
const HEIGHTS = [10, 17, 26] as const;

/** 設計書 §3.1 生成器B。セルごとにseedを再初期化し、各セル400試行。 */
function passivePushCells(quality: number, errorScale: number) {
  const cells: { z: number; y: number; rate: number }[] = [];
  let landed = 0;
  let total = 0;
  for (const z of PLANES) {
    for (const y of HEIGHTS) {
      const random = mulberry32(SEED);
      const from = { x: 0, y, z };
      const intent = buildShotIntent(passiveContact(quality, y, z), -70);
      assert.equal(intent.classifiedShot, "PUSH");
      assert.equal(intent.passive, true);
      let cell = 0;
      for (let trial = 0; trial < 400; trial += 1) {
        const solution = solveDirectPlayerShot({
          from,
          incoming: { spin: 0, side: 0 },
          intent,
          random,
          errorScale,
        });
        assert.ok(solution, "solverが非有限解を返した");
        const landing = simLand({ ...from, ...solution });
        if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
          cell += 1;
        }
      }
      cells.push({ z, y, rate: cell / 400 });
      landed += cell;
      total += 400;
    }
  }
  return { cells, rate: landed / total };
}

test("U-A1: 置くだけ返球は難易度別の到達率下限を満たし、難易度順に単調である", () => {
  const thresholds: Record<LevelId, { all: number; cell: number }> = {
    easy: { all: 0.99, cell: 0.99 },
    mid: { all: 0.97, cell: 0.88 },
    hard: { all: 0.88, cell: 0.7 },
  };
  const rates: number[] = [];
  for (const level of LEVEL_IDS) {
    const play = LEVEL_PLAY[level];
    const result = passivePushCells(
      play.contactQualityFloor,
      play.playerErrorScale,
    );
    rates.push(result.rate);
    assert.ok(
      result.rate >= thresholds[level].all,
      `${level} 全体 ${result.rate}`,
    );
    for (const cell of result.cells) {
      assert.ok(
        cell.rate >= thresholds[level].cell,
        `${level} z=${cell.z} y=${cell.y} ${cell.rate}`,
      );
    }
  }
  assert.ok(rates[0]! >= rates[1]! && rates[1]! >= rates[2]!, rates.join(", "));
});

test("U-A2: 置くだけ返球のミス率は接触品質に対して単調増加し、最深打点で0より大きい", () => {
  const qualities = [1, 0.7, 0.55, 0.47, 0.4];
  const misses = qualities.map((quality) => 1 - passivePushCells(quality, 1).rate);
  for (let index = 1; index < misses.length; index += 1) {
    assert.ok(
      misses[index]! >= misses[index - 1]!,
      `q=${qualities[index]} のミス率が単調でない: ${misses.join(", ")}`,
    );
  }
  const worst = passivePushCells(0.4, 1).cells.find(
    (cell) => cell.z === -178 && cell.y === 10,
  );
  assert.ok(worst && worst.rate < 1, `最深打点でミスが消えている: ${worst?.rate}`);
});

test("U-A3: 速度フロアは drawn >= need で旧v0.2.3出力と一致し、drawn < need でのみ速度を上げる", () => {
  // 負の対照の比較元は、変更前コミット 0d324cd の solver 出力を固定した fixture。
  // scripts/generate-solver-fixture.mjs で再生成できる。
  let identical = 0;
  let increased = 0;
  let driveLowBinding = false;
  for (const testCase of fixture.directCases) {
    const { from, incoming, intent, output } = testCase;
    const actual = solveDirectPlayerShot({
      from,
      incoming,
      intent,
      random: lcg(fixture.seed),
    });
    assert.ok(actual, JSON.stringify({ from, type: intent.classifiedShot }));
    const oldSpeed = Math.hypot(output.vx, output.vy, output.vz);
    const newSpeed = Math.hypot(actual.vx, actual.vy, actual.vz);
    const speedSpec = SHOTS[intent.classifiedShot].speed;
    if (speedSpec.model !== "absolute") continue;
    const drawn = lerp(
      speedSpec.sp[0] * 0.72,
      speedSpec.sp[1],
      intent.power,
    );
    const targetZ = lerp(24, HL - 14, intent.depth);
    const spin = clampValue(
      intent.topSpin * 1.25 +
        incoming.spin * (intent.passive ? PASSIVE_SPIN_CARRY : ACTIVE_SPIN_CARRY),
      -MAX_TOP_SPIN,
      MAX_TOP_SPIN,
    );
    const side = clampValue(
      incoming.side * (intent.passive ? PASSIVE_SIDE_CARRY : ACTIVE_SIDE_CARRY),
      -MAX_SIDE_SPIN,
      MAX_SIDE_SPIN,
    );
    const need = minimumViableSpeed(
      from,
      intent.aimX * (HW - 7),
      targetZ,
      spin,
      side,
      PLAYER_SHOT_SPEED_MARGIN,
    );
    if (drawn >= need) {
      // フロアが無効な区画は旧出力と全要素一致しなければならない。
      for (const key of ["vx", "vy", "vz", "spin", "side"] as const) {
        assert.equal(
          actual[key],
          output[key],
          `${intent.classifiedShot} z=${from.z} y=${from.y} power=${intent.power} ${key}`,
        );
      }
      identical += 1;
    } else {
      assert.ok(
        newSpeed > oldSpeed,
        `${intent.classifiedShot} z=${from.z} y=${from.y}: ${newSpeed} <= ${oldSpeed}`,
      );
      increased += 1;
      if (
        intent.classifiedShot === "DRIVE" &&
        intent.power === 0.3 &&
        from.z === -178 &&
        from.y === 10
      ) {
        driveLowBinding = true;
      }
    }
  }
  // 両区画が非空でなければ負の対照として意味を持たない。
  assert.ok(identical > 0, `drawn >= need の区画が空: ${identical}`);
  assert.ok(increased > 0, `drawn < need の区画が空: ${increased}`);
  // 技種別ではなく述語で決まることの固定例。
  assert.ok(driveLowBinding, "DRIVE power0.3 の最深・最低打点が binding 側にない");
});

test("U-A3': touch / arc モデルは errorScale=1 で旧v0.2.3出力と一致する", () => {
  let checked = 0;
  for (const testCase of fixture.directCases) {
    const { from, incoming, intent, output } = testCase;
    if (SHOTS[intent.classifiedShot].speed.model === "absolute") continue;
    const actual = solveDirectPlayerShot({
      from,
      incoming,
      intent,
      random: lcg(fixture.seed),
    });
    assert.ok(actual);
    for (const key of ["vx", "vy", "vz", "spin", "side"] as const) {
      assert.equal(actual[key], output[key], `${intent.classifiedShot} ${key}`);
    }
    checked += 1;
  }
  assert.ok(checked > 0, `touch / arc の母集団が空: ${checked}`);
});

test("U-A4: 必要速度は探索上限で飽和し、製品の到達しうる入力はその手前に収まる", () => {
  // solveSpeed は [250, 1300] を11回二分するため、飽和値は上限へ収束した (low+high)/2。
  const cap = 1300 * PLAYER_SHOT_SPEED_MARGIN;
  const saturating = minimumViableSpeed(
    { x: 0, y: 0.2, z: -600 },
    HW - 7,
    HL - 14,
    MAX_TOP_SPIN,
    MAX_SIDE_SPIN,
    PLAYER_SHOT_SPEED_MARGIN,
  );
  assert.ok(Number.isFinite(saturating), `${saturating}`);
  assert.ok(saturating > 0, `${saturating}`);
  assert.ok(
    cap - saturating < 1,
    `飽和していない: ${saturating} (cap ${cap})`,
  );

  // 製品で発生する接触面・打点高さでは上限へ達しない（フロアが無効化されない）。
  let worst = 0;
  for (const z of PLANES) {
    for (const y of [0.2, ...HEIGHTS, 52]) {
      const need = minimumViableSpeed(
        { x: 0, y, z },
        HW - 7,
        HL - 14,
        MAX_TOP_SPIN,
        MAX_SIDE_SPIN,
        PLAYER_SHOT_SPEED_MARGIN,
      );
      assert.ok(Number.isFinite(need) && need > 0, `z=${z} y=${y}: ${need}`);
      worst = Math.max(worst, need);
    }
  }
  assert.ok(worst < cap * 0.95, `製品入力が飽和境界へ近すぎる: ${worst}`);
});

test("U-A5: active PUSH / CHOP は実接触面から相手コートへ戻る", () => {
  const expectations: { type: ShotId; quality: number; min: number }[] = [
    { type: "PUSH", quality: 1, min: 1 },
    { type: "PUSH", quality: 0.4, min: 0.88 },
    { type: "CHOP", quality: 1, min: 1 },
    { type: "CHOP", quality: 0.4, min: 0.72 },
  ];
  for (const { type, quality, min } of expectations) {
    const random = mulberry32(SEED);
    const from = { x: 0, y: 25, z: -178 };
    const baseDepth = Math.min(
      1,
      Math.max(0, (SHOTS[type].dep - 24) / (HL - 14 - 24)),
    );
    let landed = 0;
    for (let trial = 0; trial < 800; trial += 1) {
      const solution = solveDirectPlayerShot({
        from,
        incoming: { spin: 0.5, side: 0 },
        intent: {
          power: 0.5,
          aimX: 0,
          depth: baseDepth,
          lift: type === "CHOP" ? -0.7 : 0.7,
          topSpin: type === "CHOP" ? -0.475 : 0.475,
          sideSpin: 0,
          contactQuality: quality,
          timingQuality: quality,
          strokeCurvature: 0,
          classifiedShot: type,
          passive: false,
          isServe: false,
        },
        random,
      });
      assert.ok(solution);
      const landing = simLand({ ...from, ...solution });
      if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
        landed += 1;
      }
    }
    assert.ok(landed / 800 >= min, `${type} q=${quality}: ${landed}/800`);
  }
});

test("U-A6: PLAYER_SHOT_SPEED_MARGIN=1.16 は既存校正の4技を閾値変更なしで満たす", () => {
  assert.equal(PLAYER_SHOT_SPEED_MARGIN, 1.16);
  // 既存 direct-calibration と同じ母集団・LCG seed・製品intent経路を共有する
  // （物理処理を複製しない）。期待値は正本§6.3。
  const expected: [ShotId, number][] = [
    ["DRIVE", 0.279167],
    ["CHOP", 0.240833],
    ["PUSH", 0.114167],
    ["SMASH", 0.354167],
  ];
  for (const [type, gap] of expected) {
    const high = calibrationCohort(type, 0.85, 20260805);
    const low = calibrationCohort(type, 0.25, 20260805);
    assert.equal(high.total, 1200, type);
    const highRate = high.landed / high.total;
    const actualGap = 1 - low.landed / low.total - (1 - highRate);
    assert.ok(
      Math.abs(actualGap - gap) < 1e-6,
      `${type} gap ${actualGap} != ${gap}`,
    );
    // 既存テストが課す条件そのもの。
    assert.ok(actualGap >= 0.1, `${type} gap ${actualGap}`);
    assert.ok(highRate >= (type === "SMASH" ? 0.7 : 0.85), `${type} ${highRate}`);
  }
});

test("U-B1: 既定引数の solveShot は旧v0.2.3出力と全要素一致する", () => {
  let checked = 0;
  for (const { input, output } of fixture.solveShotCases) {
    const actual = solveShot({ ...input, random: lcg(fixture.seed) });
    for (const key of ["vx", "vy", "vz", "spin", "side"] as const) {
      assert.equal(
        actual[key],
        output[key],
        `${input.type} y=${input.ballY} dir=${input.direction} q=${input.contactQuality} ${key}`,
      );
    }
    checked += 1;
  }
  assert.equal(checked, fixture.solveShotCases.length);
  assert.ok(checked > 0);
});

test("U-B1': 上級の製品パラメータは意図して弾道を変える（全速度モデル）", () => {
  const from = { x: 0, y: 26, z: 178 };
  const call = (extra: { pace?: number; precision?: number }, type: ShotId) =>
    solveShot({
      from,
      type,
      direction: -1,
      aimX: 25,
      depth: 90,
      contactQuality: 0.8,
      extraError: 0,
      ballY: 26,
      random: lcg(fixture.seed),
      ...extra,
    });
  // precision は速度モデル分岐の後に適用されるため touch / arc も変わる。
  for (const type of ["DRIVE", "SMASH", "STOP", "FLICK", "LOB"] as ShotId[]) {
    const base = call({}, type);
    const hard = call({ precision: LEVEL_PLAY.hard.aiPrecision }, type);
    assert.notEqual(base.vz, hard.vz, type);
  }
  // pace は absolute だけへ効く。
  const paced = call({ pace: LEVEL_PLAY.easy.aiPace }, "DRIVE");
  assert.notEqual(call({}, "DRIVE").vz, paced.vz);
});

test("U-B2: aiPace は抽選速度を下回る減速を行わない", () => {
  const from = { x: 0, y: 20, z: 178 };
  for (const pace of [0, 0.2, 0.65]) {
    for (const type of ["PUSH", "CHOP", "DRIVE"] as ShotId[]) {
      const speed = SHOTS[type].speed;
      if (speed.model !== "absolute") continue;
      const paced = solveShot({
        from,
        type,
        direction: -1,
        aimX: 0,
        depth: 100,
        contactQuality: 1,
        extraError: 0,
        ballY: 20,
        random: mulberry32(SEED),
        pace,
      });
      const drawn = solveShot({
        from,
        type,
        direction: -1,
        aimX: 0,
        depth: 100,
        contactQuality: 1,
        extraError: 0,
        ballY: 20,
        random: mulberry32(SEED),
      });
      const pacedSpeed = Math.hypot(paced.vx, paced.vy, paced.vz);
      const drawnSpeed = Math.hypot(drawn.vx, drawn.vy, drawn.vz);
      // 必要速度が抽選速度を上回る局面では min() により減速しない。
      const need = minimumViableSpeed(
        from,
        0,
        -100,
        SHOTS[type].spin,
        0,
        AI_SHOT_SPEED_MARGIN,
      );
      if (need >= drawnSpeed) {
        assert.ok(
          pacedSpeed >= drawnSpeed * 0.999,
          `${type} pace=${pace}: ${pacedSpeed} < ${drawnSpeed}`,
        );
      }
    }
  }
});

test("U-B3: AI 1球あたり自滅率は初級 > 中級 > 上級で単調減少する", () => {
  const rates = LEVEL_IDS.map((level) => {
    const random = mulberry32(SEED);
    const ai = new OpponentAi(random);
    let attempted = 0;
    let bad = 0;
    for (let trial = 0; trial < 8000; trial += 1) {
      const ball = {
        x: (random() * 2 - 1) * 45,
        y: 16 + random() * 26,
        z: 150 + random() * 28,
        vx: 0,
        vy: -120,
        vz: 300,
        spin: 0.2,
        side: 0,
        live: true,
        hitter: "P" as const,
        bounces: 1,
        serveStage: 0,
        lastBounceZ: 40 + random() * 70,
      };
      ai.state.x = ball.x + (random() * 2 - 1) * LEVELS[level].reach * 0.7;
      const playerX = (random() * 2 - 1) * 60;
      const decision = ai.decideShot(ball, playerX, level);
      if (!decision) continue;
      attempted += 1;
      const from = {
        x: ball.x,
        y: Math.max(ball.y, SHOT_ORIGIN_Y_MIN),
        z: ball.z,
      };
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
        pace: LEVEL_PLAY[level].aiPace,
        precision: LEVEL_PLAY[level].aiPrecision,
      });
      const landing = simLand({ ...from, ...solution });
      if (landing.net || !onTable(landing.x, landing.z) || landing.z >= 0) {
        bad += 1;
      }
    }
    return (bad / attempted) * 100;
  });
  assert.ok(rates[0]! > rates[1]!, `初級 ${rates[0]} <= 中級 ${rates[1]}`);
  assert.ok(rates[1]! > rates[2]!, `中級 ${rates[1]} <= 上級 ${rates[2]}`);
  assert.ok(rates[0]! >= 6, `初級 ${rates[0]}`);
  assert.ok(rates[2]! <= 4.5, `上級 ${rates[2]}`);
});

test("U-C2: 補助倍率は初級 > 中級 > 上級で、上級はv0.2.3の値と一致する", () => {
  assert.equal(LEVEL_PLAY.hard.assistScale, 1);
  assert.equal(LEVEL_PLAY.hard.contactQualityFloor, 0.4);
  assert.equal(LEVEL_PLAY.hard.playerErrorScale, 1);
  for (const base of [CONTACT_ASSIST_TOUCH, CONTACT_ASSIST_FINE]) {
    const scales = LEVEL_IDS.map((level) => base * LEVEL_PLAY[level].assistScale);
    assert.ok(scales[0]! > scales[1]! && scales[1]! > scales[2]!, scales.join(", "));
    assert.equal(scales[2], base);
  }
  assert.ok(
    LEVEL_PLAY.easy.contactQualityFloor > LEVEL_PLAY.mid.contactQualityFloor &&
      LEVEL_PLAY.mid.contactQualityFloor > LEVEL_PLAY.hard.contactQualityFloor,
  );
  assert.ok(
    LEVEL_PLAY.easy.playerErrorScale < LEVEL_PLAY.mid.playerErrorScale &&
      LEVEL_PLAY.mid.playerErrorScale < LEVEL_PLAY.hard.playerErrorScale,
  );
});

test("U-C5: 補助倍率はpointer種別の確定・切替・失効・resetへ追従する", () => {
  const width = 844;
  const height = 390;
  const sample = (
    pointerType: "touch" | "mouse",
    time: number,
  ): PointerSample => ({
    clientX: width / 2,
    clientY: height * 0.8,
    stageX: 0.5,
    stageY: 0.8,
    time,
    pointerType,
  });

  for (const level of LEVEL_IDS) {
    const controller = new PaddleController();
    controller.setLevelAssistScale(LEVEL_PLAY[level].assistScale);
    controller.advanceFrame(0, 1 / 60, width, height, -100, -100);
    // 試合開始直後: pointer未確定
    assert.equal(controller.getAssistScale(), null, `${level} 開始直後`);
    assert.equal(controller.getDebugState(0).assistScale, null);

    // 初回入力（touch）
    const history: PointerSample[] = [sample("touch", 0.1), sample("touch", 0.12)];
    controller.applyInput(
      {
        sample: history[1]!,
        metrics: {
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
        },
        history,
        width,
        height,
        time: 0.12,
      },
      -100,
      -100,
    );
    const touchExpected = CONTACT_ASSIST_TOUCH * LEVEL_PLAY[level].assistScale;
    assert.equal(controller.getAssistScale(), touchExpected, `${level} touch`);
    assert.equal(controller.getDebugState(0.12).assistScale, touchExpected);

    // release猶予中は保持する
    controller.release(0.2);
    assert.equal(controller.getAssistScale(), touchExpected, `${level} follow`);

    // reset後はnullへ戻る
    controller.reset();
    controller.advanceFrame(5, 1, width, height, -100, -100);
    assert.equal(controller.getAssistScale(), null, `${level} reset`);

    // 再入力をmouseで行うと fine 側へ切り替わる
    const mouseHistory: PointerSample[] = [
      sample("mouse", 6),
      sample("mouse", 6.02),
    ];
    controller.applyInput(
      {
        sample: mouseHistory[1]!,
        metrics: {
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
        },
        history: mouseHistory,
        width,
        height,
        time: 6.02,
      },
      -100,
      -100,
    );
    assert.equal(
      controller.getAssistScale(),
      CONTACT_ASSIST_FINE * LEVEL_PLAY[level].assistScale,
      `${level} mouse`,
    );
  }
});

/**
 * 製品の接触経路で、補助輪郭端の接触を1件作る。
 * offsetRatio=1.0 で assist 楕円の端、0 で中心。
 */
function edgeContact(
  level: LevelId,
  pointerType: PointerKind,
  offsetRatio: number,
  worldZ = -178,
  ballY = 17,
) {
  const width = 844;
  const height = 390;
  const camera = createProjectionCamera(width, height);
  const projected = projectWorldPoint(camera, 0, ballY, worldZ);
  const radius = paddleScreenRadius(width, height, paddleDepthRatio(worldZ));
  const assistScale =
    (pointerType === "touch" ? CONTACT_ASSIST_TOUCH : CONTACT_ASSIST_FINE) *
    LEVEL_PLAY[level].assistScale;
  const visualRx = radius * PADDLE_BLADE_SCALE * assistScale;
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
    pointerType,
  };
  const ballX = unprojectScreenXAtZ(
    camera,
    projected.x + visualRx * offsetRatio,
    worldZ,
  );
  const previousBall = {
    x: ballX,
    y: ballY,
    z: worldZ + 1,
    vx: 0,
    vy: -100,
    vz: -500,
    spin: 0.2,
    side: -0.1,
  };
  return sweptPaddleContact({
    previousBall,
    currentBall: { ...previousBall, z: worldZ },
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
    assistScale,
    contactQualityFloor: LEVEL_PLAY[level].contactQualityFloor,
  });
}

test("U-C3: 補助輪郭端の接触品質は難易度別の下限へ丸められる（0.4固定への退行を検出する）", () => {
  const observed: number[] = [];
  for (const level of LEVEL_IDS) {
    for (const pointerType of ["touch", "mouse"] as PointerKind[]) {
      const contact = edgeContact(level, pointerType, 1);
      assert.ok(contact, `${level}/${pointerType} で接触が成立しない`);
      // 輪郭端は screenQuality≈0 なので、品質は下限そのものになる。
      assert.equal(
        contact.contactQuality,
        LEVEL_PLAY[level].contactQualityFloor,
        `${level}/${pointerType}: ${contact.contactQuality}`,
      );
      observed.push(contact.contactQuality);
    }
    // 中心接触は下限より高い品質になる（下限が上書きしていないこと）。
    const center = edgeContact(level, "touch", 0);
    assert.ok(center);
    assert.ok(
      center.contactQuality > LEVEL_PLAY[level].contactQualityFloor,
      `${level} 中心: ${center.contactQuality}`,
    );
  }
  // 初級 > 中級 > 上級 の下限が実際に出ていること。
  assert.ok(observed[0]! > observed[2]! && observed[2]! > observed[4]!, observed.join(", "));
});

test("U-D1: 実接触面 z=-178 の輪郭端接触は、非ゼロincoming spinでも相手コートへ着地する", () => {
  for (const [level, pointerType] of [
    ["easy", "touch"],
    ["hard", "mouse"],
  ] as [LevelId, PointerKind][]) {
    const contact = edgeContact(level, pointerType, 1);
    assert.ok(contact, `${level}/${pointerType}`);
    const intent = buildShotIntent(contact, -70);
    assert.equal(intent.classifiedShot, "PUSH");
    assert.equal(intent.passive, true);
    const from = { x: 0, y: Math.max(contact.ballHeight, SHOT_ORIGIN_Y_MIN), z: -178 };
    const random = mulberry32(SEED);
    let landed = 0;
    for (let trial = 0; trial < 400; trial += 1) {
      const solution = solveDirectPlayerShot({
        from,
        // 製品と同じく非ゼロのincoming spin / sideを持ち込む。
        incoming: { spin: 0.2, side: -0.1 },
        intent,
        random,
        errorScale: LEVEL_PLAY[level].playerErrorScale,
      });
      assert.ok(solution);
      const landing = simLand({ ...from, ...solution });
      if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
        landed += 1;
      }
    }
    const rate = landed / 400;
    const minimum = level === "easy" ? 0.95 : 0.6;
    assert.ok(rate >= minimum, `${level}/${pointerType}: ${rate}`);
  }
});

test("U-C1: 返球猶予p50は初級 >= 0.45s > 中級 >= 0.40s > 上級（0.27-0.30s）", () => {
  // 設計書§3.1 生成器Aと同じ母集団・seed・除外条件。試行数はunit向けにN=1,500。
  const medians = LEVEL_IDS.map((level) => {
    const random = mulberry32(SEED);
    const ai = new OpponentAi(random);
    const flights: number[] = [];
    for (let trial = 0; trial < 1500; trial += 1) {
      const ball: BallState = {
        x: (random() * 2 - 1) * 45,
        y: 16 + random() * 26,
        z: 150 + random() * 28,
        vx: 0,
        vy: -120,
        vz: 300,
        spin: 0.2,
        side: 0,
        live: true,
        hitter: "P",
        bounces: 1,
        serveStage: 0,
        lastBounceZ: 40 + random() * 70,
      };
      ai.state.x = ball.x + (random() * 2 - 1) * LEVELS[level].reach * 0.7;
      const playerX = (random() * 2 - 1) * 60;
      const decision = ai.decideShot(ball, playerX, level);
      if (!decision) continue;
      const from = {
        x: ball.x,
        y: Math.max(ball.y, SHOT_ORIGIN_Y_MIN),
        z: ball.z,
      };
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
        pace: LEVEL_PLAY[level].aiPace,
        precision: LEVEL_PLAY[level].aiPrecision,
      });
      const landing = simLand({ ...from, ...solution });
      if (landing.net || !onTable(landing.x, landing.z) || landing.z >= 0) continue;
      Object.assign(ball, from, solution);
      ball.hitter = "A";
      ball.bounces = 0;
      ball.lastBounceZ = null;
      const plane = solveContactPlane(ball, "P");
      let previousY: number;
      let previousZ: number;
      let bounced = false;
      let elapsed = 0;
      for (let step = 0; step < 240 * 5; step += 1) {
        previousY = ball.y;
        previousZ = ball.z;
        integrate(ball, FIXED_STEP);
        elapsed += FIXED_STEP;
        if (previousZ < 0 !== ball.z < 0) {
          const ratio = (0 - previousZ) / (ball.z - previousZ);
          if (previousY + (ball.y - previousY) * ratio < NET_H) break;
        }
        if (previousY > 0 && ball.y <= 0) {
          if (!onTable(ball.x, ball.z)) break;
          if (!bounced && ball.z < 0) {
            bounced = true;
            tableBounce(ball);
            continue;
          }
          break;
        }
        if (ball.y < FLOOR) break;
        if (bounced && previousZ > plane && ball.z <= plane) {
          flights.push(elapsed);
          break;
        }
      }
    }
    assert.ok(flights.length > 500, `${level} 標本不足: ${flights.length}`);
    const sorted = [...flights].sort((a, b) => a - b);
    return sorted[Math.floor(0.5 * sorted.length)]!;
  });
  const [easy, mid, hard] = medians as [number, number, number];
  assert.ok(easy >= 0.45, `初級 ${easy}`);
  assert.ok(easy > mid, `初級 ${easy} <= 中級 ${mid}`);
  assert.ok(mid >= 0.4, `中級 ${mid}`);
  assert.ok(mid > hard, `中級 ${mid} <= 上級 ${hard}`);
  assert.ok(hard >= 0.27 && hard <= 0.3, `上級 ${hard}`);
});
