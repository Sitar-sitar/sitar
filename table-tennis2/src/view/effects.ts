// v0.3.0 §5.1.4 / §5.4.4 / §5.7: 視覚エフェクトの純粋モデル。
// Canvas へは触れない（描画は src/render/effects-draw.ts）。乱数は引数で受け取り、
// Game.random には触れない（N-1）。単位は world cm、時間は秒。
import {
  BOUNCE_RING_RADIUS,
  BOUNCE_RING_TTL_SEC,
  CONTACT_SPARK_COUNT,
  CONTACT_SPARK_SPEED,
  CONTACT_SPARK_TTL_SEC,
  DEAD_BALL_FADE_SEC,
  DEAD_BALL_HOLD_SEC,
  EFFECT_DT_MAX_SEC,
  EFFECT_GRAVITY,
  EFFECT_MAX_PARTICLES,
  FLOOR,
  NET_HW,
  NET_WOBBLE_AMP,
  NET_WOBBLE_DECAY_SEC,
  NET_WOBBLE_HZ,
  NET_WOBBLE_SEC,
  SMASH_STREAK_SEC,
} from "../config.ts";
import { onTable } from "../physics.ts";
import { clamp } from "../utils.ts";
import type { GamePhase, Side, VisualEvent } from "../types.ts";

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  color: string;
}

export interface Ring {
  x: number;
  y: number;
  z: number;
  age: number;
  ttl: number;
}

export interface Streak {
  x: number;
  y: number;
  z: number;
  age: number;
  ttl: number;
}

export interface NetWobble {
  age: number;
}

/** §5.4.4: 得点イベントから作られ、phase / pointTimer に依存しない残留表示。 */
export interface DeadBall {
  x: number;
  y: number;
  z: number;
  startedAt: number;
}

export interface EffectState {
  particles: Particle[];
  rings: Ring[];
  streaks: Streak[];
  netWobble: NetWobble | null;
  deadBall: DeadBall | null;
  /** 系統A（シミュレーション時計）。停止中は進まない。 */
  simulationTime: number;
}

/** §5.11.1: prefers-reduced-motion で止める装飾と、残す情報表示の対応表。 */
export interface EffectPolicy {
  contactSpark: boolean;
  smashStreak: boolean;
  netWobble: boolean;
  hudPulse: boolean;
  opponentIdleSway: boolean;
  smashGlowPulse: boolean;
  bounceRing: boolean;
  deadBall: boolean;
  informational: boolean;
}

export type RenderStep =
  | "backdrop"
  | "opponent"
  | "table"
  | "serveZone"
  | "mark"
  | "contactGuide"
  | "ballShadow"
  | "trail"
  | "ball"
  | "deadBall"
  | "net"
  | "effects"
  | "playerPaddle"
  | "debugStroke";

/** renderOrder() が必要とする RenderScene の最小部分（RenderScene が構造的に満たす）。 */
export interface RenderOrderScene {
  readonly game: {
    readonly phase: GamePhase;
    readonly server: Side;
    readonly paused: boolean;
  };
  readonly ball: { readonly z: number; readonly live: boolean };
  readonly mark: unknown;
  readonly playerContactGuide: unknown;
  readonly debugInput: boolean;
  readonly debugStroke: { readonly length: number };
}

export function createEffectState(): EffectState {
  return {
    particles: [],
    rings: [],
    streaks: [],
    netWobble: null,
    deadBall: null,
    simulationTime: 0,
  };
}

export function effectPolicy(reduced: boolean): EffectPolicy {
  return {
    contactSpark: !reduced,
    smashStreak: !reduced,
    netWobble: !reduced,
    hudPulse: !reduced,
    opponentIdleSway: !reduced,
    smashGlowPulse: !reduced,
    bounceRing: true,
    deadBall: true,
    informational: true,
  };
}

/** §5.1.2: 球がネットより奥（相手コート側）にあるか。 */
export function ballBehindNet(z: number): boolean {
  return z > 0;
}

