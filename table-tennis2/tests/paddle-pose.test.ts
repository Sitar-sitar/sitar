import assert from "node:assert/strict";
import test from "node:test";

import { PaddleController } from "../src/control/paddle.ts";
import { ZERO_STROKE_METRICS } from "../src/control/stroke.ts";
import { PZ } from "../src/config.ts";
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
  assert.equal(pose.phase, "armed");
});

test("release後はfollow期限を過ぎて待機位置へ回復する", () => {
  const controller = new PaddleController();
  controller.stepFixed(1 / 120, 1, 900, 412, PZ, PZ);
  controller.release(1);
  const segment = controller.stepFixed(1 / 120, 1.3, 900, 412, PZ, PZ);
  assert.equal(segment?.current.phase, "idle");
  assert.equal(segment?.current.pointerDown, false);
});
