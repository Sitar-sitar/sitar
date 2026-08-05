import {
  GESTURE_MIN_SPEED,
  MAX_GESTURE_SPEED,
  PADDLE_LIMIT,
  PADDLE_SCREEN_Y_MAX,
  PADDLE_SCREEN_Y_MIN,
  POINTER_OFFSET_FINE,
  POINTER_OFFSET_TOUCH,
  STROKE_SNAPSHOT_TTL_SEC,
  STROKE_HISTORY_SEC,
} from "../config.ts";
import type {
  PaddlePose,
  PointerSample,
  StrokeMetrics,
} from "../types.ts";
import {
  clamp,
  clampPaddleScreenY,
  moveToward,
  paddleDepthRatio,
  paddleScreenRadius,
} from "../utils.ts";
import {
  createProjectionCamera,
  unprojectScreenXAtZ,
} from "../view/projection.ts";
import { ZERO_STROKE_METRICS } from "./stroke.ts";

export interface PaddleInputUpdate {
  sample: PointerSample;
  metrics: StrokeMetrics;
  history: readonly PointerSample[];
  width: number;
  height: number;
  time: number;
}

export interface PaddleStepSegment {
  previous: PaddlePose;
  current: PaddlePose;
}

function copyPose(pose: PaddlePose): PaddlePose {
  return { ...pose };
}

export class PaddleController {
  private logical: PaddlePose | null = null;
  private render: PaddlePose | null = null;
  private previousFixed: PaddlePose | null = null;
  private metrics: StrokeMetrics = ZERO_STROKE_METRICS;
  private followUntil = 0;
  private lastInputTime = 0;
  private debugStroke: readonly PointerSample[] = [];

  public applyInput(
    update: PaddleInputUpdate,
    worldZ: number,
    viewZ: number,
  ): PaddlePose {
    const { sample, metrics, width, height } = update;
    const depth = paddleDepthRatio(viewZ);
    const radius = paddleScreenRadius(width, height, depth);
    const bladeRadius = radius * 1.25;
    const offset =
      sample.pointerType === "touch"
        ? POINTER_OFFSET_TOUCH
        : POINTER_OFFSET_FINE;
    const screenX = clamp(sample.stageX * width, bladeRadius, width - bladeRadius);
    const rawY = sample.stageY * height - offset * height;
    const screenY = clampPaddleScreenY(
      clamp(rawY, height * PADDLE_SCREEN_Y_MIN, height * PADDLE_SCREEN_Y_MAX),
      height,
      radius,
    );
    const camera = createProjectionCamera(width, height);
    const worldX = clamp(
      unprojectScreenXAtZ(camera, screenX, worldZ),
      -PADDLE_LIMIT,
      PADDLE_LIMIT,
    );
    const previousAngle = this.logical?.angle ?? Math.PI / 2;
    const angle =
      metrics.speed >= 0.15
        ? Math.atan2(metrics.vy, metrics.vx) + Math.PI / 2
        : previousAngle;
    this.logical = {
      screenX,
      screenY,
      worldX,
      worldZ,
      velocityX: metrics.vx * height,
      velocityY: metrics.vy * height,
      angle,
      tilt: clamp(metrics.directionY + metrics.curvature * 0.4, -1, 1),
      pointerDown: true,
      phase: metrics.speed >= GESTURE_MIN_SPEED ? "armed" : "tracking",
      contactFlash: this.logical?.contactFlash ?? 0,
    };
    this.metrics = metrics;
    this.lastInputTime = update.time;
    this.debugStroke = update.history.slice();
    this.render ??= copyPose(this.logical);
    this.previousFixed ??= copyPose(this.logical);
    return copyPose(this.logical);
  }

  public release(time: number): void {
    if (!this.logical) return;
    this.logical.pointerDown = false;
    this.logical.phase = "follow";
    this.followUntil = time + STROKE_SNAPSHOT_TTL_SEC;
  }

  public reset(): void {
    this.metrics = ZERO_STROKE_METRICS;
    this.debugStroke = [];
    this.followUntil = 0;
    this.lastInputTime = 0;
    if (this.logical) {
      this.logical.pointerDown = false;
      this.logical.phase = "recover";
    }
  }

  public beginContact(time: number): void {
    if (!this.logical) return;
    this.logical.phase = "contact";
    this.logical.contactFlash = 1;
    this.followUntil = time + 0.12;
  }

  public isContactEligible(time: number): boolean {
    const phase = this.logical?.phase;
    return (
      phase === "tracking" ||
      phase === "armed" ||
      (phase === "follow" && time <= this.followUntil)
    );
  }

