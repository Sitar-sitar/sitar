import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_SERVE_LENGTH_WEIGHTS,
  AI_SERVE_WEIGHTS,
  AZ,
  HW,
  PZ,
  SERVE_LENGTH_PROFILES,
  SERVE_LENGTHS,
  SERVE_PROFILES,
  SERVE_TYPES,
  SHOTS,
} from "../src/config.ts";
import {
  launch,
  simLand,
  simState,
  solveServe,
  solveShot,
  tableBounce,
} from "../src/physics.ts";
import {
  classifyPlayerShot,
  chooseServeLength,
  chooseWeightedServe,
  isGameOver,
  isShortBall,
  opponentOf,
  resolveMiss,
  rotateServerAfterPoint,
  swingTypeOf,
} from "../src/rules.ts";
import type {
  BallVector,
  ServeLength,
  ServeType,
} from "../src/types.ts";
import {
  clampPaddleScreenY,
  moveToward,
  paddleBottomExtent,
  paddleDepthRatio,
  paddleHandleAngle,
  paddleScreenRadius,
  paddleScreenY,
  paddleShadowY,
  projectScale,
  stepViewZ,
} from "../src/utils.ts";

function traceServe(
  serveType: ServeType,
  direction: 1 | -1,
  aimX: number,
  serveLength: ServeLength = "middle",
): { firstX: number; secondX: number; secondZ: number } {
  const profile = SERVE_PROFILES[serveType];
  const length = SERVE_LENGTH_PROFILES[serveLength];
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
    length,
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
  return {
    firstX: first.x,
    secondX: second.x,
    secondZ: second.z,
  };
}

const serveTraceCache = new Map<
  string,
  ReturnType<typeof traceServe>
>();

function cachedServeTrace(
  serveType: ServeType,
  direction: 1 | -1,
  aimX: number,
  serveLength: ServeLength,
): ReturnType<typeof traceServe> {
  const key = `${serveType}:${direction}:${aimX}:${serveLength}`;
  const cached = serveTraceCache.get(key);
  if (cached) {
    return cached;
  }
  const trace = traceServe(serveType, direction, aimX, serveLength);
  serveTraceCache.set(key, trace);
  return trace;
}

test("9種類×3長さのサーブが両方向・代表3狙いで成立する", () => {
  for (const serveType of SERVE_TYPES) {
    for (const serveLength of SERVE_LENGTHS) {
      for (const direction of [1, -1] as const) {
        for (const aimX of [-50, 0, 50]) {
          cachedServeTrace(
            serveType,
            direction,
            aimX,
            serveLength,
          );
        }
      }
    }
  }
});

test("サーブの2バウンド目は長さ別帯に入り短い順になる", () => {
  for (const serveType of SERVE_TYPES) {
    for (const direction of [1, -1] as const) {
      for (const aimX of [-50, 0, 50]) {
        const short = Math.abs(
          cachedServeTrace(serveType, direction, aimX, "short")
            .secondZ,
        );
        const middle = Math.abs(
          cachedServeTrace(serveType, direction, aimX, "middle")
            .secondZ,
        );
        const long = Math.abs(
          cachedServeTrace(serveType, direction, aimX, "long")
            .secondZ,
        );

        assert.ok(short >= 20 && short <= 48);
        assert.ok(middle >= 52 && middle <= 82);
        assert.ok(long >= 104 && long <= 135);
        assert.ok(short < middle);
        assert.ok(middle < long);
      }
    }
  }
});

test("サーブ長さプロファイルは中を現行値に保ち目標が単調増加する", () => {
  assert.deepEqual(SERVE_LENGTH_PROFILES.middle, {
    id: "middle",
    label: "中",
    targetZ: 70,
    distances: [82, 60],
    speedBase: 300,
    speedStep: 66,
    aimScale: 0.35,
  });
  assert.ok(
    SERVE_LENGTH_PROFILES.short.targetZ <
      SERVE_LENGTH_PROFILES.middle.targetZ,
  );
  assert.ok(
    SERVE_LENGTH_PROFILES.middle.targetZ <
      SERVE_LENGTH_PROFILES.long.targetZ,
  );
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
  assert.equal(chooseWeightedServe("easy", () => 0.9), "knuckle");
  assert.equal(
    chooseWeightedServe("easy", () => 0.99),
    "backspin-right",
  );
  assert.equal(AI_SERVE_WEIGHTS.easy.backspin, 0);
  assert.equal(AI_SERVE_WEIGHTS.easy["topspin-left"], 0);
  assert.equal(AI_SERVE_WEIGHTS.easy["topspin-right"], 0);
  assert.equal(AI_SERVE_WEIGHTS.easy["backspin-left"], 0);

  const midKinds = new Set(
    [0.01, 0.19, 0.39, 0.51, 0.63, 0.75, 0.83, 0.91, 0.96].map(
      (value) =>
      chooseWeightedServe("mid", () => value),
    ),
  );
  assert.deepEqual(midKinds, new Set(SERVE_TYPES));
});

