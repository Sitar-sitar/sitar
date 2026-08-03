export const MIN_LANDSCAPE_WIDTH = 568;
export const MIN_LANDSCAPE_HEIGHT = 320;
export const WIDE_LANDSCAPE_WIDTH = 760;

export type ViewportState =
  | "portrait-blocked"
  | "too-small"
  | "compact-landscape"
  | "wide-landscape";

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export function evaluateViewport({
  width,
  height,
}: ViewportSize): ViewportState {
  if (width <= height) {
    return "portrait-blocked";
  }
  if (
    width < MIN_LANDSCAPE_WIDTH ||
    height < MIN_LANDSCAPE_HEIGHT
  ) {
    return "too-small";
  }
  return width < WIDE_LANDSCAPE_WIDTH
    ? "compact-landscape"
    : "wide-landscape";
}

export function isViewportBlocked(state: ViewportState): boolean {
  return state === "portrait-blocked" || state === "too-small";
}
