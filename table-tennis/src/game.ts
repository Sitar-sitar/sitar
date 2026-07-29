import { OpponentAi } from "./ai.ts";
import {
  AI_SERVE_DELAY_MS,
  AZ,
  CONTACT_PLANE_FAR,
  CONTACT_PLANE_NEAR,
  FIXED_STEP,
  FLOOR,
  HL,
  HW,
  LEVELS,
  LOB_MAX_Y,
  MAX_SUBSTEPS,
  NET_H,
  NET_HW,
  PADDLE_LIMIT,
  PLAYER_CONTACT_Y_MAX,
  PLAYER_CONTACT_Y_MIN,
  POINT_INTERVAL,
  P_REACH,
  P_SPEED,
  PLAYER_AIM_SPAN,
  PZ,
  RESULT_DELAY_MS,
  SERVE_BALL_Y,
  SERVE_CONTACT_Y,
  SERVE_PROFILES,
  SHOT_ORIGIN_Y_MIN,
  SHOTS,
  SMASH_CHECK_INTERVAL,
  SMASH_MIN_Y,
  SMASH_REACH_MARGIN,
  SWING_DECAY,
  TRAIL_LENGTH,
} from "./config.ts";
import { Feedback } from "./feedback.ts";
import { InputController } from "./input.ts";
import {
  ensureNetClear,
  integrate,
  launch,
  onTable,
  predictAt,
  simLand,
  solveAngle,
  solveServe,
  solveSpeed,
  tableBounce,
} from "./physics.ts";
import { Renderer } from "./render.ts";
import {
  isGameOver,
  opponentOf,
  resolveMiss,
  rotateServerAfterPoint,
  swingTypeOf,
} from "./rules.ts";
import type {
  BallState,
  BallVector,
  Flick,
  GameState,
  LevelId,
  Mark,
  MatchResult,
  PaddleState,
  PlayerRecord,
  RenderScene,
  ServeSolution,
  ServeType,
  ShotId,
  Side,
} from "./types.ts";
import { Ui } from "./ui.ts";
import { clamp, moveToward, stepViewZ } from "./utils.ts";

export class Game {
  public onMatchEnd?: (result: MatchResult) => void;

  public readonly state: GameState = {
    phase: "title",
    paused: false,
    level: "mid",
    levelConfig: LEVELS.mid,
    scP: 0,
    scA: 0,
    server: "P",
    servedCount: 0,
    rally: 0,
    maxRally: 0,
    pointTimer: 0,
    sound: true,
    vibe: true,
    played: 0,
    selectedServeType: "topspin",
  };

