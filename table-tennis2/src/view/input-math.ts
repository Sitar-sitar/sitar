export function normalizeStageX(
  clientX: number,
  left: number,
  width: number,
): number {
  return Math.max(0, Math.min(1, (clientX - left) / Math.max(1, width)));
}