test("AIサーブ長は難易度別重みで3種を1乱数で選べる", () => {
  assert.deepEqual(AI_SERVE_LENGTH_WEIGHTS, {
    easy: { short: 5, middle: 80, long: 15 },
    mid: { short: 25, middle: 50, long: 25 },
    hard: { short: 40, middle: 30, long: 30 },
  });

  const samples = {
    easy: [0.01, 0.5, 0.9],
    mid: [0.1, 0.5, 0.9],
    hard: [0.1, 0.5, 0.8],
  } as const;
  for (const level of ["easy", "mid", "hard"] as const) {
    const selected = new Set<ServeLength>();
    for (const value of samples[level]) {
      let consumed = 0;
      selected.add(
        chooseServeLength(level, () => {
          consumed += 1;
          return value;
        }),
      );
      assert.equal(consumed, 1);
    }
    assert.deepEqual(selected, new Set(SERVE_LENGTHS));
  }
});

test("相手サイドを反転できる", () => {
  assert.equal(opponentOf("P"), "A");
  assert.equal(opponentOf("A"), "P");
});

test("moveTowardは目標を越えない", () => {
  assert.equal(moveToward(0, 10, 3), 3);
  assert.equal(moveToward(0, 2, 3), 2);
  assert.equal(moveToward(0, -10, 3), -3);
});

test("プレイヤーラケットの縦位置は画面下部を基準にスイングで変わる", () => {
  const height = 1_000;
  const baseY = height * 0.86;

  assert.equal(paddleScreenY(height, 0, 1, 1), baseY);
  assert.ok(paddleScreenY(height, 1, 1, 1) < baseY);
  assert.ok(paddleScreenY(height, 1, -1, 1) > baseY);
  assert.ok(paddleScreenY(height, 1, 0, 1) < baseY);

  // 奥（depth=0）ほど上へ寄り、スイングのオフセットは同じ向きに効く
  const deepBaseY = height * 0.74;
  assert.equal(paddleScreenY(height, 0, 1, 0), deepBaseY);
  assert.ok(paddleScreenY(height, 1, 1, 0) < deepBaseY);
  assert.ok(paddleScreenY(height, 1, -1, 0) > deepBaseY);
});

test("プレイヤーラケット半径は画面短辺と奥行きで決まる", () => {
  assert.equal(paddleScreenRadius(320, 240, 1), 18);
  assert.equal(paddleScreenRadius(2_000, 1_500, 1), 46);
  assert.equal(paddleScreenRadius(800, 600, 1), 33);

  // 奥では70%へ縮む。下限に貼り付く小画面でも縮小が効く
  assert.equal(paddleScreenRadius(800, 600, 0), 33 * 0.7);
  assert.equal(paddleScreenRadius(320, 240, 0), 18 * 0.7);
});

test("奥行き比は打点平面の範囲を0〜1へ写す", () => {
  assert.equal(paddleDepthRatio(-30), 0);
  assert.equal(paddleDepthRatio(30), 0);
  assert.equal(paddleDepthRatio(-178), 1);
  assert.equal(paddleDepthRatio(178), 1);
  assert.equal(paddleDepthRatio(PZ), (152 - 30) / (178 - 30));
  assert.equal(paddleDepthRatio(-20), 0);
  assert.equal(paddleDepthRatio(-300), 1);
  // 符号に依存しない
  assert.equal(paddleDepthRatio(152), paddleDepthRatio(PZ));
});

test("影はラケットの下にあり奥ほど近づく", () => {
  const height = 1_000;

  for (const depth of [0, 0.5, 1]) {
    assert.ok(
      paddleShadowY(height, depth) > paddleScreenY(height, 0, 0, depth),
    );
  }
  const nearGap =
    paddleShadowY(height, 1) - paddleScreenY(height, 0, 0, 1);
  const farGap =
    paddleShadowY(height, 0) - paddleScreenY(height, 0, 0, 0);
  assert.ok(farGap < nearGap);
});

