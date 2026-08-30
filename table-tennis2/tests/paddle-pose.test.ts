import assert from "node:assert/strict";
import test from "node:test";

import { PaddleController, shortestAngleDelta } from "../src/control/paddle.ts";
import { ZERO_STROKE_METRICS } from "../src/control/stroke.ts";
import { PADDLE_BLADE_SCALE, PZ } from "../src/config.ts";
import { paddleDepthRatio, paddleScreenRadius } from "../src/utils.ts";
import { createProjectionCamera, projectWorldPoint, unprojectScreenXAtZ } from "../src/view/projection.ts";

test("投影と指定深度でのX逆投影は往復する", () => {
  const camera = createProjectionCamera(900, 412);
  const projected = projectWorldPoint(camera, 42, 18, PZ);
  assert.ok(Math.abs(unprojectScreenXAtZ(camera, projected.x, PZ) - 42) < 1e-9);
});

test("direct paddleはpointerのX/Yへ追従して画面内に収まる", () => {
  const controller = new PaddleController();
  const pose = controller.applyInput(
    {
      sample: {
        clientX: 890,
        clientY: 405,
        stageX: 0.99,
        stageY: 0.98,
        time: 1,
        pointerType: "touch",
      },
      metrics: { ...ZERO_STROKE_METRICS, vx: 2, vy: -1, speed: Math.sqrt(5) },
      history: [],
      width: 900,
      height: 412,
      time: 1,
    },
    PZ,
    PZ,
  );
  assert.ok(pose.screenX < 900);
  assert.ok(pose.screenY > 0 && pose.screenY < 412);
  assert.ok(pose.worldX <= 104);
  assert.equal(pose.phase, "tracking");
});

test("release後はfollow期限を過ぎて待機位置へ回復する", () => {
  const controller = new PaddleController();
  controller.advanceFrame(1, 1 / 120, 900, 412, PZ, PZ);
  controller.release(1);
  const pose = controller.advanceFrame(1.3, 0.3, 900, 412, PZ, PZ);
  assert.equal(pose?.phase, "idle");
  assert.equal(pose?.pointerDown, false);
});

test("33ms event間隔でもinteraction centerは16ms上限まで予測する", () => {
  const controller = new PaddleController();
  const base = controller.applyInput(
    {
      sample: {
        clientX: 450,
        clientY: 240,
        stageX: 0.5,
        stageY: 240 / 412,
        time: 1,
        pointerType: "mouse",
      },
      metrics: { ...ZERO_STROKE_METRICS, vx: 1, speed: 1, directionX: 1 },
      history: [
        {
          clientX: 438,
          clientY: 240,
          stageX: 438 / 900,
          stageY: 240 / 412,
          time: 0.99,
          pointerType: "mouse",
        },
        {
          clientX: 450,
          clientY: 240,
          stageX: 0.5,
          stageY: 240 / 412,
          time: 1,
          pointerType: "mouse",
        },
      ],
      width: 900,
      height: 412,
      time: 1,
    },
    PZ,
    PZ,
  );
  const pose = controller.advanceFrame(1.033, 1 / 60, 900, 412, PZ, PZ);
  assert.ok((pose?.screenX ?? base.screenX) > base.screenX);
});

test("render centerは最新interaction centerと一致する", () => {
  const controller = new PaddleController();
  const update = (stageX: number, time: number) => controller.applyInput(
    {
      sample: {
        clientX: stageX * 900,
        clientY: 240,
        stageX,
        stageY: 240 / 412,
        time,
        pointerType: "mouse",
      },
      metrics: { ...ZERO_STROKE_METRICS, vx: 1, speed: 1, directionX: 1 },
      history: [],
      width: 900,
      height: 412,
      time,
    },
    PZ,
    PZ,
  );
  update(0.4, 1);
  const interaction = update(0.6, 1.033);
  const rendered = controller.getRenderPose();
  assert.equal(rendered?.screenX, interaction.screenX);
  assert.equal(rendered?.screenY, interaction.screenY);
});

test("touch release graceはwall clockで350ms境界までcontact可能", () => {
  const controller = new PaddleController();
  controller.applyInput({
    sample: { clientX: 450, clientY: 240, stageX: 0.5, stageY: 240 / 412, time: 10, pointerType: "touch" },
    metrics: ZERO_STROKE_METRICS,
    history: [],
    width: 900,
    height: 412,
    time: 10,
  }, PZ, PZ);
  controller.release(10);
  assert.equal(controller.isContactEligible(10.35), true);
  assert.equal(controller.isContactEligible(10.351), false);
});

