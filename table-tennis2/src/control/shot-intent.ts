import {
  CURVE_SPIN_THRESHOLD,
  HL,
  LOB_MAX_Y,
  MAX_GESTURE_SPEED,
  SHOTS,
  SMASH_GESTURE_SPEED,
  SMASH_MIN_Y,
  STRIKE_MIN_SPEED,
} from "../config.ts";
import { isShortBall } from "../rules.ts";
import type {
  ContactEvent,
  ShotId,
  ShotIntent,
} from "../types.ts";
import { clamp } from "../utils.ts";

function classify(
  passive: boolean,
  short: boolean,
  lift: number,
  speed: number,
  ballY: number,
): ShotId {
  if (passive) return "PUSH";
  if (short) {
    if (lift <= -0.42) return "STOP";
    if (lift >= 0.42) return "FLICK";
    return "PUSH";
  }
  if (lift >= 0.42 && ballY < LOB_MAX_Y) return "LOB";
  if (
    lift >= 0.42 &&
    speed >= SMASH_GESTURE_SPEED &&
    ballY > SMASH_MIN_Y
  ) {
    return "SMASH";
  }
  if (lift >= 0.42) return "DRIVE";
  if (lift <= -0.42) return "CHOP";
  return "PUSH";
}

export function buildShotIntent(
  contact: ContactEvent,
  lastBounceZ: number | null,
): ShotIntent {
  const metrics = contact.strikeMetrics;
  const passive = !metrics.active;
  const power = passive
    ? 0.12
    : clamp(
        (metrics.speed - STRIKE_MIN_SPEED) /
          (MAX_GESTURE_SPEED - STRIKE_MIN_SPEED),
        0,
        1,
      );
  const lift = passive ? 0 : clamp(-metrics.directionY, -1, 1);
  const short = isShortBall(lastBounceZ, contact.ballHeight, "P");
  const classifiedShot = classify(
    passive,
    short,
    lift,
    metrics.speed,
    contact.ballHeight,
  );
  const baseDepth = clamp(
    (SHOTS[classifiedShot].dep - 24) / ((HL - 14) - 24),
    0,
    1,
  );
  return {
    power,
    aimX: clamp(-0.65 * contact.contactOffsetX, -0.65, 0.65),
    depth: passive
      ? baseDepth
      : clamp(baseDepth + (power - 0.5) * 0.12, 0, 1),
    lift,
    topSpin: passive
      ? 0
      : clamp(lift * (0.35 + 0.65 * power), -1, 1),
    sideSpin:
      passive || Math.abs(metrics.curvature) < CURVE_SPIN_THRESHOLD
        ? 0
        : clamp(metrics.curvature * (0.3 + 0.7 * power), -1, 1),
    contactQuality: contact.contactQuality,
    timingQuality: contact.timingQuality,
    strokeCurvature: metrics.curvature,
    classifiedShot,
    passive,
    isServe: false,
  };
}
