export function playerContactGuideAlpha(remainingSec: number): number {
  if (remainingSec <= 0) return 0;
  if (remainingSec <= 0.1) return Math.min(0.4, 4 * remainingSec);
  if (remainingSec <= 0.35) return 0.4;
  return 0.25;
}
