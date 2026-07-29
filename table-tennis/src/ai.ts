import {
  AI_CHOP_MAX_Y,
  AI_CHOP_SPIN_MAX,
  AI_CONTACT_Y_MAX,
  AI_CONTACT_Y_MIN,
  AI_LOB_MAX_Y,
  AI_SMASH_MIN_Y,
  AZ,
  FLOOR,
  HW,
  LEVELS,
  PADDLE_LIMIT,
} from "./config.ts";
import { predictAt } from "./physics.ts";
import { chooseWeightedServe } from "./rules.ts";
import type {
  AiState,
  BallState,
  BallVector,
  LevelId,
  ServeType,
  ShotId,
} from "./types.ts";
import { clamp, moveToward } from "./utils.ts";

export interface AiShotDecision {
  type: ShotId;
  aim: number;
  depth: number;
  quality: number;
  blunder: number;
}

export class OpponentAi {
  private readonly random: () => number;

  public readonly state: AiState = {
    x: 0,
    tx: 0,
    z: AZ,
    viewZ: AZ,
    swing: 0,
    swingType: 0,
    react: -1,
    nextRefine: 0,
    plan: null,
  };

  public constructor(random: () => number) {
    this.random = random;
  }

  public reset(): void {
    this.state.x = 0;
    this.state.tx = 0;
    this.state.plan = null;
  }

  public plan(
    ball: BallVector,
    simulationTime: number,
    level: LevelId,
  ): void {
    const config = LEVELS[level];
    this.state.react = simulationTime + config.delay;
    this.state.nextRefine = simulationTime + config.refine;
    this.state.plan = null;
    this.refine(ball, config.perr);
  }

  public update(
    dt: number,
    simulationTime: number,
    ball: BallVector,
    level: LevelId,
  ): void {
    const config = LEVELS[level];
    if (this.state.plan && simulationTime > this.state.react) {
      if (simulationTime > this.state.nextRefine) {
        this.state.nextRefine = simulationTime + config.refine;
        this.refine(ball, config.perr * 0.45);
      }
      this.state.x = moveToward(
        this.state.x,
        this.state.plan.x,
        config.speed * dt,
      );
    }
    this.state.x = clamp(
      this.state.x,
      -PADDLE_LIMIT,
      PADDLE_LIMIT,
    );
  }

  public decideShot(
    ball: BallState,
    playerX: number,
    level: LevelId,
  ): AiShotDecision | null {
    const config = LEVELS[level];
    if (
      Math.abs(ball.x - this.state.x) > config.reach ||
      ball.y < AI_CONTACT_Y_MIN ||
      ball.y > AI_CONTACT_Y_MAX
    ) {
      return null;
    }

    const quality =
      1 - Math.abs(ball.x - this.state.x) / config.reach;
    let type: ShotId;
    if (ball.y < AI_LOB_MAX_Y) {
      type = "LOB";
    } else if (
      ball.y > AI_SMASH_MIN_Y &&
      this.random() < config.smash
    ) {
      type = "SMASH";
    } else if (
      ball.spin < AI_CHOP_SPIN_MAX &&
      ball.y < AI_CHOP_MAX_Y
    ) {
      type = this.random() < config.chop ? "CHOP" : "PUSH";
    } else if (this.random() < config.chop * 0.5) {
      type = "CHOP";
    } else {
      type = "DRIVE";
    }

    const aim =
      level === "hard"
        ? -Math.sign(playerX || 1) *
          HW *
          0.72 *
          (0.6 + 0.4 * this.random())
        : (this.random() * 2 - 1) * HW * 0.8 * config.spread;
    const depth = config.depth * (0.82 + 0.3 * this.random());
    const blunder = this.random() < config.miss ? 0.075 : 0;
    return {
      type,
      aim,
      depth,
      quality: Math.max(0.25, quality),
      blunder,
    };
  }

  public chooseServe(
    level: LevelId,
  ): { serveType: ServeType; aim: number } {
    const config = LEVELS[level];
    return {
      serveType: chooseWeightedServe(level, this.random),
      aim:
        (this.random() * 2 - 1) *
        HW *
        0.7 *
        config.spread,
    };
  }

  private refine(ball: BallVector, error: number): void {
    const prediction = predictAt(ball, this.state.z, 1, FLOOR);
    if (prediction) {
      this.state.plan = {
        x: prediction.x + (this.random() * 2 - 1) * error,
        y: prediction.y,
      };
    }
  }
}