/** §5.9.1: サーブ着地帯（目安）の表示条件。data-serve-zone の set / delete と同じ判定。 */
export function serveZoneVisible(scene: RenderOrderScene): boolean {
  return (
    scene.game.phase === "serve" &&
    scene.game.server === "P" &&
    !scene.ball.live &&
    !scene.game.paused
  );
}

/** §5.1.2: 描画順を手順名の配列で決める。Renderer はこの配列を順に実行する。 */
export function renderOrder(
  scene: RenderOrderScene,
  effects: EffectState,
): RenderStep[] {
  const steps: RenderStep[] = ["backdrop", "opponent", "table"];
  if (serveZoneVisible(scene)) steps.push("serveZone");
  if (scene.mark) steps.push("mark");
  if (scene.playerContactGuide) steps.push("contactGuide");

  const ballVisible = scene.ball.live || scene.game.phase === "serve";
  const deadBall = effects.deadBall;
  if (ballVisible) steps.push("ballShadow", "trail");
  if (ballVisible && ballBehindNet(scene.ball.z)) steps.push("ball");
  if (deadBall && ballBehindNet(deadBall.z)) steps.push("deadBall");
  steps.push("net");
  if (ballVisible && !ballBehindNet(scene.ball.z)) steps.push("ball");
  if (deadBall && !ballBehindNet(deadBall.z)) steps.push("deadBall");
  steps.push("effects", "playerPaddle");
  if (scene.debugInput && scene.debugStroke.length >= 2) {
    steps.push("debugStroke");
  }
  return steps;
}

/** §5.1.3: 上限付きの push。超過時は最古を捨てる。 */
export function pushBounded<T>(
  buffer: T[],
  item: T,
  limit: number,
): T[] {
  buffer.push(item);
  while (buffer.length > limit) {
    buffer.shift();
  }
  return buffer;
}

/** §5.4.4: 0.50s 保持 → 0.75s で線形に消える。 */
export function deadBallAlpha(age: number): number {
  if (age < DEAD_BALL_HOLD_SEC) {
    return 1;
  }
  return clamp(1 - (age - DEAD_BALL_HOLD_SEC) / DEAD_BALL_FADE_SEC, 0, 1);
}

/** §5.7.3: ネット網の縦線に加える横方向のずれ cm。 */
export function netWobbleOffset(t: number, x: number): number {
  if (t < 0 || t >= NET_WOBBLE_SEC) {
    return 0;
  }
  const span = 1 - Math.min(1, Math.abs(x) / NET_HW);
  return (
    NET_WOBBLE_AMP *
    span *
    Math.exp(-t / NET_WOBBLE_DECAY_SEC) *
    Math.sin(2 * Math.PI * NET_WOBBLE_HZ * t)
  );
}

function sparkCount(passive: boolean, smash: boolean): number {
  if (passive) return CONTACT_SPARK_COUNT.passive;
  return smash ? CONTACT_SPARK_COUNT.smash : CONTACT_SPARK_COUNT.active;
}

function sparkColor(side: Side, smash: boolean): string {
  if (smash) return "#ffc24b";
  return side === "P" ? "#ffe075" : "#dbe5ec";
}

/**
 * §5.1.4 / §5.7: イベントから effect を生成する。
 * `age = max(0, simulationTime − event.time)` を初期経過時間として与え、
 * `age >= ttl` のイベントは何も生成しない（複数 fixed step 分がまとめて届く場合の補正）。
 */
