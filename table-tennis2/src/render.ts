// v0.3.0 §5.1: Renderer は「レイヤ管理・描画順・イベント消費・エフェクト状態・debug計測」だけを担う
// orchestrator。作画は src/render/*.ts、エフェクトの純粋モデルは src/view/effects.ts。
// カメラは computeCamera() の結果だけを使い、演出由来の加算をしない（N-4）。
import {
  EFFECT_DT_MAX_SEC,
  OPPONENT_LEAN_GAIN,
  OPPONENT_LEAN_MAX,
  SERVE_ZONE_Z,
} from "./config.ts";
import type { RenderScene, Viewport, VisualEvent } from "./types.ts";
import { clamp, moveToward } from "./utils.ts";
import { computeCamera } from "./view/camera.ts";
import {
  createEffectState,
  effectPolicy,
  mulberry32,
  renderOrder,
  spawnFromEvent,
  stepEffects,
  type EffectPolicy,
  type EffectState,
  type RenderStep,
} from "./view/effects.ts";
import type { ProjectionCamera } from "./view/projection.ts";
import { drawOpponent, drawPlayerPaddle } from "./render/actors.ts";
import {
  drawBall,
  drawBallShadow,
  drawDeadBall,
  drawDebugStroke,
  drawEffects,
  drawMark,
  drawPlayerContactGuide,
  drawServeZone,
  drawTrail,
} from "./render/effects-draw.ts";
import { drawEnvironment } from "./render/environment.ts";
import { LayerCache, type SceneSurface } from "./render/layers.ts";
import { drawNetMesh, drawTableLayer } from "./render/table.ts";

