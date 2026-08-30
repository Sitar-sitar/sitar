import assert from "node:assert/strict";
import test from "node:test";

import { sweptPaddleContact } from "../src/control/contact.ts";
import { ZERO_STRIKE_METRICS } from "../src/control/stroke.ts";
import { BALL_R, PADDLE_BLADE_SCALE } from "../src/config.ts";
import type { BallVector, PaddlePose } from "../src/types.ts";
import { paddleDepthRatio, paddleScreenRadius } from "../src/utils.ts";
import { createProjectionCamera, projectWorldPoint, unprojectScreenXAtZ } from "../src/view/projection.ts";

test("pointer別の可視接触補助倍率を定義する", async () => {
  const config = await import("../src/config.ts");
  assert.equal((config as Record<string, unknown>).CONTACT_ASSIST_TOUCH, 1.4);
  assert.equal((config as Record<string, unknown>).CONTACT_ASSIST_FINE, 1.2);
  assert.equal((config as Record<string, unknown>).ASSIST_CONTACT_QUALITY_FLOOR, 0.4);
});

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
    pointerType: "touch",
  };
  const contact = sweptPaddleContact({
    previousBall: ball(25, 20, worldZ + 2),
    currentBall: ball(0, 20, worldZ),
    previousPaddle: pose,
    currentPaddle: pose,
    strikeMetrics: { ...ZERO_STRIKE_METRICS, speed: 2, vx: 2, directionX: 1, active: true },
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
    pointerType: "touch",
  };
  assert.equal(
    sweptPaddleContact({
      previousBall: ball(0, 20, worldZ + 80),
      currentBall: ball(0, 20, worldZ + 70),
      previousPaddle: pose,
      currentPaddle: pose,
      strikeMetrics: ZERO_STRIKE_METRICS,
      width,
      height,
      time: 1,
    }),
    null,
  );
});

test("touch 1.40 / fine 1.20のassist輪郭とball外周境界を接触に使う", () => {
  const width = 900;
  const height = 412;
  const worldZ = -150;
  const camera = createProjectionCamera(width, height);
  const center = projectWorldPoint(camera, 0, 20, worldZ);
  const radius = paddleScreenRadius(width, height, paddleDepthRatio(worldZ));
  const visualRx = radius * PADDLE_BLADE_SCALE;
  const ballRadius = Math.max(2, BALL_R * center.s);

  const contactAt = (pointerType: "touch" | "mouse" | "pen", offsetPx: number) => {
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
      phase: "tracking",
      contactFlash: 0,
      pointerType,
    };
    const screenX = center.x + offsetPx;
    const x = unprojectScreenXAtZ(camera, screenX, worldZ);
    return sweptPaddleContact({
      previousBall: ball(x, 20, worldZ),
      currentBall: ball(x, 20, worldZ),
      previousPaddle: pose,
      currentPaddle: pose,
      strikeMetrics: ZERO_STRIKE_METRICS,
      width,
      height,
      time: 1,
    });
  };

  for (const [pointerType, scale] of [["touch", 1.4], ["mouse", 1.2], ["pen", 1.2]] as const) {
    assert.ok(contactAt(pointerType, visualRx * (scale - 0.01)));
    assert.ok(contactAt(pointerType, visualRx * scale + ballRadius));
    assert.equal(contactAt(pointerType, visualRx * (scale + 0.01) + ballRadius), null);
    const centerContact = contactAt(pointerType, 0)!;
    const edgeContact = contactAt(pointerType, visualRx * scale)!;
    assert.ok(centerContact.screenQuality > edgeContact.screenQuality);
    assert.ok(edgeContact.screenQuality < 0.01);
    assert.equal(edgeContact.contactQuality, 0.4);
    assert.ok(Math.abs(edgeContact.contactOffsetX - 1) < 1e-9);
  }
});

test("成立したcontactだけquality 0.40以上へfloorしraw品質を保持する", () => {
  const width = 900;
  const height = 412;
  const worldZ = -150;
  const camera = createProjectionCamera(width, height);
  const center = projectWorldPoint(camera, 0, 20, worldZ);
  const radius = paddleScreenRadius(width, height, paddleDepthRatio(worldZ));
  const visualRx = radius * PADDLE_BLADE_SCALE;
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
    phase: "tracking",
    contactFlash: 0,
    pointerType: "touch",
  };
  const screenX = center.x + visualRx * 1.4;
  const x = unprojectScreenXAtZ(camera, screenX, worldZ);
  const contact = sweptPaddleContact({
    previousBall: ball(x, 20, worldZ),
    currentBall: ball(x, 20, worldZ),
    previousPaddle: pose,
    currentPaddle: pose,
    strikeMetrics: ZERO_STRIKE_METRICS,
    width,
    height,
    time: 1,
  });
  assert.ok(contact);
  assert.ok(contact.screenQuality < 0.01);
  assert.equal(contact.timingQuality, 1);
  assert.equal(contact.contactQuality, 0.4);
});

test("pointer種別未確定ではcontact不可", () => {
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
    pointerDown: false,
    phase: "idle",
    contactFlash: 0,
    pointerType: null,
  };
  assert.equal(sweptPaddleContact({
    previousBall: ball(0, 20, worldZ),
    currentBall: ball(0, 20, worldZ),
    previousPaddle: pose,
    currentPaddle: pose,
    strikeMetrics: ZERO_STRIKE_METRICS,
    width,
    height,
    time: 1,
  }), null);
});

test("tiltとdepth代表値でもcontact値は有限に保たれる", () => {
  const width = 900;
  const height = 412;
  for (const worldZ of [-152, 0, 152]) {
    for (const tilt of [-1, 0, 1]) {
      const center = projectWorldPoint(
        createProjectionCamera(width, height),
        0,
        20,
        worldZ,
      );
      const pose: PaddlePose = {
        screenX: center.x,
        screenY: center.y,
        worldX: 0,
        worldZ,
        velocityX: 0,
        velocityY: 0,
        angle: 0,
        tilt,
        pointerDown: true,
        phase: "tracking",
        contactFlash: 0,
        pointerType: "touch",
      };
      const contact = sweptPaddleContact({
        previousBall: ball(0, 20, worldZ),
        currentBall: ball(0, 20, worldZ),
        previousPaddle: pose,
        currentPaddle: pose,
        strikeMetrics: ZERO_STRIKE_METRICS,
        width,
        height,
        time: 1,
      });
      assert.ok(contact);
      assert.ok(Object.values(contact).every((value) =>
        typeof value !== "number" || Number.isFinite(value)
      ));
    }
  }
});