export function spawnFromEvent(
  state: EffectState,
  event: VisualEvent,
  simulationTime: number,
  policy: EffectPolicy,
  random: () => number,
): void {
  const age = Math.max(0, simulationTime - event.time);

  if (event.kind === "contact") {
    const smash = event.shot === "SMASH";
    if (policy.contactSpark && age < CONTACT_SPARK_TTL_SEC) {
      const count = sparkCount(event.passive, smash);
      const color = sparkColor(event.side, smash);
      for (let index = 0; index < count; index += 1) {
        const speed =
          CONTACT_SPARK_SPEED[0] +
          random() * (CONTACT_SPARK_SPEED[1] - CONTACT_SPARK_SPEED[0]);
        const angle = random() * Math.PI * 2;
        const size = 1.2 + random() * 1;
        pushBounded(
          state.particles,
          {
            x: event.x,
            y: event.y,
            z: event.z,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age,
            ttl: CONTACT_SPARK_TTL_SEC,
            size,
            color,
          },
          EFFECT_MAX_PARTICLES,
        );
      }
    }
    if (policy.smashStreak && smash && age < SMASH_STREAK_SEC) {
      state.streaks.push({
        x: event.x,
        y: event.y,
        z: event.z,
        age,
        ttl: SMASH_STREAK_SEC,
      });
    }
    return;
  }

  if (event.kind === "bounce") {
    if (policy.bounceRing && age < BOUNCE_RING_TTL_SEC) {
      state.rings.push({
        x: event.x,
        y: 0.5,
        z: event.z,
        age,
        ttl: BOUNCE_RING_TTL_SEC,
      });
    }
    return;
  }

  if (event.kind === "net") {
    if (policy.netWobble && age < NET_WOBBLE_SEC) {
      state.netWobble = { age };
    }
    return;
  }

  if (event.kind === "serve") {
    // 新しいポイントの開始。死球と残存エフェクトを消す。
    state.particles.length = 0;
    state.rings.length = 0;
    state.streaks.length = 0;
    state.netWobble = null;
    state.deadBall = null;
    return;
  }

  // point: 死球を1個だけ保持する（既存があれば置き換える）。
  if (age >= DEAD_BALL_HOLD_SEC + DEAD_BALL_FADE_SEC) {
    return;
  }
  state.deadBall = {
    x: event.ball.x,
    z: event.ball.z,
    y: onTable(event.ball.x, event.ball.z) ? 0 : FLOOR,
    startedAt: simulationTime - age,
  };
}

/**
 * §5.1.4: effect の時間を進める。`dt <= 0`（停止中）では状態を変えない。
 * `dt > EFFECT_DT_MAX_SEC`（復帰直後）は 0.25 に丸める。
 */
export function stepEffects(state: EffectState, rawDt: number): void {
  if (!(rawDt > 0)) {
    return;
  }
  const dt = Math.min(rawDt, EFFECT_DT_MAX_SEC);
  state.simulationTime += dt;

  state.particles = state.particles.filter((particle) => {
    particle.age += dt;
    if (particle.age >= particle.ttl) return false;
    particle.vy -= EFFECT_GRAVITY * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    return true;
  });

  state.rings = state.rings.filter((ring) => {
    ring.age += dt;
    return ring.age < ring.ttl;
  });

  state.streaks = state.streaks.filter((streak) => {
    streak.age += dt;
    return streak.age < streak.ttl;
  });

  if (state.netWobble) {
    state.netWobble.age += dt;
    if (state.netWobble.age >= NET_WOBBLE_SEC) {
      state.netWobble = null;
    }
  }

  if (
    state.deadBall &&
    state.simulationTime - state.deadBall.startedAt >=
      DEAD_BALL_HOLD_SEC + DEAD_BALL_FADE_SEC
  ) {
    state.deadBall = null;
  }
}

/** バウンドリングの現在半径 cm。 */
export function ringRadius(ring: Ring): number {
  const progress = clamp(ring.age / ring.ttl, 0, 1);
  return (
    BOUNCE_RING_RADIUS[0] +
    (BOUNCE_RING_RADIUS[1] - BOUNCE_RING_RADIUS[0]) * progress
  );
}

/** 決定論的な擬似乱数（Renderer 専用。Game.random には触れない）。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** インデックス由来の決定論的な 0〜1 の値（乱数生成器を使わない模様用）。 */
export function deterministicUnit(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
