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
  resolveMiss,
  rotateServerAfterPoint,
  swingTypeOf,
} from "../src/rules.ts";
import type { BallVector, ServeType } from "../src/types.ts";
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
  assert.equal(paddleDepthRatio(-62), 0);
  assert.equal(paddleDepthRatio(-178), 1);
  assert.equal(paddleDepthRatio(PZ), (152 - 62) / (178 - 62));
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