test("同じ奥行きならボールとラケットの画面上Xが一致する", () => {
  // 320x568相当のカメラ設定
  const focal = 416;
  const cameraZ = -330;
  const contactZ = -178;
  const worldX = 104;

  // 打球成立時、ボールとラケットは同じ平面 z を通るので倍率が等しい
  assert.equal(
    projectScale(focal, cameraZ, contactZ),
    projectScale(focal, cameraZ, contactZ),
  );
  const paddleX = worldX * projectScale(focal, cameraZ, contactZ);
  const ballX = worldX * projectScale(focal, cameraZ, contactZ);
  assert.equal(paddleX, ballX);

  // 追従中の viewZ で投影すると画面上Xがずれる（横位置に使えない根拠）
  const lagged = worldX * projectScale(focal, cameraZ, PZ);
  const deep = worldX * projectScale(focal, cameraZ, -62);
  assert.ok(Math.abs(paddleX - lagged) > 41);
  assert.ok(Math.abs(paddleX - deep) > 123);
});

test("viewZは目標へ滑らかに追従し越えない", () => {
  const dt = 1 / 240;
  const step = 380 * dt;

  // 1ステップの移動量は上限を超えない
  assert.equal(stepViewZ(-152, -178, dt), -152 - step);
  assert.equal(stepViewZ(-152, -62, dt), -152 + step);
  // 目標を越えない
  assert.equal(stepViewZ(-152, -152.5, dt), -152.5);
  // 到達後は変わらない
  assert.equal(stepViewZ(-178, -178, dt), -178);
  // dt=0では動かない
  assert.equal(stepViewZ(-152, -178, 0), -152);

  // 複数ステップで到達する（最大移動幅116を約0.31秒）
  let viewZ = -62;
  for (let index = 0; index < 240 * 0.31; index += 1) {
    viewZ = stepViewZ(viewZ, -178, dt);
  }
  assert.equal(viewZ, -178);
});

test("ラケットの持ち手はスイング種別で逆向きに傾く", () => {
  const base = Math.PI / 2;

  assert.equal(paddleHandleAngle(0, 1), base);
  assert.equal(paddleHandleAngle(0, -1), base);
  assert.ok(paddleHandleAngle(1, 1) > base);
  assert.ok(paddleHandleAngle(1, -1) < base);
  assert.ok(paddleHandleAngle(1, 0) > base);
  assert.ok(paddleHandleAngle(1, 0) < paddleHandleAngle(1, 1));
});

test("swingTypeOfは全ショット種別を描画用スイングへ対応付ける", () => {
  assert.equal(swingTypeOf("DRIVE"), 1);
  assert.equal(swingTypeOf("SMASH"), 1);
  assert.equal(swingTypeOf("CHOP"), -1);
  assert.equal(swingTypeOf("PUSH"), 0);
  assert.equal(swingTypeOf("LOB"), 0);
  assert.equal(swingTypeOf("STOP"), -1);
  assert.equal(swingTypeOf("FLICK"), 1);
});

test("ドライブとスマッシュは振り上げ、ツッツキは振り下ろしになる", () => {
  const base = Math.PI / 2;
  const drive = paddleHandleAngle(1, swingTypeOf("DRIVE"));
  const push = paddleHandleAngle(1, swingTypeOf("PUSH"));

  assert.ok(drive > base);
  assert.ok(paddleHandleAngle(1, swingTypeOf("SMASH")) > base);
  assert.ok(paddleHandleAngle(1, swingTypeOf("CHOP")) < base);
  assert.ok(push > base);
  assert.ok(push < drive);
});

test("ラケットは持ち手を含めて画面下端に収まる", () => {
  const radius = 18;
  const extent = paddleBottomExtent(radius);

  // 320x240（横向き・最小ビューポート）は制限が必要になる
  assert.ok(240 * 0.86 + extent > 240);
  assert.equal(
    clampPaddleScreenY(240 * 0.86, 240, radius),
    240 - extent,
  );
  // ツッツキで下がった位置も同じ上限に収まる
  assert.equal(
    clampPaddleScreenY(240 * 0.86 + 240 * 0.045, 240, radius),
    240 - extent,
  );
  // 影の下端も画面内に収まる
  assert.ok(240 * 0.955 + radius * 0.28 <= 240);
  // 320x568（縦向き）では制限が働かない
  assert.equal(
    clampPaddleScreenY(568 * 0.86, 568, radius),
    568 * 0.86,
  );
});

