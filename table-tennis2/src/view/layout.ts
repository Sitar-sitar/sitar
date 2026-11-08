export const MIN_LANDSCAPE_WIDTH = 568;
export const MIN_LANDSCAPE_HEIGHT = 320;
export const WIDE_LANDSCAPE_WIDTH = 760;
export const MIN_PORTRAIT_STAGE_SIDE = 360;
export const PORTRAIT_RAIL_HEIGHT = 304;

export type ViewportState =
  | "portrait"
  | "portrait-too-small"
  | "too-small"
  | "compact-landscape"
  | "wide-landscape";

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * 設計書 §4.1: 入力を 2 系統へ分ける。
 * - viewport: visualViewport 由来。縦横判定と横画面しきい値に使う。
 * - content: #appShell の content box（セーフエリア控除後）。縦画面の stage 辺長に使う。
 * 横画面しきい値を content box へ移すと 568×320 と 759/760×360 の既存契約が
 * 変わるため、非対称は意図的である。
 */
export interface ViewportMetrics {
  readonly viewport: ViewportSize;
  readonly content: ViewportSize;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isUsableSize({ width, height }: ViewportSize): boolean {
  return isPositiveFinite(width) && isPositiveFinite(height);
}

/**
 * 縦画面の stage 辺長。戻り値はそのまま CSS の px 値（--portrait-stage-side）
 * として使うため整数へ切り捨てる。
 */
export function portraitStageSide(content: ViewportSize): number {
  if (!isUsableSize(content)) return 0;
  return Math.floor(
    Math.min(content.width, content.height - PORTRAIT_RAIL_HEIGHT),
  );
}

export function evaluateViewport({
  viewport,
  content,
}: ViewportMetrics): ViewportState {
  if (!isUsableSize(viewport) || !isUsableSize(content)) {
    return "too-small";
  }
  if (viewport.width <= viewport.height) {
    return portraitStageSide(content) >= MIN_PORTRAIT_STAGE_SIDE
      ? "portrait"
      : "portrait-too-small";
  }
  if (
    viewport.width < MIN_LANDSCAPE_WIDTH ||
    viewport.height < MIN_LANDSCAPE_HEIGHT
  ) {
    return "too-small";
  }
  return viewport.width < WIDE_LANDSCAPE_WIDTH
    ? "compact-landscape"
    : "wide-landscape";
}

export function isViewportBlocked(state: ViewportState): boolean {
  return state === "portrait-too-small" || state === "too-small";
}
