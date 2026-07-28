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
