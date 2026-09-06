// v0.3.0 §5.4.3〜§5.4.5 / §5.7 / §5.9.1: 球・軌跡・死球・エフェクト・サーブ着地帯の描画。
// 状態は持たず、`src/view/effects.ts` の純粋モデルが作った値を描くだけ。
import { BALL_R, FLOOR, HW } from "../config.ts";
import { onTable } from "../physics.ts";
import { playerContactGuideAlpha } from "../render-guide.ts";
import type { RenderScene } from "../types.ts";
import {
  clamp,
  paddleDepthRatio,
  paddleScreenRadius,
} from "../utils.ts";
import {
  deadBallAlpha,
  deterministicUnit,
  ringRadius,
  type DeadBall,
  type EffectState,
} from "../view/effects.ts";
import { spinTint, spinTintCss } from "../view/hud-text.ts";
import { projectOn, quad, type SceneSurface } from "./layers.ts";
import { THEME } from "./theme.ts";

const TRAIL_MAX_SEGMENTS = 8;
const SMASH_STREAK_LINES = 12;

function ballRadiusAt(scale: number): number {
  return Math.max(3.6, BALL_R * 3.1 * scale);
}

/** 直下の面。台の上なら 0、それ以外は床。 */
function surfaceYAt(x: number, z: number): number {
  return onTable(x, z) ? 0.4 : FLOOR;
}

export function drawBallShadow(surface: SceneSurface, scene: RenderScene): void {
  const context = surface.context;
  const ball = scene.ball;
  const surfaceY = surfaceYAt(ball.x, ball.z);
  const shadow = projectOn(surface, ball.x, surfaceY, ball.z);
  const height = Math.max(0, ball.y - surfaceY);
  const alpha = Math.max(0.05, 0.3 - height / 420);
  context.fillStyle = `rgba(0,0,0,${alpha})`;
  context.beginPath();
  context.ellipse(
    shadow.x,
    shadow.y,
    (5 + height * 0.035) * shadow.s,
    (2.4 + height * 0.016) * shadow.s,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
}

/** §5.4.3: 軌跡を連続した帯として描く。物理側の trail push は不変。 */
export function drawTrail(surface: SceneSurface, scene: RenderScene): void {
  const trail = scene.trail;
  if (trail.length < 2) return;
  const context = surface.context;
  const tint = spinTint(scene.ball.spin);
  const start = Math.max(1, trail.length - TRAIL_MAX_SEGMENTS);
  for (let index = start; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const current = trail[index];
    if (!previous || !current) continue;
    const progressA = index / trail.length;
    const progressB = (index + 1) / trail.length;
    const a = projectOn(surface, previous.x, previous.y, previous.z);
    const b = projectOn(surface, current.x, current.y, current.z);
    const widthA = ballRadiusAt(a.s) * (0.3 + 0.7 * progressA);
    const widthB = ballRadiusAt(b.s) * (0.3 + 0.7 * progressB);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0.01)) continue;
    const nx = -dy / length;
    const ny = dx / length;
    quad(
      context,
      { x: a.x + nx * widthA, y: a.y + ny * widthA, s: a.s },
      { x: b.x + nx * widthB, y: b.y + ny * widthB, s: b.s },
      { x: b.x - nx * widthB, y: b.y - ny * widthB, s: b.s },
      { x: a.x - nx * widthA, y: a.y - ny * widthA, s: a.s },
      spinTintCss(tint, 0.05 + 0.3 * progressB),
    );
  }
}