test("predictionは0/8/16/17/33ms境界で16msへ飽和する", () => {
  const positionAt = (age: number): number => {
    const controller = new PaddleController();
    const history = [
      { clientX: 438, clientY: 240, stageX: 438 / 900, stageY: 240 / 412, time: 0.99, pointerType: "mouse" as const },
      { clientX: 450, clientY: 240, stageX: 0.5, stageY: 240 / 412, time: 1, pointerType: "mouse" as const },
    ];
    controller.applyInput(
      {
        sample: history[1]!,
        metrics: { ...ZERO_STROKE_METRICS, vx: 1, speed: 1, directionX: 1 },
        history,
        width: 900,
        height: 412,
        time: 1,
      },
      PZ,
      PZ,
    );
    return controller.advanceFrame(1 + age, 1 / 60, 900, 412, PZ, PZ)!.screenX;
  };
  const values = [0, 0.008, 0.016, 0.017, 0.033].map(positionAt);
  assert.ok(values[0]! < values[1]! && values[1]! < values[2]!);
  assert.equal(values[2], values[3]);
  assert.equal(values[3], values[4]);
});

test("prediction距離はCanvas高5%を越えず非有限metricsはbaseへfallbackする", () => {
  const controller = new PaddleController();
  const history = [
    { clientX: 430, clientY: 230, stageX: 430 / 900, stageY: 230 / 400, time: 0.99, pointerType: "mouse" as const },
    { clientX: 450, clientY: 250, stageX: 0.5, stageY: 250 / 400, time: 1, pointerType: "mouse" as const },
  ];
  const base = controller.applyInput(
    {
      sample: history[1]!,
      metrics: { ...ZERO_STROKE_METRICS, vx: 100, speed: 100, directionX: 1 },
      history,
      width: 900,
      height: 400,
      time: 1,
    },
    PZ,
    PZ,
  );
  const predicted = controller.advanceFrame(1.016, 1 / 60, 900, 400, PZ, PZ)!;
  assert.ok(Math.hypot(
    predicted.screenX - base.screenX,
    predicted.screenY - base.screenY,
  ) <= 20 + 1e-9);

  const fallback = new PaddleController();
  const fallbackBase = fallback.applyInput(
    {
      sample: history[1]!,
      metrics: { ...ZERO_STROKE_METRICS, vx: Number.NaN, speed: Number.NaN },
      history,
      width: 900,
      height: 400,
      time: 1,
    },
    PZ,
    PZ,
  );
  assert.equal(
    fallback.advanceFrame(1.016, 1 / 60, 900, 400, PZ, PZ)!.screenX,
    fallbackBase.screenX,
  );
});

test("上方向predictionはbase 0.35を越えても描画境界内に収まる", () => {
  const width = 568;
  const height = 320;
  const controller = new PaddleController();
  const history = [
    { clientX: 284, clientY: 152, stageX: 0.5, stageY: 152 / height, time: 0.99, pointerType: "touch" as const },
    { clientX: 284, clientY: 112, stageX: 0.5, stageY: 0.35, time: 1, pointerType: "touch" as const },
  ];
  controller.applyInput({
    sample: history[1]!,
    metrics: { ...ZERO_STROKE_METRICS, vy: -100, speed: 100, directionY: -1 },
    history,
    width,
    height,
    time: 1,
  }, PZ, PZ);
  const pose = controller.advanceFrame(1.016, 0.016, width, height, PZ, PZ)!;
  const radius = paddleScreenRadius(width, height, paddleDepthRatio(PZ));
  assert.ok(pose.screenY < height * 0.35);
  assert.ok(pose.screenY - radius * PADDLE_BLADE_SCALE >= 0);
  assert.ok(Object.values(pose).every((value) =>
    typeof value !== "number" || Number.isFinite(value)
  ));
});