test("isShortBallは受け手側の低い短球だけを判定する", () => {
  assert.equal(isShortBall(null, 10, "P"), false);
  assert.equal(isShortBall(-58, 22, "P"), true);
  assert.equal(isShortBall(-59, 22, "P"), false);
  assert.equal(isShortBall(-40, 22.01, "P"), false);
  assert.equal(isShortBall(40, 10, "P"), false);
  assert.equal(isShortBall(40, 10, "A"), true);
  assert.equal(isShortBall(-40, 10, "A"), false);
  assert.equal(isShortBall(0, 10, "P"), false);
  assert.equal(isShortBall(0, 10, "A"), false);
});

test("classifyPlayerShotは短球のフリック方向で台上技術を選ぶ", () => {
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: 4, sp: 4, t: 0 },
      ballY: 10,
      short: true,
    }),
    "STOP",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: -4, sp: 4, t: 0 },
      ballY: 10,
      short: true,
    }),
    "FLICK",
  );
  assert.equal(
    classifyPlayerShot({ flick: null, ballY: 10, short: true }),
    "PUSH",
  );
});

test("classifyPlayerShotは長球でv0.5.0の分類を保つ", () => {
  assert.equal(
    classifyPlayerShot({ flick: null, ballY: 10, short: false }),
    "PUSH",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: -4, sp: 4, t: 0 },
      ballY: -9,
      short: false,
    }),
    "LOB",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: -4, sp: 4, t: 0 },
      ballY: 27,
      short: false,
    }),
    "SMASH",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: -2, sp: 2, t: 0 },
      ballY: 10,
      short: false,
    }),
    "DRIVE",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 0, vy: 4, sp: 4, t: 0 },
      ballY: 10,
      short: false,
    }),
    "CHOP",
  );
  assert.equal(
    classifyPlayerShot({
      flick: { vx: 4, vy: 0, sp: 4, t: 0 },
      ballY: 10,
      short: false,
    }),
    "PUSH",
  );
});

