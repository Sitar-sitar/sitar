import assert from "node:assert/strict";
import test from "node:test";

import { OpponentAi } from "../src/ai.ts";
import {
  AI_SHOT_SPEED_MARGIN,
  CONTACT_ASSIST_FINE,
  CONTACT_ASSIST_TOUCH,
  HL,
  LEVELS,
  LEVEL_PLAY,
  PLAYER_SHOT_SPEED_MARGIN,
  SHOTS,
  SHOT_ORIGIN_Y_MIN,
} from "../src/config.ts";
import { buildShotIntent } from "../src/control/shot-intent.ts";
import { PaddleController } from "../src/control/paddle.ts";
import {
  launch,
  minimumViableSpeed,
  onTable,
  simLand,
  solveAngle,
  solveDirectPlayerShot,
  solveShot,
} from "../src/physics.ts";
import type {
  ContactEvent,
  LevelId,
  PointerSample,
  ShotId,
} from "../src/types.ts";

const SEED = 20260903;
const LEVEL_IDS: readonly LevelId[] = ["easy", "mid", "hard"];

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

test("U-A3: 速度フロアは drawn >= need の入力で無効、drawn < need の入力でのみ速度を上げる", () => {
  let noop = 0;
  let bound = 0;
  let driveLowFound = false;
  for (const type of ["DRIVE", "SMASH", "PUSH", "CHOP"] as ShotId[]) {
    const speed = SHOTS[type].speed;
    if (speed.model !== "absolute") continue;
    for (const power of [0.3, 1]) {
      for (const z of [-30, -100, -178]) {
        for (const y of [10, 25, 52]) {
          const from = { x: 0, y, z };
          const intent = buildShotIntent(
            {
              ...passiveContact(0.8, y, z),
              strikeMetrics: {
                vx: 0,
                vy: type === "CHOP" ? 2.5 : -2.5,
                speed: type === "SMASH" ? 3.35 : 2.5,
                displacement: 0.08,
                directionX: 0,
                directionY: type === "CHOP" ? 1 : -1,
                verticality: 1,
                curvature: 0,
                age: 0,
                active: true,
              },
            },
            -70,
          );
          const depth = intent.depth;
          const targetZ = 24 + (HL - 14 - 24) * depth;
          const drawn =
            speed.sp[0] * 0.72 + (speed.sp[1] - speed.sp[0] * 0.72) * power;
          const need = minimumViableSpeed(
            from,
            0,
            targetZ,
            intent.topSpin * 1.25,
            0,
            PLAYER_SHOT_SPEED_MARGIN,
          );
          if (drawn >= need) {
            noop += 1;
          } else {
            bound += 1;
            if (type === "DRIVE" && power === 0.3 && z === -178 && y === 10) {
              driveLowFound = true;
            }
          }
        }
      }
    }
  }
  // 両区画が非空でなければ、この負の対照は意味を持たない。
  assert.ok(noop > 0, `drawn >= need の区画が空: ${noop}`);
  assert.ok(bound > 0, `drawn < need の区画が空: ${bound}`);
  // 技種別ではなく述語で決まることの固定例。
  assert.ok(driveLowFound, "DRIVE power0.3 の最深・最低打点が binding 側にない");
});

test("U-A4: 必要速度は solveSpeed の探索上限で飽和しても有限かつ正である", () => {
  // 台の対角へ届かない極端な打点でも非有限を返さない。
  const need = minimumViableSpeed(
    { x: 0, y: 0.5, z: -178 },
    69,
    HL - 14,
    1.25,
    1,
    PLAYER_SHOT_SPEED_MARGIN,
  );
  assert.ok(Number.isFinite(need), `need=${need}`);
  assert.ok(need > 0, `need=${need}`);
  assert.ok(need <= 1300 * PLAYER_SHOT_SPEED_MARGIN, `need=${need}`);
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

test("U-A6: PLAYER_SHOT_SPEED_MARGIN は既存校正の下限根拠を保つ", () => {
  // 1.16 が設計値。1.03 では PUSH の品質差が既存閾値 0.10 を割ることを負の対照とする。
  assert.equal(PLAYER_SHOT_SPEED_MARGIN, 1.16);
  const gapFor = (margin: number) => {
    const rate = (quality: number) => {
      const random = mulberry32(20260805);
      const from = { x: 0, y: 22, z: -100 };
      const intent = buildShotIntent(passiveContact(quality, 22, -100), -80);
      let landed = 0;
      for (let trial = 0; trial < 1200; trial += 1) {
        const shot = SHOTS.PUSH;
        if (shot.speed.model !== "absolute") throw new Error("model");
        const targetZ = 24 + (HL - 14 - 24) * intent.depth;
        const spin = 0.2 * 0.55;
        const speed = Math.max(
          shot.speed.sp[0] * 0.72 +
            (shot.speed.sp[1] - shot.speed.sp[0] * 0.72) * intent.power,
          minimumViableSpeed(from, 0, targetZ, spin, 0, margin),
        );
        const angle = solveAngle(from, 0, targetZ, speed, spin, 0);
        const error = shot.err + (1 - quality) ** 2 * 0.16;
        const elevation = angle.elev + (random() * 2 - 1) * error;
        const azimuth = angle.azim + (random() * 2 - 1) * error * 1.5;
        const finalSpeed = speed * (1 + (random() * 2 - 1) * error * 1.6);
        const landing = simLand({
          ...from,
          ...launch(finalSpeed, elevation, azimuth),
          spin,
          side: 0,
        });
        if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
          landed += 1;
        }
      }
      return landed / 1200;
    };
    return 1 - rate(0.25) - (1 - rate(0.85));
  };
  assert.ok(gapFor(1.03) < 0.1, `margin 1.03 の負の対照が成立しない: ${gapFor(1.03)}`);
});

test("U-B1: 既定引数の solver は pace / precision を渡さない現行呼び出しと一致する", () => {
  const from = { x: 0, y: 26, z: 178 };
  const call = (extra: { pace?: number; precision?: number }) =>
    solveShot({
      from,
      type: "DRIVE",
      direction: -1,
      aimX: 25,
      depth: 90,
      contactQuality: 0.8,
      extraError: 0,
      ballY: 26,
      random: mulberry32(SEED),
      ...extra,
    });
  const defaults = call({});
  const explicitOne = call({ pace: 1, precision: 1 });
  for (const key of ["vx", "vy", "vz", "spin", "side"] as const) {
    assert.equal(defaults[key], explicitOne[key], key);
  }
  // 上級の製品パラメータは意図して弾道を変える（回帰ではない）。
  const hard = call({ pace: 1, precision: LEVEL_PLAY.hard.aiPrecision });
  assert.notEqual(defaults.vz, hard.vz);
  // precision は速度モデル分岐の後に適用されるため touch / arc も変わる。
  for (const type of ["STOP", "FLICK", "LOB"] as ShotId[]) {
    const base = solveShot({
      from,
      type,
      direction: -1,
      aimX: 25,
      depth: 90,
      contactQuality: 0.8,
      extraError: 0,
      ballY: 26,
      random: mulberry32(SEED),
    });
    const scaled = solveShot({
      from,
      type,
      direction: -1,
      aimX: 25,
      depth: 90,
      contactQuality: 0.8,
      extraError: 0,
      ballY: 26,
      random: mulberry32(SEED),
      precision: LEVEL_PLAY.hard.aiPrecision,
    });
    assert.notEqual(base.vz, scaled.vz, type);
  }
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