test("touchは6%、mouse/penは1%上方offsetを使う", () => {
  const yFor = (pointerType: "touch" | "mouse" | "pen"): number => {
    const controller = new PaddleController();
    return controller.applyInput(
      {
        sample: { clientX: 450, clientY: 256, stageX: 0.5, stageY: 0.8, time: 1, pointerType },
        metrics: ZERO_STROKE_METRICS,
        history: [],
        width: 900,
        height: 320,
        time: 1,
      },
      PZ,
      PZ,
    ).screenY;
  };
  assert.ok(Math.abs(yFor("touch") - 236.8) < 1e-9);
  assert.ok(Math.abs(yFor("mouse") - 252.8) < 1e-9);
  assert.equal(yFor("pen"), yFor("mouse"));
});

test("follow期間中の新しいgestureはpointerTypeを更新する", () => {
  const controller = new PaddleController();
  const update = (pointerType: "touch" | "mouse", time: number) => controller.applyInput(
    {
      sample: {
        clientX: 450,
        clientY: 256,
        stageX: 0.5,
        stageY: 0.8,
        time,
        pointerType,
      },
      metrics: ZERO_STROKE_METRICS,
      history: [],
      width: 900,
      height: 320,
      time,
    },
    PZ,
    PZ,
  );

  update("touch", 1);
  controller.release(1.01);
  const nextGesture = update("mouse", 1.05);

  assert.equal(nextGesture.pointerType, "mouse");
  assert.equal(controller.getAssistScale(), 1.2);
});

test("passive trackingはneutral姿勢を保ちactive strikeだけが姿勢を変える", () => {
  const passive = new PaddleController();
  passive.applyInput({
    sample: { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 1.05, pointerType: "mouse" },
    metrics: { ...ZERO_STROKE_METRICS, vx: 0.8, speed: 0.8, directionX: 1 },
    history: [
      { clientX: 434, clientY: 220, stageX: 434 / 900, stageY: 220 / 412, time: 1, pointerType: "mouse" },
      { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 1.05, pointerType: "mouse" },
    ],
    width: 900,
    height: 412,
    time: 1.05,
  }, PZ, PZ);
  const passivePose = passive.advanceFrame(1.05, 0.1, 900, 412, PZ, PZ)!;
  assert.equal(passivePose.phase, "tracking");
  assert.ok(Math.abs(passivePose.angle - Math.PI / 2) < 1e-9);
  assert.equal(passivePose.tilt, 0);

  const active = new PaddleController();
  const history = [
    { clientX: 450, clientY: 280, stageX: 0.5, stageY: 280 / 412, time: 1, pointerType: "touch" as const },
    { clientX: 450, clientY: 190, stageX: 0.5, stageY: 190 / 412, time: 1.05, pointerType: "touch" as const },
  ];
  active.applyInput({
    sample: history[1]!,
    metrics: { ...ZERO_STROKE_METRICS, vy: -4, speed: 4, directionY: -1 },
    history,
    width: 900,
    height: 412,
    time: 1.05,
  }, PZ, PZ);
  const activePose = active.advanceFrame(1.05, 0.1, 900, 412, PZ, PZ)!;
  assert.equal(activePose.phase, "armed");
  assert.ok(activePose.angle < 0.02);
  assert.ok(activePose.tilt < -0.99);
});

test("角度補間は±π境界の最短差を返す", () => {
  const epsilon = 0.001;
  assert.ok(Math.abs(shortestAngleDelta(Math.PI - epsilon, -Math.PI + epsilon)) <= 2 * epsilon + 1e-12);
  assert.ok(Math.abs(shortestAngleDelta(-Math.PI + epsilon, Math.PI - epsilon)) <= 2 * epsilon + 1e-12);
});

test("mouseとpenのrelease graceは220/221ms境界で失効する", () => {
  for (const pointerType of ["mouse", "pen"] as const) {
    const controller = new PaddleController();
    controller.applyInput({
      sample: { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 2, pointerType },
      metrics: ZERO_STROKE_METRICS,
      history: [],
      width: 900,
      height: 412,
      time: 2,
    }, PZ, PZ);
    controller.release(2);
    assert.equal(controller.isContactEligible(2.22), true);
    assert.equal(controller.isContactEligible(2.221), false);
  }
});

