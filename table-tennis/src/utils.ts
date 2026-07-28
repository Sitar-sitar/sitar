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
