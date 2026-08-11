import {
  BALL_R,
  CONTACT_DEPTH_BASE,
  CONTACT_DEPTH_MAX,
  CONTACT_ASSIST_FINE,
  CONTACT_ASSIST_TOUCH,
  FIXED_STEP,
  PADDLE_BLADE_SCALE,
} from "../config.ts";
import type {
  BallVector,
  ContactEvent,
  PaddlePose,
  StrikeMetrics,
} from "../types.ts";
import { clamp, paddleDepthRatio, paddleScreenRadius } from "../utils.ts";
import { createProjectionCamera, projectWorldPoint } from "../view/projection.ts";

export interface PaddleContactInput {
  previousBall: BallVector;
  currentBall: BallVector;
  previousPaddle: PaddlePose;
  currentPaddle: PaddlePose;
  strikeMetrics: StrikeMetrics;
  width: number;
  height: number;
  time: number;
}

function rotate(x: number, y: number, angle: number): { x: number; y: number } {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: x * cosine - y * sine, y: x * sine + y * cosine };
}

export function contactDepthTolerance(vz: number): number {
  return clamp(
    CONTACT_DEPTH_BASE + Math.abs(vz) * FIXED_STEP,
    CONTACT_DEPTH_BASE,
    CONTACT_DEPTH_MAX,
  );
}

export function sweptPaddleContact(
  input: PaddleContactInput,
): ContactEvent | null {
  const {
    previousBall,
    currentBall,
    previousPaddle,
    currentPaddle,
    strikeMetrics,
    width,
    height,
    time,
  } = input;
  if (width <= 0 || height <= 0) return null;
  const tolerance = contactDepthTolerance(currentBall.vz);
  const depthDistance = Math.abs(currentBall.z - currentPaddle.worldZ);
  if (depthDistance > tolerance) return null;

  const camera = createProjectionCamera(width, height);
  const previousProjected = projectWorldPoint(
    camera,
    previousBall.x,
    previousBall.y,
    previousBall.z,
  );
  const currentProjected = projectWorldPoint(
    camera,
    currentBall.x,
    currentBall.y,
    currentBall.z,
  );
  const angle = (previousPaddle.angle + currentPaddle.angle) / 2;
  const p0 = rotate(
    previousProjected.x - previousPaddle.screenX,
    previousProjected.y - previousPaddle.screenY,
    -angle,
  );
  const p1 = rotate(
    currentProjected.x - currentPaddle.screenX,
    currentProjected.y - currentPaddle.screenY,
    -angle,
  );
  const depth = paddleDepthRatio(currentPaddle.worldZ);
  const radius = paddleScreenRadius(width, height, depth);
  const squash = 1 - Math.abs(currentPaddle.tilt) * 0.15;
  const visualRx = radius * PADDLE_BLADE_SCALE;
  const visualRy = visualRx * 0.94 * squash;
  if (!currentPaddle.pointerType) return null;
  const assistScale = currentPaddle.pointerType === "touch"
    ? CONTACT_ASSIST_TOUCH
    : CONTACT_ASSIST_FINE;
  const assistVisualRx = visualRx * assistScale;
  const assistVisualRy = visualRy * assistScale;
  const ballRadius = Math.max(2, BALL_R * currentProjected.s);
  const rx = assistVisualRx + ballRadius;
  const ry = assistVisualRy + ballRadius;
  if (![rx, ry, p0.x, p0.y, p1.x, p1.y].every(Number.isFinite) || rx <= 0 || ry <= 0) {
    return null;
  }
  const start = { x: p0.x / rx, y: p0.y / ry };
  const end = { x: p1.x / rx, y: p1.y / ry };
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const denominator = vx * vx + vy * vy;
  const ratio = denominator > 0
    ? clamp(-(start.x * vx + start.y * vy) / denominator, 0, 1)
    : 0;
  const contactX = p0.x + (p1.x - p0.x) * ratio;
  const contactY = p0.y + (p1.y - p0.y) * ratio;
  const q = (contactX / rx) ** 2 + (contactY / ry) ** 2;
  if (q > 1 + 1e-9) return null;

  const assistQ =
    (contactX / assistVisualRx) ** 2 +
    (contactY / assistVisualRy) ** 2;
  const screenQuality = clamp(1 - Math.sqrt(assistQ), 0, 1);
  const timingQuality = clamp(1 - depthDistance / tolerance, 0, 1);
  const contactQuality = clamp(
    0.7 * screenQuality + 0.3 * timingQuality,
    0,
    1,
  );
  return {
    screenX:
      previousProjected.x +
      (currentProjected.x - previousProjected.x) * ratio,
    screenY:
      previousProjected.y +
      (currentProjected.y - previousProjected.y) * ratio,
    contactOffsetX: clamp(contactX / assistVisualRx, -1, 1),
    contactOffsetY: clamp(contactY / assistVisualRy, -1, 1),
    screenQuality,
    timingQuality,
    contactQuality,
    ballHeight: currentBall.y,
    ballVelocityBefore: { ...currentBall },
    strikeMetrics: { ...strikeMetrics },
    time,
  };
}
