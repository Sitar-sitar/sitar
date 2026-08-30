import {
  CONTACT_WEIGHT_SEC,
  CURVE_MIN_DISPLACEMENT,
  CURVE_MIN_SEGMENT,
  MAX_GESTURE_SPEED,
  MAX_POINTER_SAMPLES,
  STRIKE_ACTIVE_MAX_AGE_SEC,
  STRIKE_MIN_DISPLACEMENT,
  STRIKE_MIN_SPEED,
  STRIKE_MIN_VERTICALITY,
  STRIKE_WINDOW_SEC,
  STROKE_HISTORY_SEC,
} from "../config.ts";
import type { PointerSample, StrikeMetrics, StrokeMetrics } from "../types.ts";
import { clamp } from "../utils.ts";

export const ZERO_STROKE_METRICS: StrokeMetrics = Object.freeze({
  vx: 0,
  vy: 0,
  speed: 0,
  acceleration: 0,
  directionX: 0,
  directionY: 0,
  pathLength: 0,
  displacement: 0,
  curvature: 0,
  age: 0,
});

export const ZERO_STRIKE_METRICS: StrikeMetrics = Object.freeze({
  vx: 0,
  vy: 0,
  speed: 0,
  displacement: 0,
  directionX: 0,
  directionY: 0,
  verticality: 0,
  curvature: 0,
  age: 0,
  active: false,
});

export function normalizeStagePoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): { stageX: number; stageY: number } {
  return {
    stageX: clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    stageY: clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1),
  };
}

export function appendPointerSample(
  samples: PointerSample[],
  sample: PointerSample,
): boolean {
  const previous = samples.at(-1);
  if (
    !Number.isFinite(sample.time) ||
    (previous && sample.time <= previous.time)
  ) {
    return false;
  }
  samples.push(sample);
  const cutoff = sample.time - STROKE_HISTORY_SEC;
  while (
    samples.length > 1 &&
    ((samples[0]?.time ?? sample.time) < cutoff ||
      samples.length > MAX_POINTER_SAMPLES)
  ) {
    samples.shift();
  }
  return true;
}

interface Segment {
  vx: number;
  vy: number;
  speed: number;
  length: number;
  endTime: number;
  dt: number;
}

export function computeStrokeMetrics(
  samples: readonly PointerSample[],
  canvasHeight: number,
  now = samples.at(-1)?.time ?? 0,
): StrokeMetrics {
  if (samples.length < 2 || !Number.isFinite(canvasHeight)) {
    return ZERO_STROKE_METRICS;
  }
  const height = Math.max(1, canvasHeight);
  const segments: Segment[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const first = samples[index - 1];
    const last = samples[index];
    if (!first || !last) continue;
    const dt = last.time - first.time;
    if (dt <= 0) continue;
    const dx = (last.clientX - first.clientX) / height;
    const dy = (last.clientY - first.clientY) / height;
    const length = Math.hypot(dx, dy);
    segments.push({
      vx: dx / dt,
      vy: dy / dt,
      speed: length / dt,
      length,
      endTime: last.time,
      dt,
    });
  }
  if (segments.length === 0) return ZERO_STROKE_METRICS;

  let vx = 0;
  let vy = 0;
  let weightTotal = 0;
  let pathLength = 0;
  for (const segment of segments) {
    const age = Math.max(0, now - segment.endTime);
    const recency = clamp(1 - age / CONTACT_WEIGHT_SEC, 0, 1);
    const weight = segment.dt * (0.5 + 0.5 * recency);
    vx += segment.vx * weight;
    vy += segment.vy * weight;
    weightTotal += weight;
    pathLength += segment.length;
  }
  vx /= Math.max(Number.EPSILON, weightTotal);
  vy /= Math.max(Number.EPSILON, weightTotal);
  const speed = Math.hypot(vx, vy);

  const first = samples[0]!;
  const last = samples.at(-1)!;
  const displacement =
    Math.hypot(last.clientX - first.clientX, last.clientY - first.clientY) /
    height;
  const elapsed = Math.max(Number.EPSILON, last.time - first.time);
  const acceleration =
    ((segments.at(-1)?.speed ?? 0) - (segments[0]?.speed ?? 0)) / elapsed;

  let curvature = 0;
  if (displacement >= CURVE_MIN_DISPLACEMENT) {
    let angleTotal = 0;
    let angleWeight = 0;
    for (let index = 1; index < segments.length; index += 1) {
      const a = segments[index - 1];
      const b = segments[index];
      if (!a || !b || a.length < CURVE_MIN_SEGMENT || b.length < CURVE_MIN_SEGMENT) {
        continue;
      }
      const ax = a.vx / Math.max(Number.EPSILON, a.speed);
      const ay = a.vy / Math.max(Number.EPSILON, a.speed);
      const bx = b.vx / Math.max(Number.EPSILON, b.speed);
      const by = b.vy / Math.max(Number.EPSILON, b.speed);
      const age = Math.max(0, now - b.endTime);
      const weight = 0.5 + 0.5 * clamp(1 - age / CONTACT_WEIGHT_SEC, 0, 1);
      angleTotal += Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * weight;
      angleWeight += weight;
    }
    if (angleWeight > 0) {
      curvature = clamp((angleTotal / angleWeight) / Math.PI, -1, 1);
    }
  }

  const result = {
    vx,
    vy,
    speed: Math.min(MAX_GESTURE_SPEED * 2, speed),
    acceleration,
    directionX: speed > 0 ? vx / speed : 0,
    directionY: speed > 0 ? vy / speed : 0,
    pathLength,
    displacement,
    curvature,
    age: Math.max(0, now - last.time),
  };
  return Object.values(result).every(Number.isFinite)
    ? result
    : ZERO_STROKE_METRICS;
}

export function deriveStrikeMetrics(
  samples: readonly PointerSample[],
  canvasHeight: number,
  contactTime: number,
): StrikeMetrics {
  if (!Number.isFinite(contactTime) || !Number.isFinite(canvasHeight)) {
    return ZERO_STRIKE_METRICS;
  }
  const windowStart = contactTime - STRIKE_WINDOW_SEC;
  const strikeSamples = samples.filter(
    (sample) =>
      Number.isFinite(sample.time) &&
      sample.time >= windowStart &&
      sample.time <= contactTime,
  );
  if (strikeSamples.length < 2) return ZERO_STRIKE_METRICS;
  const metrics = computeStrokeMetrics(strikeSamples, canvasHeight, contactTime);
  const verticality = metrics.speed > 0
    ? Math.abs(metrics.vy) / metrics.speed
    : 0;
  const result: StrikeMetrics = {
    vx: metrics.vx,
    vy: metrics.vy,
    speed: metrics.speed,
    displacement: metrics.displacement,
    directionX: metrics.directionX,
    directionY: metrics.directionY,
    verticality,
    curvature: metrics.curvature,
    age: metrics.age,
    active:
      metrics.speed >= STRIKE_MIN_SPEED &&
      metrics.displacement >= STRIKE_MIN_DISPLACEMENT &&
      verticality >= STRIKE_MIN_VERTICALITY &&
      metrics.age <= STRIKE_ACTIVE_MAX_AGE_SEC,
  };
  return Object.values(result).every((value) =>
    typeof value === "boolean" || Number.isFinite(value)
  )
    ? result
    : ZERO_STRIKE_METRICS;
}
