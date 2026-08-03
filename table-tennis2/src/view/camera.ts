export interface CameraMetrics {
  readonly f: number;
  readonly cx: number;
  readonly cy: number;
}

export function computeCamera(width: number, height: number): CameraMetrics {
  const f = Math.max(300, Math.min(1.3 * width, 0.8 * height));
  const cameraY = 190;
  const cameraZ = -330;
  const tableHalfLength = 137;
  const near = f / (-tableHalfLength - cameraZ);
  return {
    f,
    cx: width / 2,
    cy: height * 0.735 - cameraY * near,
  };
}