test("U33: 非対象5技（DRIVE/SMASH/PUSH/CHOP/LOB）のsolveShot出力はビット単位で不変", () => {
  // 前提コミット `9e6e70c`（v0.6.0公開・ShotSpeed移行前）から採取した基準ベクトル。
  // `ShotSpeed` 判別共用体の導入でこの5技の出力が1bitでも変わったら fail する（設計書§4.2・§5.1 U33）。
  type NonTargetShot = "DRIVE" | "SMASH" | "PUSH" | "CHOP" | "LOB";
  type PointKey = "A" | "B" | "C" | "D";
  type RandomSetKey = "all0" | "all1" | "mixed";

  const points: Record<PointKey, { y: number; absZ: number }> = {
    A: { y: 14, absZ: 60 },
    B: { y: -46, absZ: 30 },
    C: { y: 35, absZ: 60 },
    D: { y: 60, absZ: 60 },
  };

  const randomSets: Record<RandomSetKey, readonly number[]> = {
    all0: [0, 0, 0, 0, 0],
    all1: [1, 1, 1, 1, 1],
    mixed: [0.1, 0.9, 0.3, 0.7, 0.5],
  };

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

  const reference: readonly {
    type: NonTargetShot;
    point: PointKey;
    dir: 1 | -1;
    randomSet: RandomSetKey;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
    side: number;
  }[] = [
    { type: "DRIVE", point: "A", dir: 1, randomSet: "all0", vx: 109.95507871703117, vy: 78.85137767235761, vz: 761.7890783199131, spin: 0.95, side: -0.125 },
    { type: "DRIVE", point: "A", dir: 1, randomSet: "all1", vx: 222.27725255192817, vy: 112.44802813636487, vz: 960.7932231058926, spin: 0.95, side: 0.125 },
    { type: "DRIVE", point: "A", dir: 1, randomSet: "mixed", vx: 187.030934232799, vy: 91.1670597047002, vz: 912.5809535952446, spin: 0.95, side: -0.1 },
    { type: "DRIVE", point: "B", dir: 1, randomSet: "all0", vx: 82.26926399950447, vy: 631.0079122135218, vz: 440.1034445092565, spin: 0.95, side: -0.125 },
    { type: "DRIVE", point: "B", dir: 1, randomSet: "all1", vx: 140.26540071812238, vy: 840.3702731390254, vz: 509.1942409195378, spin: 0.95, side: 0.125 },
    { type: "DRIVE", point: "B", dir: 1, randomSet: "mixed", vx: 127.52996100747086, vy: 772.3547547195676, vz: 513.127900145285, spin: 0.95, side: -0.1 },
    { type: "DRIVE", point: "A", dir: -1, randomSet: "all0", vx: 173.46061739445238, vy: 79.79087376688575, vz: -749.7833617923595, spin: 0.95, side: -0.125 },
    { type: "DRIVE", point: "A", dir: -1, randomSet: "all1", vx: 140.88176618052637, vy: 112.44802813636487, vz: -976.0548768005305, spin: 0.95, side: 0.125 },
    { type: "DRIVE", point: "A", dir: -1, randomSet: "mixed", vx: 156.26841807412134, vy: 91.1670597047002, vz: -918.3489253749967, spin: 0.95, side: -0.1 },
    { type: "DRIVE", point: "B", dir: -1, randomSet: "all0", vx: 118.904418156187, vy: 631.0079122135218, vz: -431.6491781654067, spin: 0.95, side: -0.125 },
    { type: "DRIVE", point: "B", dir: -1, randomSet: "all1", vx: 97.04880155519321, vy: 840.3702731390254, vz: -519.1673022648291, spin: 0.95, side: 0.125 },
    { type: "DRIVE", point: "B", dir: -1, randomSet: "mixed", vx: 110.22012612436467, vy: 772.3547547195676, vz: -517.1224774260019, spin: 0.95, side: -0.1 },
    { type: "SMASH", point: "A", dir: 1, randomSet: "all0", vx: 159.5853566556854, vy: 36.06296969299933, vz: 1114.6149674959681, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "A", dir: 1, randomSet: "all1", vx: 283.3820128091624, vy: 98.20589422550074, vz: 1321.7041165692867, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "A", dir: 1, randomSet: "mixed", vx: 244.4484262693086, vy: 80.56008204415207, vz: 1267.5733011055013, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "B", dir: 1, randomSet: "all0", vx: 115.60746655119819, vy: 922.0233395981587, vz: 636.9006394422213, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "B", dir: 1, randomSet: "all1", vx: 178.82702285927942, vy: 1143.8751178240718, vz: 704.5723137612307, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "B", dir: 1, randomSet: "mixed", vx: 164.5676188720975, vy: 1068.7610229040881, vz: 709.6861336814857, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "C", dir: 1, randomSet: "all0", vx: 170.83652746967562, vy: -176.74615990778727, vz: 1193.198138621027, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "C", dir: 1, randomSet: "all1", vx: 305.3163870017931, vy: -164.4074358914748, vz: 1424.006843469227, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "C", dir: 1, randomSet: "mixed", vx: 262.1182101090411, vy: -200.72341790180045, vz: 1359.1989522638146, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "D", dir: 1, randomSet: "all0", vx: 177.79630778106406, vy: -377.19328971024936, vz: 1241.8083336171412, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "D", dir: 1, randomSet: "all1", vx: 319.52611720291617, vy: -400.6722438736448, vz: 1490.2815470609862, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "D", dir: 1, randomSet: "mixed", vx: 273.0125818539311, vy: -428.13416239647137, vz: 1415.6910924133563, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "A", dir: -1, randomSet: "all0", vx: 236.05303485439555, vy: 36.06296969299933, vz: -1100.9600249604841, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "A", dir: -1, randomSet: "all1", vx: 191.58245354418585, vy: 98.20589422550074, vz: -1338.0968950094612, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "A", dir: -1, randomSet: "mixed", vx: 209.37474508174975, vy: 80.56008204415207, vz: -1273.8364584604226, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "B", dir: -1, randomSet: "all0", vx: 159.2436533030813, vy: 922.0233395981587, vz: -627.4145118874641, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "B", dir: -1, randomSet: "all1", vx: 129.8245715595781, vy: 1143.8751178240718, vz: -715.2250205655135, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "B", dir: -1, randomSet: "mixed", vx: 144.9200917602972, vy: 1068.7610229040881, vz: -713.9573352275291, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "C", dir: -1, randomSet: "all0", vx: 252.6953701661359, vy: -176.74615990778727, vz: -1178.5804881395163, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "C", dir: -1, randomSet: "all1", vx: 206.39708487636082, vy: -165.29630292008721, vz: -1441.5688561393524, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "C", dir: -1, randomSet: "mixed", vx: 224.52908064594294, vy: -199.87850589484404, vz: -1366.0354729016124, spin: 0.42, side: -0.1 },
    { type: "SMASH", point: "D", dir: -1, randomSet: "all0", vx: 263.0382468106333, vy: -376.4275506847279, vz: -1226.8200447108306, spin: 0.42, side: -0.125 },
    { type: "SMASH", point: "D", dir: -1, randomSet: "all1", vx: 216.01793599513363, vy: -400.6722438736448, vz: -1508.7651508480903, spin: 0.42, side: 0.125 },
    { type: "SMASH", point: "D", dir: -1, randomSet: "mixed", vx: 233.8828282914898, vy: -427.254092660015, vz: -1422.9436963336395, spin: 0.42, side: -0.1 },
    { type: "PUSH", point: "A", dir: 1, randomSet: "all0", vx: 63.16941205686538, vy: 120.59055924061018, vz: 388.9779466067799, spin: -0.2, side: -0.125 },
    { type: "PUSH", point: "A", dir: 1, randomSet: "all1", vx: 123.01026812544606, vy: 110.31684289112093, vz: 504.86543431516645, spin: -0.2, side: 0.125 },
    { type: "PUSH", point: "A", dir: 1, randomSet: "mixed", vx: 105.61853789997946, vy: 90.83387861537462, vz: 482.284077020544, spin: -0.2, side: -0.1 },
    { type: "PUSH", point: "B", dir: 1, randomSet: "all0", vx: 49.56427745361456, vy: 336.57800259238195, vz: 232.5831703185415, spin: -0.2, side: -0.125 },
    { type: "PUSH", point: "B", dir: 1, randomSet: "all1", vx: 80.53347313349651, vy: 449.1981424758181, vz: 271.8930435986383, spin: -0.2, side: 0.125 },
    { type: "PUSH", point: "B", dir: 1, randomSet: "mixed", vx: 74.06467123211563, vy: 414.459726554632, vz: 273.38902600422404, spin: -0.2, side: -0.1 },
    { type: "PUSH", point: "A", dir: -1, randomSet: "all0", vx: 93.1993203225891, vy: 121.79261385213297, vz: -382.5137205989776, spin: -0.2, side: -0.125 },
    { type: "PUSH", point: "A", dir: -1, randomSet: "all1", vx: 83.31819974066319, vy: 109.68244067085956, vz: -513.0480274364754, spin: -0.2, side: 0.125 },
    { type: "PUSH", point: "A", dir: -1, randomSet: "mixed", vx: 90.50191587460573, vy: 91.43648863195061, vz: -485.23475944091734, spin: -0.2, side: -0.1 },
    { type: "PUSH", point: "B", dir: -1, randomSet: "all0", vx: 67.53667676061778, vy: 336.57800259238195, vz: -228.01391625743898, spin: -0.2, side: -0.125 },
    { type: "PUSH", point: "B", dir: -1, randomSet: "all1", vx: 59.10245511249996, vy: 449.1981424758181, vz: -277.3416075022815, spin: -0.2, side: 0.125 },
    { type: "PUSH", point: "B", dir: -1, randomSet: "mixed", vx: 65.50027158545814, vy: 414.459726554632, vz: -275.56641574489964, spin: -0.2, side: -0.1 },
    { type: "CHOP", point: "A", dir: 1, randomSet: "all0", vx: 53.725609609622694, vy: 97.9498722808468, vz: 360.38547391403034, spin: -0.92, side: -0.125 },
    { type: "CHOP", point: "A", dir: 1, randomSet: "all1", vx: 111.31337336465539, vy: 82.04014929142649, vz: 471.1844033395219, spin: -0.92, side: 0.125 },
    { type: "CHOP", point: "A", dir: 1, randomSet: "mixed", vx: 94.05911993956033, vy: 63.53613522688555, vz: 448.355095294596, spin: -0.92, side: -0.1 },
    { type: "CHOP", point: "B", dir: 1, randomSet: "all0", vx: 41.60836398113952, vy: 307.71373496832234, vz: 214.33457438000548, spin: -0.92, side: -0.125 },
    { type: "CHOP", point: "B", dir: 1, randomSet: "all1", vx: 71.14217066015564, vy: 415.76213513193886, vz: 251.42918223685302, spin: -0.92, side: 0.125 },
    { type: "CHOP", point: "B", dir: 1, randomSet: "mixed", vx: 64.77479924438525, vy: 381.6389680104701, vz: 253.1050641112362, spin: -0.92, side: -0.1 },
    { type: "CHOP", point: "A", dir: -1, randomSet: "all0", vx: 83.70385371056965, vy: 99.06137771442548, vz: -354.3145731342694, spin: -0.92, side: -0.125 },
    { type: "CHOP", point: "A", dir: -1, randomSet: "all1", vx: 71.40264313065941, vy: 81.44907961776308, vz: -478.9610684798661, spin: -0.92, side: 0.125 },
    { type: "CHOP", point: "A", dir: -1, randomSet: "mixed", vx: 78.92395349977835, vy: 64.37486197810242, vz: -451.1464692417143, spin: -0.92, side: -0.1 },
    { type: "CHOP", point: "B", dir: -1, randomSet: "all0", vx: 59.44459485761177, vy: 307.71373496832234, vz: -210.08785274275016, spin: -0.92, side: -0.125 },
    { type: "CHOP", point: "B", dir: -1, randomSet: "all1", vx: 49.79610574058884, vy: 415.76213513193886, vz: -256.5115786462737, spin: -0.92, side: 0.125 },
    { type: "CHOP", point: "B", dir: -1, randomSet: "mixed", vx: 56.23550853582689, vy: 381.6389680104701, vz: -255.13822856565486, spin: -0.92, side: -0.1 },
    { type: "LOB", point: "A", dir: 1, randomSet: "all0", vx: 25.49301439321295, vy: 360.26668025282913, vz: 240.81137561454895, spin: 0.35, side: -0.125 },
    { type: "LOB", point: "A", dir: 1, randomSet: "all1", vx: 55.01646611383937, vy: 434.4754830508521, vz: 236.59919081812953, spin: 0.35, side: 0.125 },
    { type: "LOB", point: "A", dir: 1, randomSet: "mixed", vx: 33.494438659183785, vy: 414.20932008126454, vz: 233.67135085276195, spin: 0.35, side: -0.1 },
    { type: "LOB", point: "B", dir: 1, randomSet: "all0", vx: 93.5294988039388, vy: 1007.9458386084027, vz: 671.014327910148, spin: 0.35, side: -0.125 },
    { type: "LOB", point: "B", dir: 1, randomSet: "all1", vx: 174.73123138075178, vy: 1208.8947933686852, vz: 652.9060506227938, spin: 0.35, side: 0.125 },
    { type: "LOB", point: "B", dir: 1, randomSet: "mixed", vx: 115.24394488717296, vy: 1158.8653166474667, vz: 650.3099013902553, spin: 0.35, side: -0.1 },
    { type: "LOB", point: "A", dir: -1, randomSet: "all0", vx: 55.14822490312505, vy: 362.2546457480887, vz: -237.16582159488024, spin: 0.35, side: -0.125 },
    { type: "LOB", point: "A", dir: -1, randomSet: "all1", vx: 25.432107107119986, vy: 432.09118714470117, vz: -240.23603496935277, spin: 0.35, side: 0.125 },
    { type: "LOB", point: "A", dir: -1, randomSet: "mixed", vx: 45.14431124632135, vy: 416.03781853814905, vz: -232.76433526958476, spin: 0.35, side: -0.1 },
    { type: "LOB", point: "B", dir: -1, randomSet: "all0", vx: 175.14969474496527, vy: 1007.9458386084027, vz: -654.4696935977777, spin: 0.35, side: -0.125 },
    { type: "LOB", point: "B", dir: -1, randomSet: "all1", vx: 93.30604041436149, vy: 1208.8947933686852, vz: -669.4111568997648, spin: 0.35, side: 0.125 },
    { type: "LOB", point: "B", dir: -1, randomSet: "mixed", vx: 147.08683151794813, vy: 1158.8653166474667, vz: -643.8552622083414, spin: 0.35, side: -0.1 },
  ];

  assert.equal(reference.length, 72);

  for (const item of reference) {
    const point = points[item.point];
    const from = { x: 0, y: point.y, z: -item.dir * point.absZ };
    const sequence = scriptedRandom(randomSets[item.randomSet]);
    const solution = solveShot({
      from,
      type: item.type,
      direction: item.dir,
      aimX: 30,
      depth: SHOTS[item.type].dep,
      contactQuality: 0.8,
      extraError: 0,
      ballY: point.y,
      random: sequence.random,
    });
    const label = `${item.type} ${item.point} dir=${item.dir} ${item.randomSet}`;
    assert.equal(solution.vx, item.vx, `${label} vx`);
    assert.equal(solution.vy, item.vy, `${label} vy`);
    assert.equal(solution.vz, item.vz, `${label} vz`);
    assert.equal(solution.spin, item.spin, `${label} spin`);
    assert.equal(solution.side, item.side, `${label} side`);
    assert.equal(
      sequence.consumed(),
      item.type === "LOB" ? 4 : 5,
      `${label} 乱数消費`,
    );
  }
});