test("release snapshotは160msまでactiveで161msにはpassiveだがtouch contactは継続する", () => {
  const controller = new PaddleController();
  const history = [
    { clientX: 450, clientY: 280, stageX: 0.5, stageY: 280 / 412, time: 1, pointerType: "touch" as const },
    { clientX: 450, clientY: 190, stageX: 0.5, stageY: 190 / 412, time: 1.05, pointerType: "touch" as const },
  ];
  controller.applyInput({
    sample: history[1]!,
    metrics: { ...ZERO_STROKE_METRICS, vy: -4, speed: 4, directionY: -1 },
    history,
    width: 900,
    height: 412,
    time: 1.05,
  }, PZ, PZ);
  controller.release(1.05);
  assert.equal(controller.getStrikeMetrics(1.21).active, true);
  const activePose = controller.advanceFrame(1.21, 0.1, 900, 412, PZ, PZ)!;
  assert.ok(activePose.angle < 0.02);
  assert.equal(controller.getStrikeMetrics(1.211).active, false);
  assert.equal(controller.isContactEligible(1.211), true);
  const passivePose = controller.advanceFrame(1.211, 0.01, 900, 412, PZ, PZ)!;
  assert.ok(passivePose.angle > activePose.angle);
  assert.ok(passivePose.tilt > activePose.tilt);
});

test("release後contactはgraceを消費しpointer down contactは次frameもeligible", () => {
  const released = new PaddleController();
  released.applyInput({
    sample: { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 1, pointerType: "touch" },
    metrics: ZERO_STROKE_METRICS,
    history: [],
    width: 900,
    height: 412,
    time: 1,
  }, PZ, PZ);
  released.release(1);
  released.beginContact(1.1);
  assert.equal(released.isContactEligible(1.1), false);
  released.advanceFrame(1.101, 0.001, 900, 412, PZ, PZ);
  assert.equal(released.isContactEligible(1.101), false);

  const held = new PaddleController();
  held.applyInput({
    sample: { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 1, pointerType: "touch" },
    metrics: ZERO_STROKE_METRICS,
    history: [],
    width: 900,
    height: 412,
    time: 1,
  }, PZ, PZ);
  held.beginContact(1.1);
  held.advanceFrame(1.101, 0.001, 900, 412, PZ, PZ);
  assert.equal(held.isContactEligible(1.101), true);
});

test("pointerType不明releaseとresetはcontact grace・snapshot・assistを残さない", () => {
  const empty = new PaddleController();
  empty.advanceFrame(1, 1 / 60, 900, 412, PZ, PZ);
  empty.release(1);
  assert.equal(empty.isContactEligible(1), false);
  assert.equal(empty.isContactEligible(1.001), false);

  const controller = new PaddleController();
  controller.applyInput({
    sample: { clientX: 450, clientY: 220, stageX: 0.5, stageY: 220 / 412, time: 1, pointerType: "touch" },
    metrics: ZERO_STROKE_METRICS,
    history: [],
    width: 900,
    height: 412,
    time: 1,
  }, PZ, PZ);
  controller.release(1);
  controller.reset();
  assert.equal(controller.isContactEligible(1), false);
  assert.equal(controller.getStrikeMetrics(1).active, false);
  assert.equal(controller.getAssistScale(), null);
  assert.equal(controller.getDebugState(1).contactGraceMs, 0);
});

test("20分相当fixed-step進行でposeとmetricsは有限値を保持する", () => {
  const controller = new PaddleController();
  const width = 900;
  const height = 412;
  const fixedDt = 1 / 240;
  let time = 1;
  controller.applyInput(
    {
      sample: {
        clientX: 450,
        clientY: 240,
        stageX: 0.5,
        stageY: 240 / height,
        time,
        pointerType: "touch",
      },
      metrics: { ...ZERO_STROKE_METRICS, vx: 0.75, vy: -0.25, speed: Math.sqrt(0.625) },
      history: [],
      width,
      height,
      time,
    },
    PZ,
    PZ,
  );

  for (let step = 0; step < 20 * 60 * 240; step += 1) {
    time += fixedDt;
    const pose = controller.advanceFrame(time, fixedDt, width, height, PZ, PZ)!;
    const segment = controller.stepFixed(width, height, PZ, PZ)!;
    assert.ok([
      pose.screenX,
      pose.screenY,
      pose.worldX,
      pose.worldZ,
      pose.velocityX,
      pose.velocityY,
      pose.angle,
      pose.tilt,
      segment.previous.worldX,
      segment.current.worldX,
      controller.getStrikeMetrics(time).speed,
    ].every(Number.isFinite));
  }
});