/** エフェクト乱数の固定 seed。見た目に再現性を持たせる（Game.random には触れない）。 */
const EFFECT_SEED = 0x9e3779b9;
const SMASH_GLOW_HZ = 6;
const OPPONENT_SWAY_HZ = 0.9;
const OPPONENT_SWAY_AMP = 1.2;
const OPPONENT_LEAN_SPEED = 6;
const RENDER_SAMPLE_WINDOW = 60;

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly camera: ProjectionCamera = {
    x: 0,
    y: 190,
    z: -330,
    f: 0,
    cx: 0,
    cy: 0,
  };
  private readonly backdropLayer = new LayerCache();
  private readonly tableLayer = new LayerCache();
  private readonly effects: EffectState = createEffectState();
  private readonly effectRandom = mulberry32(EFFECT_SEED);
  private policy: EffectPolicy = effectPolicy(false);
  private lastSimulationTime = 0;
  private opponentLean = 0;
  private readonly renderSamples: number[] = [];

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getScene: () => RenderScene,
    private readonly drainEvents: () => VisualEvent[] = () => [],
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2Dコンテキストを取得できません。");
    }
    this.context = context;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.visualViewport?.addEventListener("resize", this.resize);
    window.addEventListener("orientationchange", this.onOrientationChange);
  }

  public getViewport(): Viewport {
    return { width: this.width, height: this.height };
  }

  /** §5.11.1: prefers-reduced-motion の反映。 */
  public setReducedMotion(reduced: boolean): void {
    this.policy = effectPolicy(reduced);
  }

  public render(): void {
    const started = performance.now();
    const scene = this.getScene();

    const dt = scene.simulationTime - this.lastSimulationTime;
    this.lastSimulationTime = scene.simulationTime;
    stepEffects(this.effects, dt);
    for (const event of this.drainEvents()) {
      spawnFromEvent(
        this.effects,
        event,
        scene.simulationTime,
        this.policy,
        this.effectRandom,
      );
    }
    // 次のポイントの球が動き出したら死球は消す（§5.4.4）。
    if (this.effects.deadBall && scene.ball.live) {
      this.effects.deadBall = null;
    }
    this.updateOpponentLean(scene, Math.min(Math.max(0, dt), EFFECT_DT_MAX_SEC));

    this.context.clearRect(0, 0, this.width, this.height);
    for (const step of renderOrder(scene, this.effects)) {
      this.runStep(step, scene);
    }

    this.syncDebugMetrics(scene, performance.now() - started);
  }

  public destroy(): void {
    window.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("resize", this.resize);
    window.removeEventListener("orientationchange", this.onOrientationChange);
  }

  private get surface(): SceneSurface {
    return {
      context: this.context,
      camera: this.camera,
      width: this.width,
      height: this.height,
    };
  }

  private runStep(step: RenderStep, scene: RenderScene): void {
    switch (step) {
      case "backdrop":
        this.paintLayer(this.backdropLayer, (context, width, height) => {
          drawEnvironment({
            context,
            camera: this.camera,
            width,
            height,
          });
        });
        return;
      case "opponent":
        drawOpponent(this.surface, scene, {
          lean: this.opponentLean,
          sway: this.policy.opponentIdleSway
            ? Math.sin(
                scene.simulationTime * Math.PI * 2 * OPPONENT_SWAY_HZ,
              ) * OPPONENT_SWAY_AMP
            : 0,
        });
        return;
      case "table":
        this.paintLayer(this.tableLayer, (context, width, height) => {
          drawTableLayer({ context, camera: this.camera, width, height });
        });
        return;
      case "serveZone":
        drawServeZone(
          this.surface,
          SERVE_ZONE_Z[scene.game.selectedServeLength],
        );
        return;
      case "mark":
        drawMark(this.surface, scene);
        return;
      case "contactGuide":
        drawPlayerContactGuide(this.surface, scene);
        return;
      case "ballShadow":
        drawBallShadow(this.surface, scene);
        return;
      case "trail":
        drawTrail(this.surface, scene);
        return;
      case "ball":
        drawBall(this.surface, scene, this.smashGlowAlpha(scene));
        return;
      case "deadBall":
        if (this.effects.deadBall) {
          drawDeadBall(
            this.surface,
            this.effects.deadBall,
            this.effects.simulationTime,
          );
        }
        return;
      case "net":
        drawNetMesh(this.surface, this.effects.netWobble);
        return;
      case "effects":
        drawEffects(this.surface, this.effects);
        return;
      case "playerPaddle":
        drawPlayerPaddle(this.surface, scene);
        return;
      case "debugStroke":
        drawDebugStroke(this.surface, scene);
    }
  }

  private paintLayer(
    cache: LayerCache,
    draw: (
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
    ) => void,
  ): void {
    const image = cache.ensure(this.width, this.height, this.dpr, draw);
    if (!image) return;
    this.context.drawImage(image, 0, 0, this.width, this.height);
  }

  /** §5.4.5: スマッシュ可能時のグロー。reduced-motion では脈動せず alpha 0.30 固定。 */
  private smashGlowAlpha(scene: RenderScene): number {
    if (!scene.smashable) return 0;
    if (!this.policy.smashGlowPulse) return 0.3;
    return (
      0.3 +
      0.05 * Math.sin(scene.simulationTime * Math.PI * 2 * SMASH_GLOW_HZ)
    );
  }

  /** §5.6: 構えの傾き。描画専用の状態で、OpponentAi.state は読み取りだけ。 */
  private updateOpponentLean(scene: RenderScene, dt: number): void {
    const target =
      scene.ball.live && scene.ball.hitter === "P"
        ? clamp(
            (scene.ball.x - scene.opponent.x) * OPPONENT_LEAN_GAIN,
            -OPPONENT_LEAN_MAX,
            OPPONENT_LEAN_MAX,
          )
        : 0;
    this.opponentLean = moveToward(
      this.opponentLean,
      target,
      OPPONENT_LEAN_SPEED * dt,
    );
  }

  /** §5.11.2: `?debugInput=1` のときだけ計測を dataset へ出す。製品既定経路では計測しない。 */
  private syncDebugMetrics(scene: RenderScene, elapsedMs: number): void {
    if (!scene.debugInput) return;
    const body = document.body;
    body.dataset.particlesLive = String(this.effects.particles.length);
    body.dataset.ringsLive = String(this.effects.rings.length);
    body.dataset.effectsSimTime = this.effects.simulationTime.toFixed(3);
    body.dataset.deadBall = this.effects.deadBall ? "1" : "0";
    this.renderSamples.push(elapsedMs);
    if (this.renderSamples.length < RENDER_SAMPLE_WINDOW) return;
    const sorted = [...this.renderSamples].sort((a, b) => a - b);
    this.renderSamples.length = 0;
    const at = (ratio: number): string =>
      (
        sorted[
          Math.min(
            sorted.length - 1,
            Math.max(0, Math.ceil(ratio * sorted.length) - 1),
          )
        ] ?? 0
      ).toFixed(3);
    body.dataset.renderMsP50 = at(0.5);
    body.dataset.renderMsP95 = at(0.95);
  }

  private readonly resize = (): void => {
    const coarsePointer =
      window.matchMedia?.("(pointer: coarse)").matches ?? false;
    this.dpr = Math.min(coarsePointer ? 2 : 3, window.devicePixelRatio || 1);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    const nextWidth = Math.round(this.width * this.dpr);
    const nextHeight = Math.round(this.height * this.dpr);
    if (
      this.canvas.width !== nextWidth ||
      this.canvas.height !== nextHeight
    ) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    Object.assign(this.camera, computeCamera(this.width, this.height));
  };

  private readonly onOrientationChange = (): void => {
    this.resize();
    window.setTimeout(this.resize, 250);
  };
}