  public stepFixed(
    dt: number,
    time: number,
    width: number,
    height: number,
    worldZ: number,
    viewZ: number,
  ): PaddleStepSegment | null {
    this.ensurePose(width, height, worldZ, viewZ);
    if (!this.logical) return null;
    if (
      this.logical.pointerDown &&
      this.lastInputTime > 0 &&
      time - this.lastInputTime > STROKE_HISTORY_SEC
    ) {
      this.metrics = ZERO_STROKE_METRICS;
      this.logical.velocityX = 0;
      this.logical.velocityY = 0;
      this.logical.phase = "tracking";
    }
    const previous = copyPose(this.previousFixed ?? this.logical);
    this.logical.worldZ = worldZ;
    this.logical.worldX = clamp(
      unprojectScreenXAtZ(
        createProjectionCamera(width, height),
        this.logical.screenX,
        worldZ,
      ),
      -PADDLE_LIMIT,
      PADDLE_LIMIT,
    );
    if (this.logical.phase === "contact") {
      this.logical.phase = "follow";
    }
    if (this.logical.phase === "follow" && time > this.followUntil) {
      this.logical.phase = "recover";
    }
    if (this.logical.phase === "recover") {
      const targetX = width / 2;
      const depth = paddleDepthRatio(viewZ);
      const radius = paddleScreenRadius(width, height, depth);
      const targetY = clampPaddleScreenY(height * 0.86, height, radius);
      const maxDelta = 385 * dt;
      this.logical.screenX = moveToward(this.logical.screenX, targetX, maxDelta);
      this.logical.screenY = moveToward(this.logical.screenY, targetY, maxDelta);
      this.logical.angle = moveToward(this.logical.angle, Math.PI / 2, dt * 6);
      if (
        Math.abs(this.logical.screenX - targetX) < 0.5 &&
        Math.abs(this.logical.screenY - targetY) < 0.5
      ) {
        this.logical.phase = "idle";
      }
    }
    const current = copyPose(this.logical);
    this.previousFixed = current;
    return { previous, current };
  }

  public updateVisual(dt: number, width: number, height: number): void {
    if (!this.logical) return;
    this.render ??= copyPose(this.logical);
    const speedRatio = clamp(this.metrics.speed / MAX_GESTURE_SPEED, 0, 1);
    const tau = 0.02 + (0.008 - 0.02) * speedRatio;
    const alpha = 1 - Math.exp(-Math.max(0, dt) / tau);
    this.render.screenX += (this.logical.screenX - this.render.screenX) * alpha;
    this.render.screenY += (this.logical.screenY - this.render.screenY) * alpha;
    this.render.angle += (this.logical.angle - this.render.angle) * alpha;
    Object.assign(this.render, {
      worldX: this.logical.worldX,
      worldZ: this.logical.worldZ,
      velocityX: this.logical.velocityX,
      velocityY: this.logical.velocityY,
      tilt: this.logical.tilt,
      pointerDown: this.logical.pointerDown,
      phase: this.logical.phase,
      contactFlash: this.logical.contactFlash,
    });
    const depth = paddleDepthRatio(this.logical.worldZ);
    const maxGap = paddleScreenRadius(width, height, depth) * 0.25;
    const dx = this.render.screenX - this.logical.screenX;
    const dy = this.render.screenY - this.logical.screenY;
    const gap = Math.hypot(dx, dy);
    if (gap > maxGap && gap > 0) {
      const ratio = maxGap / gap;
      this.render.screenX = this.logical.screenX + dx * ratio;
      this.render.screenY = this.logical.screenY + dy * ratio;
    }
    this.logical.contactFlash = Math.max(0, this.logical.contactFlash - dt / 0.08);
    this.render.contactFlash = this.logical.contactFlash;
  }

  public getRenderPose(): PaddlePose | null {
    return this.render ? copyPose(this.render) : null;
  }

  public getMetrics(): StrokeMetrics {
    return { ...this.metrics };
  }

  public getDebugStroke(): readonly PointerSample[] {
    return this.debugStroke;
  }

  private ensurePose(
    width: number,
    height: number,
    worldZ: number,
    viewZ: number,
  ): void {
    if (this.logical) return;
    const depth = paddleDepthRatio(viewZ);
    const radius = paddleScreenRadius(width, height, depth);
    const screenX = width / 2;
    const pose: PaddlePose = {
      screenX,
      screenY: clampPaddleScreenY(height * 0.86, height, radius),
      worldX: 0,
      worldZ,
      velocityX: 0,
      velocityY: 0,
      angle: Math.PI / 2,
      tilt: 0,
      pointerDown: false,
      phase: "idle",
      contactFlash: 0,
    };
    this.logical = pose;
    this.render = copyPose(pose);
    this.previousFixed = copyPose(pose);
  }
}
