import {
  CONTACT_RELEASE_GRACE_FINE_SEC,
  CONTACT_RELEASE_GRACE_TOUCH_SEC,
  CONTACT_ASSIST_FINE,
  CONTACT_ASSIST_TOUCH,
  MAX_GESTURE_SPEED,
  PADDLE_BLADE_SCALE,
  PADDLE_LIMIT,
  PADDLE_SCREEN_Y,
  PADDLE_SCREEN_Y_MAX,
  PADDLE_SCREEN_Y_MIN,
  POINTER_OFFSET_FINE,
  POINTER_OFFSET_TOUCH,
  POINTER_PREDICTION_MAX_DISTANCE_RATIO,
  POINTER_PREDICTION_MAX_SEC,
  P_SPEED,
  STRIKE_ACTIVE_MAX_AGE_SEC,
  STROKE_HISTORY_SEC,
} from "../config.ts";
import type {
  PaddlePose,
  PointerKind,
  PointerSample,
  StrikeMetrics,
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
import {
  deriveStrikeMetrics,
  ZERO_STRIKE_METRICS,
  ZERO_STROKE_METRICS,
} from "./stroke.ts";

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

export interface PaddleDebugState {
  pointerAgeMs: number;
  predictionMs: number;
  predictionDistancePx: number;
  strikeActive: boolean;
  strikeSpeed: number;
  assistScale: number | null;
  contactGraceMs: number;
}

function copyPose(pose: PaddlePose): PaddlePose {
  return { ...pose };
}

function finiteTrackingMetrics(metrics: StrokeMetrics): boolean {
  return Object.values(metrics).every(Number.isFinite);
}

function withinDeadline(time: number, deadline: number): boolean {
  return time <= deadline + 1e-9;
}

export function shortestAngleDelta(current: number, target: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export class PaddleController {
  private interaction: PaddlePose | null = null;
  private previousFixed: PaddlePose | null = null;
  private latestSample: PointerSample | null = null;
  private readonly history: PointerSample[] = [];
  private metrics: StrokeMetrics = ZERO_STROKE_METRICS;
  private pointerType: PointerKind | null = null;
  private releaseStrike: StrikeMetrics = ZERO_STRIKE_METRICS;
  private releaseStrikeCapturedAt = 0;
  private contactFollowUntil = 0;
  private lastInputTime = 0;
  private lastCanvasHeight = 0;
  private targetAngle = Math.PI / 2;
  private targetTilt = 0;
  private pointerAgeMs = 0;
  private predictionMs = 0;
  private predictionDistancePx = 0;
  private debugStroke: readonly PointerSample[] = [];
  /** 難易度係数のみ保持する。最終補助倍率は pointer 種別と毎回積を取る（v0.2.4 §5.3.1） */
  private levelAssistScale = 1;

  public applyInput(
    update: PaddleInputUpdate,
    worldZ: number,
    viewZ: number,
  ): PaddlePose {
    const { sample, metrics, width, height } = update;
    this.ensurePose(width, height, worldZ, viewZ);
    if (!this.interaction || width <= 0 || height <= 0) {
      return copyPose(this.interaction!);
    }

    if (!this.interaction.pointerDown) {
      this.pointerType = sample.pointerType;
    }
    this.latestSample = { ...sample };
    this.history.splice(0, this.history.length, ...update.history.map((item) => ({ ...item })));
    this.metrics = finiteTrackingMetrics(metrics) ? { ...metrics } : ZERO_STROKE_METRICS;
    this.lastInputTime = update.time;
    this.lastCanvasHeight = height;
    this.debugStroke = update.history.slice();

    const center = this.baseCenter(sample, width, height, viewZ);
    this.interaction.screenX = center.screenX;
    this.interaction.screenY = center.screenY;
    this.interaction.worldX = this.worldX(center.screenX, width, height, worldZ);
    this.interaction.worldZ = worldZ;
    this.interaction.velocityX = this.metrics.vx * height;
    this.interaction.velocityY = this.metrics.vy * height;
    this.interaction.pointerDown = true;
    this.interaction.pointerType = this.pointerType;
    const strike = deriveStrikeMetrics(
      this.history,
      height,
      update.time,
    );
    this.interaction.phase = strike.active ? "armed" : "tracking";
    this.updatePoseTarget(strike);
    this.previousFixed ??= copyPose(this.interaction);
    return copyPose(this.interaction);
  }

  public advanceFrame(
    frameTime: number,
    frameDelta: number,
    width: number,
    height: number,
    worldZ: number,
    viewZ: number,
  ): PaddlePose | null {
    if (width <= 0 || height <= 0 || !Number.isFinite(frameTime)) return null;
    this.ensurePose(width, height, worldZ, viewZ);
    if (!this.interaction) return null;

    if (this.interaction.phase === "contact") {
      this.interaction.phase = "follow";
    }
    if (
      this.interaction.phase === "follow" &&
      !withinDeadline(frameTime, this.contactFollowUntil)
    ) {
      this.interaction.phase = "recover";
      this.releaseStrike = ZERO_STRIKE_METRICS;
      this.releaseStrikeCapturedAt = 0;
    }

    if (this.interaction.pointerDown && this.latestSample) {
      const age = Math.max(0, frameTime - this.latestSample.time);
      const predictionTime = Math.min(age, POINTER_PREDICTION_MAX_SEC);
      const canPredict =
        this.history.length >= 2 &&
        finiteTrackingMetrics(this.metrics) &&
        frameTime - this.lastInputTime <= STROKE_HISTORY_SEC;
      const maxPrediction = POINTER_PREDICTION_MAX_DISTANCE_RATIO * height;
      const rawDx = canPredict ? this.metrics.vx * height * predictionTime : 0;
      const rawDy = canPredict ? this.metrics.vy * height * predictionTime : 0;
      const rawDistance = Math.hypot(rawDx, rawDy);
      const predictionScale = rawDistance > maxPrediction
        ? maxPrediction / rawDistance
        : 1;
      const dx = rawDx * predictionScale;
      const dy = rawDy * predictionScale;
      const base = this.baseCenter(this.latestSample, width, height, viewZ);
      const radius = paddleScreenRadius(width, height, paddleDepthRatio(viewZ));
      const bladeRadius = radius * PADDLE_BLADE_SCALE;
      this.interaction.screenX = clamp(
        base.screenX + dx,
        bladeRadius,
        width - bladeRadius,
      );
      this.interaction.screenY = clampPaddleScreenY(
        base.screenY + dy,
        height,
        radius,
      );
      this.pointerAgeMs = Math.max(0, Math.round(age * 1_000));
      this.predictionMs = Math.round((canPredict ? predictionTime : 0) * 1_000);
      this.predictionDistancePx = Math.hypot(dx, dy);

      if (frameTime - this.lastInputTime > STROKE_HISTORY_SEC) {
        this.metrics = ZERO_STROKE_METRICS;
        this.targetAngle = Math.PI / 2;
        this.targetTilt = 0;
      }
      const strike = deriveStrikeMetrics(
        this.history,
        height,
        frameTime,
      );
      this.interaction.phase = strike.active ? "armed" : "tracking";
      this.updatePoseTarget(strike);
    } else if (this.interaction.phase === "follow") {
      this.pointerAgeMs = 0;
      this.predictionMs = 0;
      this.predictionDistancePx = 0;
      this.updatePoseTarget(this.getStrikeMetrics(frameTime));
    } else {
      this.pointerAgeMs = 0;
      this.predictionMs = 0;
      this.predictionDistancePx = 0;
    }

    if (this.interaction.phase === "recover" || this.interaction.phase === "idle") {
      const radius = paddleScreenRadius(width, height, paddleDepthRatio(viewZ));
      const targetX = width / 2;
      const targetY = clampPaddleScreenY(height * PADDLE_SCREEN_Y, height, radius);
      const maxDelta = P_SPEED * Math.max(0, frameDelta);
      this.interaction.screenX = moveToward(this.interaction.screenX, targetX, maxDelta);
      this.interaction.screenY = moveToward(this.interaction.screenY, targetY, maxDelta);
      this.targetAngle = Math.PI / 2;
      this.targetTilt = 0;
      if (
        Math.abs(this.interaction.screenX - targetX) < 0.5 &&
        Math.abs(this.interaction.screenY - targetY) < 0.5
      ) {
        this.interaction.phase = "idle";
        this.interaction.pointerType = null;
        this.pointerType = null;
      }
    }

    const speedRatio = clamp(this.metrics.speed / MAX_GESTURE_SPEED, 0, 1);
    const tau = 0.02 + (0.008 - 0.02) * speedRatio;
    const alpha = 1 - Math.exp(-Math.max(0, frameDelta) / tau);
    this.interaction.angle += shortestAngleDelta(
      this.interaction.angle,
      this.targetAngle,
    ) * alpha;
    this.interaction.tilt += (this.targetTilt - this.interaction.tilt) * alpha;
    this.interaction.contactFlash = Math.max(
      0,
      this.interaction.contactFlash - Math.max(0, frameDelta) / 0.08,
    );
    this.interaction.worldZ = worldZ;
    this.interaction.worldX = this.worldX(
      this.interaction.screenX,
      width,
      height,
      worldZ,
    );
    return copyPose(this.interaction);
  }

  public release(time: number): void {
    if (!this.interaction) return;
    this.releaseStrike = deriveStrikeMetrics(
      this.history,
      this.lastCanvasHeight,
      time,
    );
    this.releaseStrikeCapturedAt = time;
    this.interaction.pointerDown = false;
    this.interaction.phase = "follow";
    this.contactFollowUntil = this.pointerType === "touch"
      ? time + CONTACT_RELEASE_GRACE_TOUCH_SEC
      : this.pointerType === "mouse" || this.pointerType === "pen"
        ? time + CONTACT_RELEASE_GRACE_FINE_SEC
        : time;
  }

  public reset(): void {
    this.metrics = ZERO_STROKE_METRICS;
    this.releaseStrike = ZERO_STRIKE_METRICS;
    this.releaseStrikeCapturedAt = 0;
    this.history.length = 0;
    this.debugStroke = [];
    this.latestSample = null;
    this.pointerType = null;
    this.contactFollowUntil = 0;
    this.lastInputTime = 0;
    this.pointerAgeMs = 0;
    this.predictionMs = 0;
    this.predictionDistancePx = 0;
    this.targetAngle = Math.PI / 2;
    this.targetTilt = 0;
    if (this.interaction) {
      this.interaction.pointerDown = false;
      this.interaction.pointerType = null;
      this.interaction.phase = "recover";
    }
  }

  public beginContact(time: number): void {
    if (!this.interaction) return;
    this.interaction.phase = "contact";
    this.interaction.contactFlash = 1;
    if (!this.interaction.pointerDown) {
      this.contactFollowUntil = Math.min(this.contactFollowUntil, time);
    }
  }

  public isContactEligible(time: number): boolean {
    const phase = this.interaction?.phase;
    return this.pointerType !== null && (
      phase === "tracking" ||
      phase === "armed" ||
      (phase === "follow" && withinDeadline(time, this.contactFollowUntil))
    );
  }

  public stepFixed(
    width: number,
    height: number,
    worldZ: number,
    viewZ: number,
  ): PaddleStepSegment | null {
    this.ensurePose(width, height, worldZ, viewZ);
    if (!this.interaction) return null;
    const previous = copyPose(this.previousFixed ?? this.interaction);
    this.interaction.worldZ = worldZ;
    this.interaction.worldX = this.worldX(
      this.interaction.screenX,
      width,
      height,
      worldZ,
    );
    const current = copyPose(this.interaction);
    this.previousFixed = copyPose(current);
    return { previous, current };
  }

  public getRenderPose(): PaddlePose | null {
    return this.interaction ? copyPose(this.interaction) : null;
  }

  public getStrikeMetrics(time: number): StrikeMetrics {
    if (this.interaction?.pointerDown) {
      return deriveStrikeMetrics(this.history, this.lastCanvasHeight, time);
    }
    if (
      this.interaction?.phase !== "follow" ||
      !withinDeadline(time, this.contactFollowUntil)
    ) {
      return { ...ZERO_STRIKE_METRICS };
    }
    const releasedAge = this.releaseStrike.age + Math.max(
      0,
      time - this.releaseStrikeCapturedAt,
    );
    return {
      ...this.releaseStrike,
      age: releasedAge,
      active:
        this.releaseStrike.active &&
        withinDeadline(releasedAge, STRIKE_ACTIVE_MAX_AGE_SEC),
    };
  }

  public setLevelAssistScale(scale: number): void {
    this.levelAssistScale =
      Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  public getAssistScale(): number | null {
    if (!this.pointerType) return null;
    const base = this.pointerType === "touch"
      ? CONTACT_ASSIST_TOUCH
      : CONTACT_ASSIST_FINE;
    return base * this.levelAssistScale;
  }

  public getDebugState(time: number): PaddleDebugState {
    const strike = this.getStrikeMetrics(time);
    return {
      pointerAgeMs: this.pointerAgeMs,
      predictionMs: this.predictionMs,
      predictionDistancePx: this.predictionDistancePx,
      strikeActive: strike.active,
      strikeSpeed: strike.speed,
      assistScale: this.getAssistScale(),
      contactGraceMs:
        this.interaction?.phase === "follow"
          ? Math.max(0, Math.round((this.contactFollowUntil - time) * 1_000))
          : 0,
    };
  }

  public getDebugStroke(): readonly PointerSample[] {
    return this.debugStroke;
  }

  private updatePoseTarget(strike: StrikeMetrics): void {
    if (!strike.active) {
      this.targetAngle = Math.PI / 2;
      this.targetTilt = 0;
      return;
    }
    this.targetAngle = Math.atan2(strike.vy, strike.vx) + Math.PI / 2;
    this.targetTilt = clamp(
      strike.directionY + strike.curvature * 0.4,
      -1,
      1,
    );
  }

  private baseCenter(
    sample: PointerSample,
    width: number,
    height: number,
    viewZ: number,
  ): { screenX: number; screenY: number } {
    const radius = paddleScreenRadius(width, height, paddleDepthRatio(viewZ));
    const bladeRadius = radius * PADDLE_BLADE_SCALE;
    const offset = sample.pointerType === "touch"
      ? POINTER_OFFSET_TOUCH
      : POINTER_OFFSET_FINE;
    const screenX = clamp(sample.stageX * width, bladeRadius, width - bladeRadius);
    const rawY = sample.stageY * height - offset * height;
    const screenY = clampPaddleScreenY(
      clamp(rawY, height * PADDLE_SCREEN_Y_MIN, height * PADDLE_SCREEN_Y_MAX),
      height,
      radius,
    );
    return { screenX, screenY };
  }

  private worldX(
    screenX: number,
    width: number,
    height: number,
    worldZ: number,
  ): number {
    return clamp(
      unprojectScreenXAtZ(
        createProjectionCamera(width, height),
        screenX,
        worldZ,
      ),
      -PADDLE_LIMIT,
      PADDLE_LIMIT,
    );
  }

  private ensurePose(
    width: number,
    height: number,
    worldZ: number,
    viewZ: number,
  ): void {
    if (this.interaction || width <= 0 || height <= 0) return;
    const radius = paddleScreenRadius(width, height, paddleDepthRatio(viewZ));
    const screenX = width / 2;
    const pose: PaddlePose = {
      screenX,
      screenY: clampPaddleScreenY(height * PADDLE_SCREEN_Y, height, radius),
      worldX: 0,
      worldZ,
      velocityX: 0,
      velocityY: 0,
      angle: Math.PI / 2,
      tilt: 0,
      pointerDown: false,
      phase: "idle",
      contactFlash: 0,
      pointerType: null,
    };
    this.interaction = pose;
    this.previousFixed = copyPose(pose);
  }
}