export function drawBall(
  surface: SceneSurface,
  scene: RenderScene,
  smashGlowAlpha: number,
): void {
  const context = surface.context;
  const ball = scene.ball;
  const point = projectOn(surface, ball.x, ball.y, ball.z);
  const radius = ballRadiusAt(point.s);

  if (smashGlowAlpha > 0 && scene.smashable) {
    const glow = context.createRadialGradient(
      point.x,
      point.y,
      radius * 0.6,
      point.x,
      point.y,
      radius * 2.2,
    );
    glow.addColorStop(0, `${THEME.smashGlow}${smashGlowAlpha})`);
    glow.addColorStop(1, `${THEME.smashGlow}0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 2.2, 0, Math.PI * 2);
    context.fill();
  }

  paintBallBody(context, point.x, point.y, radius, 1);

  // 回転線の回転角は現行どおり performance.now() を使う（§5.1.4 の例外）。
  const angle = (performance.now() / 1000) * ball.spin * 10;
  context.strokeStyle = spinTintCss(spinTint(ball.spin), 0.75);
  context.lineWidth = Math.max(1, radius * 0.16);
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.55, angle, angle + 1.5);
  context.stroke();
}

function paintBallBody(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.1,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, THEME.ballCore);
  gradient.addColorStop(0.5, THEME.ballMid);
  gradient.addColorStop(1, THEME.ballEdge);
  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

/** §5.4.4: 死球。軌跡・回転線は描かず、影は直下面に alpha 付きで描く。 */
export function drawDeadBall(
  surface: SceneSurface,
  deadBall: DeadBall,
  simulationTime: number,
): void {
  const alpha = deadBallAlpha(simulationTime - deadBall.startedAt);
  if (alpha <= 0) return;
  const context = surface.context;
  const point = projectOn(surface, deadBall.x, deadBall.y, deadBall.z);
  const radius = ballRadiusAt(point.s);
  const shadow = projectOn(
    surface,
    deadBall.x,
    surfaceYAt(deadBall.x, deadBall.z),
    deadBall.z,
  );
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "rgba(0,0,0,.30)";
  context.beginPath();
  context.ellipse(shadow.x, shadow.y, 5 * shadow.s, 2.4 * shadow.s, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
  paintBallBody(context, point.x, point.y, radius, alpha);
}

/** §5.7.1 / §5.7.2 / §5.7.4: 粒子・バウンドリング・集中線。 */
export function drawEffects(
  surface: SceneSurface,
  effects: EffectState,
): void {
  const context = surface.context;

  for (const ring of effects.rings) {
    const point = projectOn(surface, ring.x, ring.y, ring.z);
    const radius = ringRadius(ring) * point.s;
    const alpha = 0.55 * (1 - clamp(ring.age / ring.ttl, 0, 1));
    context.strokeStyle = `rgba(255,194,75,${alpha})`;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(point.x, point.y, radius, radius * 0.42, 0, 0, Math.PI * 2);
    context.stroke();
  }

  for (const particle of effects.particles) {
    const point = projectOn(surface, particle.x, particle.y, particle.z);
    const alpha = 1 - clamp(particle.age / particle.ttl, 0, 1);
    const radius = Math.max(0.6, particle.size * point.s);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (const streak of effects.streaks) {
    const point = projectOn(surface, streak.x, streak.y, streak.z);
    const radius = ballRadiusAt(point.s);
    const alpha = 0.5 * (1 - clamp(streak.age / streak.ttl, 0, 1));
    context.strokeStyle = `rgba(255,194,75,${alpha})`;
    context.lineWidth = 1.5;
    for (let index = 0; index < SMASH_STREAK_LINES; index += 1) {
      const angle = (Math.PI * 2 * index) / SMASH_STREAK_LINES;
      const length = 18 + deterministicUnit(index + 7) * 22;
      const inner = radius * 1.6;
      context.beginPath();
      context.moveTo(
        point.x + Math.cos(angle) * inner,
        point.y + Math.sin(angle) * inner,
      );
      context.lineTo(
        point.x + Math.cos(angle) * (inner + length),
        point.y + Math.sin(angle) * (inner + length),
      );
      context.stroke();
    }
  }
}

/** §5.9.1: サーブ着地帯（目安）。表示条件は renderOrder() が判定する。 */
export function drawServeZone(
  surface: SceneSurface,
  zone: readonly [number, number],
): void {
  const context = surface.context;
  const corners = [
    projectOn(surface, -HW, 0.3, zone[0]),
    projectOn(surface, HW, 0.3, zone[0]),
    projectOn(surface, HW, 0.3, zone[1]),
    projectOn(surface, -HW, 0.3, zone[1]),
  ] as const;
  quad(context, corners[0], corners[1], corners[2], corners[3], THEME.serveZoneFill);
  context.strokeStyle = THEME.serveZoneEdge;
  context.lineWidth = 1.5;
  context.beginPath();
  corners.forEach((corner, index) => {
    if (index === 0) context.moveTo(corner.x, corner.y);
    else context.lineTo(corner.x, corner.y);
  });
  context.closePath();
  context.stroke();
}

/** 着地予測マーク（現行仕様のまま）。 */
export function drawMark(surface: SceneSurface, scene: RenderScene): void {
  const mark = scene.mark;
  if (!mark) return;
  const context = surface.context;
  const point = projectOn(surface, mark.x, 0.5, mark.z);
  const progress = clamp(mark.t, 0, 1);
  const radius = (7 + 16 * progress) * point.s;
  context.strokeStyle = `${THEME.mark}${0.25 + 0.5 * (1 - progress)})`;
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(point.x, point.y, radius, radius * 0.42, 0, 0, Math.PI * 2);
  context.stroke();
}

/** 迎球ガイド（生成条件・alpha式は現行のまま。N-3）。 */
export function drawPlayerContactGuide(
  surface: SceneSurface,
  scene: RenderScene,
): void {
  const guide = scene.playerContactGuide;
  if (
    !guide ||
    scene.game.phase !== "rally" ||
    !scene.ball.live ||
    scene.controlModel !== "direct-paddle-v1" ||
    scene.ball.hitter !== "A" ||
    scene.ball.bounces < 1 ||
    scene.ball.vz >= 0
  ) {
    return;
  }
  const remaining = guide.etaSec - (scene.simulationTime - guide.plannedAt);
  const alpha = playerContactGuideAlpha(remaining);
  if (alpha <= 0) return;

  const point = projectOn(surface, guide.x, guide.y, guide.z);
  const radius = clamp(
    paddleScreenRadius(
      surface.width,
      surface.height,
      paddleDepthRatio(guide.z),
    ) * 0.55,
    7,
    12,
  );
  const context = surface.context;
  context.save();
  context.strokeStyle = `${THEME.contactGuide}${alpha})`;
  context.lineWidth = Math.max(1.5, radius * 0.16);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

/** debug stroke（?debugInput=1 のみ）。 */
export function drawDebugStroke(
  surface: SceneSurface,
  scene: RenderScene,
): void {
  const context = surface.context;
  context.save();
  context.beginPath();
  scene.debugStroke.forEach((sample, index) => {
    const x = sample.stageX * surface.width;
    const y = sample.stageY * surface.height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = THEME.debugStroke;
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}
