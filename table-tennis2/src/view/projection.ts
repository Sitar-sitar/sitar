import { computeCamera } from "./camera.ts";
import { projectScale } from "../utils.ts";

export interface ProjectionCamera {
  x: number;
  y: number;
  z: number;
  f: number;
  cx: number;
  cy: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  s: number;
}

export function createProjectionCamera(
  width: number,
  height: number,
): ProjectionCamera {
  return {
    x: 0,
    y: 190,
    z: -330,
    ...computeCamera(width, height),
  };
}

export function projectWorldPoint(
  camera: ProjectionCamera,
  x: number,
  y: number,
  z: number,
): ProjectedPoint {
  const scale = projectScale(camera.f, camera.z, z);
  return {
    x: camera.cx + (x - camera.x) * scale,
    y: camera.cy - (y - camera.y) * scale,
    s: scale,
  };
}

export function unprojectScreenXAtZ(
  camera: ProjectionCamera,
  screenX: number,
  z: number,
): number {
  const scale = projectScale(camera.f, camera.z, z);
  return camera.x + (screenX - camera.cx) / scale;
}