test("solveShotはSTOPとFLICKをネット越しの着地点帯へ解く", () => {
  const from = { x: 0, y: 16, z: -38 };
  const cases = [
    { type: "STOP" as const, minZ: 24, maxZ: 45 },
    { type: "FLICK" as const, minZ: 60, maxZ: 100 },
  ];

  for (const { type, minZ, maxZ } of cases) {
    for (const speedRoll of [0, 1]) {
      const randomValues = [0.5, speedRoll, 0.5, 0.5, 0.5];
      let randomIndex = 0;
      const solution = solveShot({
        from,
        type,
        direction: 1,
        aimX: 0,
        depth: SHOTS[type].dep,
        contactQuality: 0.8,
        extraError: 0,
        ballY: from.y,
        random: () => randomValues[randomIndex++] ?? 0.5,
      });
      assert.equal(randomIndex, 5);
      const landing = simLand({ ...from, ...solution });
      assert.equal(landing.net, false, `${type} speedRoll=${speedRoll}`);
      assert.ok(landing.z > 0, `${type} は相手コートに入る`);
      assert.ok(
        Math.abs(landing.z) >= minZ &&
          Math.abs(landing.z) <= maxZ,
        `${type} z=${landing.z}`,
      );
    }
  }

  const aiFrom = { x: 0, y: 14.98, z: 75.87 };
  for (const aimRoll of [0, 1]) {
    for (const depthScale of [0.9, 1.1]) {
      for (const sideRoll of [0, 1]) {
        for (const speedRoll of [0, 1]) {
          for (const contactQuality of [1, 0.25]) {
            for (const elevationRoll of [0, 1]) {
              for (const azimuthRoll of [0, 1]) {
                for (const speedErrorRoll of [0, 1]) {
                  const randomValues = [
                    sideRoll,
                    speedRoll,
                    elevationRoll,
                    azimuthRoll,
                    speedErrorRoll,
                  ];
                  let randomIndex = 0;
                  const solution = solveShot({
                    from: aiFrom,
                    type: "STOP",
                    direction: -1,
                    aimX:
                      -HW *
                      0.72 *
                      (0.6 + 0.4 * aimRoll),
                    depth: SHOTS.STOP.dep * depthScale,
                    contactQuality,
                    extraError: 0,
                    ballY: aiFrom.y,
                    random: () =>
                      randomValues[randomIndex++] ?? 0.5,
                  });
                  assert.equal(randomIndex, 5);
                  const landing = simLand({
                    ...aiFrom,
                    ...solution,
                  });
                  assert.equal(
                    landing.net,
                    false,
                    `AI STOP aim=${aimRoll} depth=${depthScale} quality=${contactQuality}`,
                  );
                  assert.ok(
                    landing.z < 0,
                    `AI STOP は相手コートに入る z=${landing.z}`,
                  );
                  assert.ok(
                    Math.abs(landing.z) >= 18 &&
                      Math.abs(landing.z) <= 46,
                    `AI STOP z=${landing.z}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  const blunderRandom = [0, 0, 0, 0, 0];
  let blunderRandomIndex = 0;
  const blunderSolution = solveShot({
    from: aiFrom,
    type: "STOP",
    direction: -1,
    aimX: -HW * 0.72 * 0.6,
    depth: SHOTS.STOP.dep * 0.9,
    contactQuality: 0.25,
    extraError: 0.075,
    ballY: aiFrom.y,
    random: () =>
      blunderRandom[blunderRandomIndex++] ?? 0.5,
  });
  assert.equal(blunderRandomIndex, 5);
  const blunderLanding = simLand({
    ...aiFrom,
    ...blunderSolution,
  });
  assert.ok(
    blunderLanding.z > 0,
    "明示的なblunderは最終STOP帯保証の対象外",
  );
});

test("バウンド有無で失点者と理由が決まる", () => {
  assert.deepEqual(resolveMiss(1, "P"), {
    winner: "P",
    reason: "返せず",
  });
  assert.deepEqual(resolveMiss(0, "P"), {
    winner: "A",
    reason: "アウト",
  });
  assert.deepEqual(resolveMiss(0, "A"), {
    winner: "P",
    reason: "アウト",
  });
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