  private readonly ball: BallState = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    side: 0,
    live: false,
    hitter: "P",
    bounces: 0,
    bSide: 0,
    serveStage: 0,
  };

  private readonly player: PaddleState = {
    x: 0,
    tx: 0,
    z: PZ,
    viewZ: PZ,
    swing: 0,
    swingType: 0,
  };

  private readonly ai: OpponentAi;
  private readonly trail: Pick<BallVector, "x" | "y" | "z">[] = [];
  private mark: Mark | null = null;
  private smashable = false;
  private smashCheck = 0;
  private simulationTime = 0;
  private serveTimer = 0;
  private serveGeneration = 0;
  private input: InputController | null = null;
  private renderer: Renderer | null = null;
  private lastFrame = 0;
  private accumulator = 0;
  private loopStarted = false;
  private matchSeq = 0;
  private matchPlayer: PlayerRecord | null = null;
  private matchStartedAt = 0;
  private matchStartedAtIso = "";
  private currentPlayer: PlayerRecord | null = null;

  public constructor(
    private readonly ui: Ui,
    private readonly feedback: Feedback,
    private readonly random: () => number = Math.random,
  ) {
    this.ai = new OpponentAi(random);
  }

  public attach(input: InputController, renderer: Renderer): void {
    this.input = input;
    this.renderer = renderer;
  }

  public setPlayer(player: PlayerRecord | null): void {
    this.currentPlayer = player;
  }

  public bindUi(): void {
    this.ui.bind({
      start: () => {
        this.feedback.initializeAudio();
        this.newGame();
      },
      playAgain: () => {
        this.feedback.initializeAudio();
        this.newGame();
      },
      backToTitle: () => {
        this.backToTitle();
      },
      pause: () => {
        this.pause();
      },
      resume: () => {
        this.resume();
      },
      quit: () => {
        this.backToTitle();
      },
      selectLevel: (level) => {
        this.selectLevel(level);
      },
      selectServe: (serveType) => {
        this.selectServe(serveType);
      },
      toggleSound: () => {
        this.state.sound = !this.state.sound;
        this.feedback.initializeAudio();
        this.ui.syncToggles(this.state);
      },
      toggleVibration: () => {
        this.state.vibe = !this.state.vibe;
        this.feedback.buzz(20);
        this.ui.syncToggles(this.state);
      },
    });
  }

  public start(): void {
    this.ui.updateHud(this.state);
    this.ui.updateLevelSelection(this.state.level);
    this.ui.updateServeControls(this.state);
    this.ui.syncToggles(this.state);
    if (!this.loopStarted) {
      this.loopStarted = true;
      requestAnimationFrame(this.loop);
    }
  }

  public getRenderScene(): RenderScene {
    return {
      game: this.state,
      ball: this.ball,
      player: this.player,
      opponent: this.ai.state,
      trail: this.trail,
      mark: this.mark,
      smashable: this.smashable,
    };
  }

  public updatePlayerTarget(clientX: number): void {
    const width = Math.max(1, this.renderer?.getViewport().width ?? 1);
    this.player.tx = clamp(
      (clientX / width - 0.5) * PLAYER_AIM_SPAN,
      -PADDLE_LIMIT,
      PADDLE_LIMIT,
    );
  }

  public tryPlayerServe(flick: Flick | null): boolean {
    if (
      this.state.phase !== "serve" ||
      this.state.server !== "P" ||
      this.state.paused ||
      this.ball.live
    ) {
      return false;
    }
    const aim =
      this.player.x * 0.6 + (flick ? flick.vx * 40 : 0);
    return this.doServe(
      "P",
      aim,
      this.state.selectedServeType,
      flick ? 0.012 : 0.014,
    );
  }

  public handleVisibilityChange(): void {
    if (
      document.hidden &&
      ["serve", "rally", "point"].includes(this.state.phase)
    ) {
      this.pause();
    }
  }

  public handlePageShow(): void {
    this.lastFrame = 0;
    this.accumulator = 0;
  }

  public handlePageHide(): void {
    this.cancelServeTimer();
    this.input?.reset();
  }

  private readonly loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);
    const seconds = timestamp / 1000;
    const dt = this.lastFrame
      ? Math.min(0.05, seconds - this.lastFrame)
      : 0;
    this.lastFrame = seconds;

    if (this.state.phase !== "title" && !this.state.paused) {
      this.accumulator += dt;
      let steps = 0;
      while (
        this.accumulator >= FIXED_STEP &&
        steps < MAX_SUBSTEPS
      ) {
        this.tick(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        steps += 1;
      }
      if (steps >= MAX_SUBSTEPS) {
        this.accumulator = 0;
      }
    }

    this.ui.tickFlash(dt);
    this.player.swing = Math.max(
      0,
      this.player.swing - dt * SWING_DECAY,
    );
    this.ai.state.swing = Math.max(
      0,
      this.ai.state.swing - dt * SWING_DECAY,
    );
    this.renderer?.render();
  };

  private tick(dt: number): void {
    this.simulationTime += dt;
    this.player.x = moveToward(
      this.player.x,
      this.player.tx,
      P_SPEED * dt,
    );
    this.player.viewZ = stepViewZ(
      this.player.viewZ,
      this.player.z,
      dt,
    );

    this.ai.update(
      dt,
      this.simulationTime,
      this.ball,
      this.state.level,
    );
    this.updatePhysics(dt);

    if (this.state.phase === "point") {
      this.state.pointTimer -= dt;
      if (this.state.pointTimer <= 0) {
        this.startServe();
      }
    }
    if (this.state.phase === "rally") {
      this.ui.updateHud(this.state);
    }
  }

  private newGame(): void {
    this.cancelServeTimer();
    this.matchSeq += 1;
    this.matchPlayer = this.currentPlayer;
    this.matchStartedAt = performance.now();
    this.matchStartedAtIso = new Date().toISOString();
    this.state.paused = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.input?.reset();
    this.state.scP = 0;
    this.state.scA = 0;
    this.state.server = this.random() < 0.5 ? "P" : "A";
    this.state.servedCount = 0;
    this.state.phase = "serve";
    this.state.rally = 0;
    this.state.maxRally = 0;
    this.player.x = 0;
    this.player.tx = 0;
    this.ai.reset();
    this.state.played += 1;
    this.ui.showGame();
    this.ui.updateHud(this.state);
    this.startServe();
  }

  private selectLevel(level: LevelId): void {
    this.state.level = level;
    this.state.levelConfig = LEVELS[level];
    this.ui.updateLevelSelection(level);
    this.ui.updateHud(this.state);
  }

  private selectServe(serveType: ServeType): void {
    if (
      this.state.phase !== "serve" ||
      this.state.server !== "P" ||
      this.state.paused
    ) {
      return;
    }
    this.state.selectedServeType = serveType;
    this.ui.updateServeControls(this.state);
    this.ui.updateHud(this.state);
  }

  private pause(): void {
    if (
      !["serve", "rally", "point"].includes(this.state.phase) ||
      this.state.paused
    ) {
      return;
    }
    this.cancelServeTimer();
    this.state.paused = true;
    this.input?.reset();
    this.ui.showPause(this.state);
    this.ui.updateServeControls(this.state);
    this.ui.syncToggles(this.state);
  }

  private resume(): void {
    if (!this.state.paused) {
      return;
    }
    this.state.paused = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.ui.hidePause();
    this.ui.updateServeControls(this.state);
    if (this.state.phase === "serve" && this.state.server === "A") {
      this.startServe();
    }
  }

  private backToTitle(): void {
    this.cancelServeTimer();
    this.state.paused = false;
    this.state.phase = "title";
    this.ball.live = false;
    this.input?.reset();
    this.ui.showTitle();
    this.ui.hint([]);
    this.ui.updateHud(this.state);
    this.ui.updateServeControls(this.state);
  }

  private cancelServeTimer(): void {
    this.serveGeneration += 1;
    if (this.serveTimer) {
      window.clearTimeout(this.serveTimer);
      this.serveTimer = 0;
    }
  }

  private startServe(): void {
    this.cancelServeTimer();
    this.state.phase = "serve";
    this.ball.live = false;
    this.trail.length = 0;
    this.mark = null;
    this.smashable = false;
    const playerServes = this.state.server === "P";
    this.ball.x = playerServes
      ? this.player.x * 0.5
      : this.ai.state.x * 0.5;
    this.ball.z = playerServes ? PZ + 6 : AZ - 6;
    this.player.z = PZ;
    this.player.viewZ = PZ;
    this.ai.state.z = AZ;
    this.ai.state.viewZ = AZ;
    this.ball.y = SERVE_BALL_Y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.spin = 0;
    this.ball.side = 0;
    this.state.rally = 0;
    this.ui.hint(
      playerServes
        ? [
            "サーブを選び、台上を左右にフリック",
            "またはタップしてサーブ",
          ]
        : [],
    );
    this.ui.updateHud(this.state);
    this.ui.updateServeControls(this.state);

    if (!playerServes) {
      this.scheduleAiServe();
    }
  }

  private scheduleAiServe(): void {
    const generation = this.serveGeneration;
    this.serveTimer = window.setTimeout(() => {
      this.serveTimer = 0;
      if (
        generation === this.serveGeneration &&
        this.state.phase === "serve" &&
        this.state.server === "A" &&
        !this.state.paused
      ) {
        this.aiServe();
      }
    }, AI_SERVE_DELAY_MS);
  }

  private aiServe(): void {
    const { serveType, aim } = this.ai.chooseServe(
      this.state.level,
    );
    if (
      !this.doServe(
        "A",
        aim,
        serveType,
        LEVELS[this.state.level].serveErr,
      )
    ) {
      this.scheduleAiServe();
    }
  }

  private findServeSolution(
    who: Side,
    aimX: number,
    serveType: ServeType,
  ): {
    solution: ServeSolution;
    serveType: ServeType;
    spin: number;
    side: number;
  } | null {
    const direction = who === "P" ? 1 : -1;
    const from = {
      x: this.ball.x,
      y: SERVE_CONTACT_Y,
      z: this.ball.z,
    };
    const profile = SERVE_PROFILES[serveType];
    const side = profile.screenCurve;
    let solution = solveServe(
      from,
      aimX,
      profile.spin,
      side,
      direction,
    );
    if (!solution.ok && aimX !== 0) {
      solution = solveServe(
        from,
        0,
        profile.spin,
        side,
        direction,
      );
    }
    if (solution.ok) {
      return {
        solution,
        serveType,
        spin: profile.spin,
        side,
      };
    }

    if (who === "A" && serveType !== "knuckle") {
      const fallback = SERVE_PROFILES.knuckle;
      solution = solveServe(from, 0, fallback.spin, 0, direction);
      if (solution.ok) {
        return {
          solution,
          serveType: "knuckle",
          spin: fallback.spin,
          side: 0,
        };
      }
    }
    return null;
  }

  private doServe(
    who: Side,
    aimX: number,
    serveType: ServeType,
    error: number,
  ): boolean {
    const resolved = this.findServeSolution(who, aimX, serveType);
    if (!resolved) {
      if (who === "P") {
        this.ui.flash(
          "サーブを作れませんでした",
          "#ff8a6b",
          1,
        );
        this.ui.hint(["もう一度操作してください"]);
      }
      return false;
    }

    const from = {
      x: this.ball.x,
      y: SERVE_CONTACT_Y,
      z: this.ball.z,
    };
    const elevation =
      resolved.solution.elev + (this.random() * 2 - 1) * error;
    const azimuth =
      resolved.solution.azim +
      (this.random() * 2 - 1) * error * 1.4;
    const speed =
      resolved.solution.speed *
      (1 + (this.random() * 2 - 1) * error * 1.2);
    const velocity = launch(speed, elevation, azimuth);

    Object.assign(this.ball, from, velocity);
    this.ball.spin = resolved.spin;
    this.ball.side = resolved.side;
    this.ball.hitter = who;
    this.ball.bounces = 0;
    this.ball.serveStage = 1;
    this.ball.live = true;
    this.trail.length = 0;
    this.state.phase = "rally";
    this.state.rally = 1;
    this.feedback.hit(0.35);
    this.ui.flash(
      `${SERVE_PROFILES[resolved.serveType].label}サーブ`,
      "#9fb0bd",
      0.6,
    );
    if (who === "P") {
      this.player.swing = 1;
      this.player.swingType = 0;
      this.ai.state.z = this.contactPlane("A");
      this.ai.plan(
        this.ball,
        this.simulationTime,
        this.state.level,
      );
    } else {
      this.ai.state.swing = 1;
      this.player.z = this.contactPlane("P");
      this.planMark();
    }
    this.ui.hint([]);
    this.ui.updateHud(this.state);
    this.ui.updateServeControls(this.state);
    return true;
  }

  private contactPlane(receiver: Side): number {
    const direction = receiver === "P" ? -1 : 1;
    const ball: BallVector = {
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
      vx: this.ball.vx,
      vy: this.ball.vy,
      vz: this.ball.vz,
      spin: this.ball.spin,
      side: this.ball.side,
    };
    const dt = 1 / 240;
    let previousY: number;
    let previousZ: number;
    let bounced = false;

    for (let time = 0; time < 3; time += dt) {
      previousY = ball.y;
      previousZ = ball.z;
      integrate(ball, dt);
      if (previousY > 0 && ball.y <= 0) {
        if (!onTable(ball.x, ball.z)) {
          break;
        }
        if (!bounced) {
          ball.y = 0;
          if (Math.sign(ball.z) === direction) {
            bounced = true;
          }
          tableBounce(ball);
          continue;
        }
        return this.clampPlane(previousZ, direction);
      }
      if (bounced && ball.vy < 0 && ball.y <= 22) {
        return this.clampPlane(ball.z, direction);
      }
      if (ball.y < FLOOR) {
        break;
      }
    }
    return direction < 0 ? PZ : AZ;
  }

  private clampPlane(z: number, direction: number): number {
    return direction < 0
      ? Math.max(
          -CONTACT_PLANE_FAR,
          Math.min(-CONTACT_PLANE_NEAR, z),
        )
      : Math.min(
          CONTACT_PLANE_FAR,
          Math.max(CONTACT_PLANE_NEAR, z),
        );
  }

  private makeShot(
    who: Side,
    type: ShotId,
    aimX: number,
    depth: number,
    contactQuality: number,
    extraError: number,
  ): void {
    const direction = who === "P" ? 1 : -1;
    const shot = SHOTS[type];
    const from = {
      x: this.ball.x,
      y: Math.max(this.ball.y, SHOT_ORIGIN_Y_MIN),
      z: this.ball.z,
    };
    const targetZ =
      direction * Math.max(24, Math.min(HL - 14, depth));
    const targetX = Math.max(-HW + 7, Math.min(HW - 7, aimX));
    const side = (this.random() - 0.5) * 0.25;
    const spin = shot.spin;
    let elevation: number;
    let azimuth: number;
    let speed: number;

    if (type === "LOB") {
      const result = solveSpeed(
        from,
        targetX,
        targetZ,
        1.02,
        spin,
        side,
      );
      speed = result.speed;
      azimuth = result.azim;
      elevation = 1.02;
    } else {
      speed =
        shot.sp[0] + this.random() * (shot.sp[1] - shot.sp[0]);
      if (type === "SMASH") {
        speed *=
          0.86 +
          0.14 * Math.min(1, Math.max(0, (this.ball.y - 20) / 30));
      }
      const result = solveAngle(
        from,
        targetX,
        targetZ,
        speed,
        spin,
        side,
      );
      elevation = result.elev;
      azimuth = result.azim;
      if (!extraError && contactQuality > 0.3) {
        elevation = ensureNetClear(
          from,
          elevation,
          azimuth,
          speed,
          spin,
          side,
        );
      }
    }

    const error =
      shot.err + (1 - contactQuality) * 0.055 + extraError;
    elevation += (this.random() * 2 - 1) * error;
    azimuth += (this.random() * 2 - 1) * error * 1.5;
    speed *= 1 + (this.random() * 2 - 1) * error * 1.6;
    const velocity = launch(speed, elevation, azimuth);

    Object.assign(this.ball, from, velocity);
    this.ball.spin = spin;
    this.ball.side = side;
    this.ball.hitter = who;
    this.ball.bounces = 0;
    this.ball.live = true;
    this.ball.serveStage = 0;
    this.trail.length = 0;
    this.feedback.hit(Math.min(1, speed / 1500));

    if (who === "P") {
      this.player.swing = 1;
      this.player.swingType = swingTypeOf(type);
      this.state.rally += 1;
    } else {
      this.ai.state.swing = 1;
    }

    this.ui.flash(
      shot.lab,
      who === "P"
        ? type === "SMASH"
          ? "#ffc24b"
          : "#e8eef3"
        : "#9fb0bd",
      type === "SMASH" ? 1 : 0.7,
    );
    if (who === "P") {
      this.ai.state.z = this.contactPlane("A");
      this.ai.plan(
        this.ball,
        this.simulationTime,
        this.state.level,
      );
    } else {
      this.player.z = this.contactPlane("P");
      this.planMark();
    }
  }

  private planMark(): void {
    const result = simLand(this.ball);
    this.mark =
      result &&
      !result.net &&
      result.z < 0 &&
      onTable(result.x, result.z)
        ? { x: result.x, z: result.z, t: 1 }
        : null;
  }

  private updatePhysics(dt: number): void {
    if (!this.ball.live) {
      return;
    }
    const previousX = this.ball.x;
    const previousY = this.ball.y;
    const previousZ = this.ball.z;
    integrate(this.ball, dt);

    this.trail.push({
      x: this.ball.x,
      y: this.ball.y,
      z: this.ball.z,
    });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }

    if ((previousZ < 0) !== (this.ball.z < 0)) {
      const ratio = (0 - previousZ) / (this.ball.z - previousZ);
      const y = previousY + (this.ball.y - previousY) * ratio;
      const x = previousX + (this.ball.x - previousX) * ratio;
      if (y < NET_H && Math.abs(x) < NET_HW) {
        this.ball.z = 0;
        this.ball.vz *= -0.22;
        this.ball.vy *= 0.35;
        this.ball.vx *= 0.4;
        this.ball.spin *= 0.3;
        this.ball.side *= 0.3;
        this.feedback.net();
        this.point(opponentOf(this.ball.hitter), "ネット");
        return;
      }
    }

    if (previousY > 0 && this.ball.y <= 0) {
      if (onTable(this.ball.x, this.ball.z)) {
        tableBounce(this.ball);
        this.feedback.bounce();
        this.judgeBounce();
      } else {
        const miss = resolveMiss(
          this.ball.bounces,
          this.ball.hitter,
        );
        this.point(miss.winner, miss.reason);
        return;
      }
    }

    if (this.ball.y < FLOOR) {
      const miss = resolveMiss(
        this.ball.bounces,
        this.ball.hitter,
      );
      this.point(miss.winner, miss.reason);
      return;
    }

    if (previousZ > this.player.z && this.ball.z <= this.player.z) {
      this.playerContact();
    }
    if (
      previousZ < this.ai.state.z &&
      this.ball.z >= this.ai.state.z
    ) {
      this.opponentContact();
    }

    if (this.mark) {
      const distance = Math.abs(this.ball.z - this.mark.z);
      this.mark.t = Math.max(0, Math.min(1, distance / 180));
    }

    if (
      this.ball.hitter === "A" &&
      this.ball.bounces >= 1 &&
      this.ball.vz < 0
    ) {
      if (this.simulationTime > this.smashCheck) {
        this.smashCheck =
          this.simulationTime + SMASH_CHECK_INTERVAL;
        const prediction = predictAt(
          this.ball,
          this.player.z,
          -1,
          FLOOR,
        );
        this.smashable = Boolean(
          prediction &&
            prediction.y > SMASH_MIN_Y &&
            Math.abs(prediction.x - this.player.x) <
              P_REACH + SMASH_REACH_MARGIN,
        );
      }
    } else {
      this.smashable = false;
      this.smashCheck = 0;
    }
  }

  private judgeBounce(): void {
    const side: Side = this.ball.z < 0 ? "P" : "A";
    if (this.ball.serveStage === 1) {
      if (side !== this.ball.hitter) {
        this.point(opponentOf(this.ball.hitter), "サーブフォルト");
        return;
      }
      this.ball.serveStage = 2;
      return;
    }
    if (this.ball.serveStage === 2) {
      if (side === this.ball.hitter) {
        this.point(opponentOf(this.ball.hitter), "サーブフォルト");
        return;
      }
      this.ball.serveStage = 0;
      this.ball.bounces = 1;
      return;
    }
    if (this.ball.bounces === 0) {
      if (side === this.ball.hitter) {
        this.point(opponentOf(this.ball.hitter), "自陣に落下");
        return;
      }
      this.ball.bounces = 1;
      return;
    }
    this.point(this.ball.hitter, "返せず");
  }

  private playerContact(): void {
    if (
      this.ball.hitter === "P" ||
      this.ball.bounces < 1 ||
      Math.abs(this.ball.x - this.player.x) > P_REACH ||
      this.ball.y < PLAYER_CONTACT_Y_MIN ||
      this.ball.y > PLAYER_CONTACT_Y_MAX
    ) {
      return;
    }

    const flick = this.input?.currentFlick() ?? null;
    let type: ShotId;
    if (!flick) {
      type = "PUSH";
    } else {
      const upward = -flick.vy;
      const downward = flick.vy;
      if (upward > 0.42 * flick.sp) {
        if (this.ball.y < LOB_MAX_Y) {
          type = "LOB";
        } else if (
          flick.sp > 3 &&
          this.ball.y > SMASH_MIN_Y
        ) {
          type = "SMASH";
        } else {
          type = "DRIVE";
        }
      } else if (downward > 0.42 * flick.sp) {
        type = "CHOP";
      } else {
        type = "PUSH";
      }
      this.input?.clearFlick();
    }

    const quality =
      1 - Math.abs(this.ball.x - this.player.x) / P_REACH;
    const offset = (this.ball.x - this.player.x) / P_REACH;
    const horizontalFlick = flick?.vx ?? 0;
    const aim = -offset * HW * 0.85 + horizontalFlick * 46;
    const depth =
      SHOTS[type].dep *
      (flick ? 0.85 + Math.min(0.45, flick.sp * 0.09) : 1);
    this.makeShot("P", type, aim, depth, quality, 0);
    this.mark = null;
  }

  private opponentContact(): void {
    if (this.ball.hitter === "A" || this.ball.bounces < 1) {
      return;
    }
    const decision = this.ai.decideShot(
      this.ball,
      this.player.x,
      this.state.level,
    );
    if (!decision) {
      return;
    }
    this.makeShot(
      "A",
      decision.type,
      decision.aim,
      decision.depth,
      decision.quality,
      decision.blunder,
    );
  }

  private point(winner: Side, reason: string): void {
    if (this.state.phase === "point" || this.state.phase === "over") {
      return;
    }
    this.state.maxRally = Math.max(
      this.state.maxRally,
      this.state.rally,
    );
    if (winner === "P") {
      this.state.scP += 1;
      this.feedback.win();
    } else {
      this.state.scA += 1;
      this.feedback.lose();
    }
    this.ball.live = false;
    this.mark = null;
    this.smashable = false;
    this.state.phase = "point";
    this.state.pointTimer = POINT_INTERVAL;
    this.ui.flash(
      reason,
      winner === "P" ? "#7ee0a8" : "#ff8a6b",
      1.1,
    );

    const rotation = rotateServerAfterPoint(
      this.state.server,
      this.state.servedCount,
      this.state.scP,
      this.state.scA,
    );
    this.state.server = rotation.server;
    this.state.servedCount = rotation.servedCount;
    this.ui.updateHud(this.state);
    this.ui.updateServeControls(this.state);

    if (isGameOver(this.state.scP, this.state.scA)) {
      this.state.phase = "over";
      const seq = this.matchSeq;
      this.onMatchEnd?.(this.buildMatchResult());
      window.setTimeout(() => {
        if (this.state.phase === "over" && this.matchSeq === seq) {
          this.cancelServeTimer();
          this.ui.showResult(this.state, seq);
        }
      }, RESULT_DELAY_MS);
    }
  }

  private buildMatchResult(): MatchResult {
    const playedAt = new Date().toISOString();
    return {
      matchSeq: this.matchSeq,
      playerId: this.matchPlayer?.id ?? null,
      playerName: this.matchPlayer?.name ?? null,
      level: this.state.level,
      won: this.state.scP > this.state.scA,
      scoreP: this.state.scP,
      scoreA: this.state.scA,
      maxRally: this.state.maxRally,
      startedAt: this.matchStartedAtIso,
      playedAt,
      durationSec: Math.max(
        0,
        Math.round((performance.now() - this.matchStartedAt) / 1_000),
      ),
    };
  }
}
