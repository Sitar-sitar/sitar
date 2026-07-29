import {
  CONTACT_PLANE_FAR,
  CONTACT_PLANE_NEAR,
  P_DEPTH_SPEED,
  PADDLE_BLADE_SCALE,
  PADDLE_DEPTH_RISE,
  PADDLE_DEPTH_SHRINK,
  PADDLE_EDGE_MARGIN,
  PADDLE_HANDLE_INSET,
  PADDLE_HANDLE_LENGTH,
  PADDLE_HANDLE_TILT,
  PADDLE_SCREEN_SIZE,
  PADDLE_SCREEN_Y,
  PADDLE_SHADOW_GAP,
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

export function projectScale(
  focal: number,
  cameraZ: number,
  z: number,
): number {
  return focal / Math.max(24, z - cameraZ);
}

export function paddleDepthRatio(z: number): number {
  return clamp(
    (Math.abs(z) - CONTACT_PLANE_NEAR) /
      (CONTACT_PLANE_FAR - CONTACT_PLANE_NEAR),
    0,
    1,
  );
}

export function stepViewZ(
  viewZ: number,
  z: number,
  dt: number,
): number {
  return moveToward(viewZ, z, P_DEPTH_SPEED * Math.max(0, dt));
}

function paddleDepthBaseY(height: number, depth: number): number {
  return height * (PADDLE_SCREEN_Y - PADDLE_DEPTH_RISE * (1 - depth));
}

function paddleDepthScale(depth: number): number {
  return 1 - PADDLE_DEPTH_SHRINK * (1 - depth);
}

export function paddleScreenY(
  height: number,
  swing: number,
  swingType: number,
  depth: number,
): number {
  const baseY = paddleDepthBaseY(height, depth);
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

export function paddleScreenRadius(
  width: number,
  height: number,
  depth: number,
): number {
  return (
    clamp(
      Math.min(width, height) * PADDLE_SCREEN_SIZE,
      PADDLE_SIZE_MIN,
      PADDLE_SIZE_MAX,
    ) * paddleDepthScale(depth)
  );
}

export function paddleShadowY(height: number, depth: number): number {
  return (
    paddleDepthBaseY(height, depth) +
    height * PADDLE_SHADOW_GAP * paddleDepthScale(depth)
  );
}

export function paddleHandleAngle(
  swing: number,
  swingType: number,
): number {
  const base = Math.PI / 2;
  if (swing <= 0) {
    return base;
  }
  if (swingType === 1) {
    return base + PADDLE_HANDLE_TILT * swing;
  }
  if (swingType === -1) {
    return base - PADDLE_HANDLE_TILT * 0.6 * swing;
  }
  return base + PADDLE_HANDLE_TILT * 0.35 * swing;
}

export function paddleBottomExtent(radius: number): number {
  return (
    radius *
      PADDLE_BLADE_SCALE *
      (PADDLE_HANDLE_INSET + PADDLE_HANDLE_LENGTH) +
    PADDLE_EDGE_MARGIN
  );
}

export function clampPaddleScreenY(
  y: number,
  height: number,
  radius: number,
): number {
  return Math.min(y, height - paddleBottomExtent(radius));
}

export function formatUuidV4(bytes: ArrayLike<number>): string {
  if (bytes.length < 16) {
    throw new Error("UUIDには16バイトが必要です。");
  }

  const values = Array.from(
    { length: 16 },
    (_, index) => bytes[index]! & 0xff,
  );
  values[6] = (values[6]! & 0x0f) | 0x40;
  values[8] = (values[8]! & 0x3f) | 0x80;

  const hex = values.map((value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function normalizePlayerName(raw: string): string {
  const name = raw.trim();
  const length = [...name].length;
  if (length < 1 || length > 12) {
    throw new Error("名前は1〜12文字で入力してください。");
  }
  return name;
}
