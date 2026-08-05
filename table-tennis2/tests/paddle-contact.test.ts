import assert from "node:assert/strict";
import test from "node:test";

import { sweptPaddleContact } from "../src/control/contact.ts";
import { ZERO_STROKE_METRICS } from "../src/control/stroke.ts";
import type { BallVector, PaddlePose } from "../src/types.ts";
import { createProjectionCamera, projectWorldPoint } from "../src/view/projection.ts";

function ball(x: number, y: number, z: number): BallVector {
  return { x, y, z, vx: -500, vy: 0, vz: -400, spin: 0.5, side: 0.2 };
}

test("ballとpaddleの相対掃引がblade内を横切ると接触する", () => {
  const width = 900;
  const height = 412;
  const worldZ = -150;
  const center = projectWorldPoint(createProjectionCamera(width, height), 0, 20, worldZ);
  const pose: PaddlePose = {
    screenX: center.x,
    screenY: center.y,
    worldX: 0,
    worldZ,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    tilt: 0,
    pointerDown: true,
    phase: "armed",
    contactFlash: 0,
  };
  const contact = sweptPaddleContact({
    previousBall: ball(25, 20, worldZ + 2),
    currentBall: ball(0, 20, worldZ),
    previousPaddle: pose,
    currentPaddle: pose,
    metrics: { ...ZERO_STROKE_METRICS, speed: 2, vx: 2, directionX: 1 },
    width,
    height,
    time: 1,
  });
  assert.ok(contact);
  assert.ok(contact.contactQuality >= 0 && contact.contactQuality <= 1);
});

test("depth gate外では画面上で重なっても接触しない", () => {
  const width = 900;
  const height = 412;
  const worldZ = -150;
  const center = projectWorldPoint(createProjectionCamera(width, height), 0, 20, worldZ);
  const pose: PaddlePose = {
    screenX: center.x,
    screenY: center.y,
    worldX: 0,
    worldZ,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    tilt: 0,
    pointerDown: true,
    phase: "armed",
    contactFlash: 0,
  };
  assert.equal(
    sweptPaddleContact({
      previousBall: ball(0, 20, worldZ + 80),
      currentBall: ball(0, 20, worldZ + 70),
      previousPaddle: pose,
      currentPaddle: pose,
      metrics: ZERO_STROKE_METRICS,
      width,
      height,
      time: 1,
    }),
    null,
  );
});
