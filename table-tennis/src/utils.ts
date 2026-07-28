import {
  PADDLE_SCREEN_SIZE,
  PADDLE_SCREEN_Y,
  PADDLE_SIZE_MAX,
  PADDLE_SIZE_MIN,
  PADDLE_SWING_DROP,
  PADDLE_SWING_LIFT,
  PADDLE_SWING_PUSH,
} from "./config.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function moveToward(
  current: number,
  target: number,
  maxDelta: number,
): number {
  const distance = target - current;
  return Math.abs(distance) < maxDelta
    ? target
    : current + Math.sign(distance) * maxDelta;
}

export function paddleScreenY(
  height: number,
  swing: number,
  swingType: number,
): number {
  const baseY = height * PADDLE_SCREEN_Y;
  if (swing <= 0) {
    return baseY;
  }
  if (swingType === 1) {
    return baseY - height * PADDLE_SWING_LIFT * swing;
  }
  if (swingType === -1) {
    return baseY + height * PADDLE_SWING_DROP * swing;
  }
  return baseY - height * PADDLE_SWING_PUSH * swing;
}

export function paddleScreenRadius(width: number, height: number): number {
  return clamp(
    Math.min(width, height) * PADDLE_SCREEN_SIZE,
    PADDLE_SIZE_MIN,
    PADDLE_SIZE_MAX,
  );
}
