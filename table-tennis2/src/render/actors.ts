// v0.3.0 §5.5 / §5.6: 相手プレイヤーとラケットの作画。
// **判定に使う中心・半径・角度・squash・補助輪郭の式は移設のみで変更しない（N-3）。**
// 変えるのは塗りだけ。`lean` / `sway` は Renderer が持つ描画専用の状態を受け取る。
import {
  BALL_R,
  FLOOR,
  OPPONENT_DRAW_Z,
  PADDLE_BLADE_SCALE,
  PADDLE_HANDLE_INSET,
  PADDLE_HANDLE_LENGTH,
  PADDLE_HANDLE_WIDTH,
} from "../config.ts";
import type { RenderScene } from "../types.ts";
import {
  clampPaddleScreenY,
  paddleDepthRatio,
  paddleHandleAngle,
  paddleScreenRadius,
  paddleScreenY,
  paddleShadowY,
} from "../utils.ts";
import type { ProjectedPoint } from "../view/projection.ts";
import { projectOn, roundRectPath, type SceneSurface } from "./layers.ts";
import { THEME } from "./theme.ts";

export interface OpponentPose {
  /** 構えの傾き cm（描画専用。判定へは影響しない）。 */
  lean: number;
  /** 待機揺らぎ cm（reduced-motion では 0）。 */
  sway: number;
}

export function drawOpponent(
  surface: SceneSurface,
  scene: RenderScene,
  pose: OpponentPose,
): void {
  const context = surface.context;
  const opponent = scene.opponent;
  // 奥行きは描画専用の固定値。判定面 opponent.z は読み取らない（§5.6 / N-3）。
  const z = OPPONENT_DRAW_Z;
  const scale = projectOn(surface, opponent.x, FLOOR, z).s;
  const bodyX = opponent.x + pose.lean;
  const feet = projectOn(surface, opponent.x, FLOOR, z);

  context.fillStyle = THEME.opponentShadow;
  context.beginPath();
  context.ellipse(feet.x, feet.y, 22 * scale, 7 * scale, 0, 0, Math.PI * 2);
  context.fill();

  // 脚（膝で外側へ折る2セグメント）
  const hip = projectOn(surface, bodyX, FLOOR + 46, z);
  context.strokeStyle = THEME.opponentLimb;
  context.lineWidth = Math.max(3, 8.5 * scale);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const direction of [-1, 1]) {
    const knee = projectOn(surface, bodyX + direction * 11, FLOOR + 22, z);
    const foot = projectOn(surface, opponent.x + direction * 14, FLOOR, z);
    context.beginPath();
    context.moveTo(hip.x + direction * 7 * scale, hip.y);
    context.lineTo(knee.x, knee.y);
    context.lineTo(foot.x, foot.y);
    context.stroke();
  }

  // ショーツ
  const shortsWidth = 26 * scale;
  const shortsHeight = 12 * scale;
  context.fillStyle = THEME.opponentLimb;
  roundRectPath(
    context,
    hip.x - shortsWidth / 2,
    hip.y - shortsHeight * 0.55,
    shortsWidth,
    shortsHeight,
    4 * scale,
  );
  context.fill();

  // 胴（待機揺らぎを y に足す）
  const torsoTop = projectOn(surface, bodyX, FLOOR + 66 + pose.sway, z);
  const torsoBottom = projectOn(surface, bodyX, FLOOR + 46 + pose.sway, z);
  const torsoWidth = 22 * scale;
  const torsoHeight = Math.max(1, torsoBottom.y - torsoTop.y);
  context.fillStyle = THEME.opponentShirt;
  roundRectPath(
    context,
    torsoTop.x - torsoWidth / 2,
    torsoTop.y,
    torsoWidth,
    torsoHeight,
    6 * scale,
  );
  context.fill();
  context.fillStyle = THEME.opponentChestBand;
  context.fillRect(
    torsoTop.x - torsoWidth / 2,
    torsoTop.y + torsoHeight * 0.18,
    torsoWidth,
    Math.max(2, 4 * scale),
  );

  // 頭と前髪
  const head = projectOn(surface, bodyX, FLOOR + 74 + pose.sway, z);
  const headRadius = Math.max(2, 7.5 * scale);
  context.fillStyle = THEME.opponentHead;
  context.beginPath();
  context.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = THEME.opponentHair;
  context.beginPath();
  context.arc(head.x, head.y, headRadius, Math.PI, Math.PI * 2);
  context.closePath();
  context.fill();

  // 腕とラケット（手の位置の式は現行どおり）
  const swing = opponent.swing > 0 ? Math.sin(opponent.swing * Math.PI) : 0;
  const racketX = opponent.x + 12 + swing * 16;
  const racketY = FLOOR + 44 + swing * 10;
  const hand = projectOn(surface, racketX, racketY, OPPONENT_DRAW_Z - 6);
  const shoulder = projectOn(surface, bodyX + 8, FLOOR + 62 + pose.sway, z);
  context.strokeStyle = THEME.opponentShirt;
  context.lineWidth = Math.max(2.5, 6 * scale);
  context.beginPath();
  context.moveTo(shoulder.x, shoulder.y);
  context.lineTo(hand.x, hand.y);
  context.stroke();
  drawPaddle(
    context,
    hand,
    scale,
    THEME.opponentBlade,
    Math.atan2(shoulder.y - hand.y, shoulder.x - hand.x),
    swing * 0.9,
  );

  // サーブ待ちの構え。球は演出であり ball 状態は変えない。
  if (
    scene.game.phase === "serve" &&
    scene.game.server === "A" &&
    !scene.ball.live
  ) {
    const free = projectOn(
      surface,
      opponent.x - 10,
      FLOOR + 40,
      OPPONENT_DRAW_Z - 6,
    );
    context.strokeStyle = THEME.opponentShirt;
    context.lineWidth = Math.max(2.5, 6 * scale);
    context.beginPath();
    context.moveTo(shoulder.x - torsoWidth * 0.8, shoulder.y);
    context.lineTo(free.x, free.y);
    context.stroke();
    context.fillStyle = THEME.ballMid;
    context.beginPath();
    context.arc(free.x, free.y, Math.max(2, BALL_R * 3.1 * free.s), 0, Math.PI * 2);
    context.fill();
  }
}

/** ラケット。塗りだけを刷新し、寸法比は現行どおり。 */
export function drawPaddle(
  context: CanvasRenderingContext2D,
  point: ProjectedPoint,
  scale: number,
  color: string,
  angle: number,
  bladeAngle = 0,
  squash = 1,
  contactFlash = 0,
): void {
  const radius = Math.max(6, 9.6 * scale * PADDLE_BLADE_SCALE);
  const handleWidth = radius * PADDLE_HANDLE_WIDTH;
  const handleLength = radius * PADDLE_HANDLE_LENGTH;
  const handleStart = radius * PADDLE_HANDLE_INSET;

  // 持ち手（末端を僅かに広げる）
  context.save();
  context.translate(point.x, point.y);
  context.rotate(angle);
  const endWidth = handleWidth * 1.15;
  context.beginPath();
  context.moveTo(handleStart, -handleWidth / 2);
  context.lineTo(handleStart + handleLength, -endWidth / 2);
  context.lineTo(handleStart + handleLength, endWidth / 2);
  context.lineTo(handleStart, handleWidth / 2);
  context.closePath();
  context.fillStyle = THEME.handle;
  context.fill();
  context.lineWidth = Math.max(1, radius * 0.1);
  context.strokeStyle = THEME.handleEdge;
  context.stroke();
  context.strokeStyle = THEME.handleGrain;
  context.lineWidth = 1;
  for (const ratio of [0.3, 0.65]) {
    const x = handleStart + handleLength * ratio;
    context.beginPath();
    context.moveTo(x, -handleWidth * 0.42);
    context.lineTo(x, handleWidth * 0.42);
    context.stroke();
  }
  context.fillStyle = THEME.handleShine;
  context.fillRect(
    handleStart + handleLength * 0.55,
    -handleWidth / 2,
    handleLength * 0.3,
    handleWidth,
  );
  context.restore();

  // ブレード
  context.save();
  context.translate(point.x, point.y);
  context.rotate(bladeAngle);
  const radiusY = radius * 0.94 * squash;
  context.beginPath();
  context.ellipse(0, 0, radius, radiusY, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = Math.max(1.5, radius * 0.12);
  context.strokeStyle = THEME.bladeEdgeTape;
  context.stroke();

  const shade = context.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  shade.addColorStop(0, THEME.bladeShadeInner);
  shade.addColorStop(1, THEME.bladeShadeOuter);
  context.beginPath();
  context.ellipse(0, 0, radius, radiusY, 0, 0, Math.PI * 2);
  context.fillStyle = shade;
  context.fill();

  context.beginPath();
  context.ellipse(
    0,
    -radius * 0.22,
    radius * 0.62,
    radius * 0.4 * squash,
    0,
    0,
    Math.PI * 2,
  );
  context.fillStyle = THEME.bladeSpecular;
  context.fill();

  if (contactFlash > 0) {
    context.beginPath();
    context.ellipse(0, 0, radius * 1.22, radius * 1.13 * squash, 0, 0, Math.PI * 2);
    context.strokeStyle = `${THEME.contactFlash}${0.85 * contactFlash})`;
    context.lineWidth = Math.max(2, radius * 0.16);
    context.stroke();
  }
  context.restore();
}

/**
 * プレイヤーラケット。中心・半径・角度・squash・補助輪郭の式は現行のまま。
 * 変更点はスマッシュ二重輪の線幅（2.5 → 1.5 / 5 → 3）と塗りだけ。
 */
export function drawPlayerPaddle(
  surface: SceneSurface,
  scene: RenderScene,
): void {
  const context = surface.context;
  const player = scene.player;
  const direct =
    scene.controlModel === "direct-paddle-v1" ? scene.directPlayerPose : null;
  const swing = player.swing > 0 ? Math.sin(player.swing * Math.PI) : 0;
  // 横位置は打球判定と同じ平面 player.z で投影する（viewZ を使わない）。
  const x = direct?.screenX ?? projectOn(surface, player.x, 0, player.z).x;
  const depth = paddleDepthRatio(player.viewZ);
  const radius = paddleScreenRadius(surface.width, surface.height, depth);
  const y =
    direct?.screenY ??
    clampPaddleScreenY(
      paddleScreenY(surface.height, swing, player.swingType, depth),
      surface.height,
      radius,
    );

  const shadowAlpha = 0.28 - swing * 0.16;
  const shadowRadiusX = radius * (0.9 - swing * 0.2);
  context.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  context.beginPath();
  context.ellipse(
    x,
    paddleShadowY(surface.height, depth),
    shadowRadiusX,
    radius * 0.28,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  if (scene.smashable) {
    context.beginPath();
    context.arc(x, y, radius * 1.55, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,194,75,.85)";
    context.lineWidth = 1.5;
    context.stroke();
    context.beginPath();
    context.arc(x, y, radius * 1.95, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,194,75,.22)";
    context.lineWidth = 3;
    context.stroke();
  }

  const squash = direct ? 1 - Math.abs(direct.tilt) * 0.15 : 1;
  const bladeAngle = direct?.angle ?? 0;
  const assist = scene.directPaddleAssist;
  if (direct && assist?.visible) {
    try {
      context.save();
      context.translate(x, y);
      context.rotate(bladeAngle);
      context.beginPath();
      context.ellipse(
        0,
        0,
        radius * PADDLE_BLADE_SCALE * assist.scale,
        radius * PADDLE_BLADE_SCALE * 0.94 * squash * assist.scale,
        0,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = THEME.assistOutline;
      context.lineWidth = Math.max(1.5, radius * 0.08);
      context.stroke();
      context.restore();
    } catch {
      context.restore();
    }
  }
  if (direct && scene.debugInput && assist) {
    const visualRx = radius * PADDLE_BLADE_SCALE;
    const visualRy = visualRx * 0.94 * squash;
    const projectedBall = projectOn(
      surface,
      scene.ball.x,
      scene.ball.y,
      scene.ball.z,
    );
    const ballRadius = Math.max(2, BALL_R * projectedBall.s);
    context.save();
    context.translate(x, y);
    context.rotate(bladeAngle);
    context.beginPath();
    context.ellipse(0, 0, visualRx, visualRy, 0, 0, Math.PI * 2);
    context.strokeStyle = THEME.debugVisual;
    context.lineWidth = 1.5;
    context.stroke();
    context.beginPath();
    context.ellipse(
      0,
      0,
      visualRx * assist.scale + ballRadius,
      visualRy * assist.scale + ballRadius,
      0,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = THEME.debugAssist;
    context.stroke();
    context.restore();
  }

  drawPaddle(
    context,
    { x, y, s: 1 },
    radius / 9.6,
    THEME.playerBlade,
    direct?.angle ?? paddleHandleAngle(swing, player.swingType),
    direct?.angle ?? 0,
    squash,
    direct?.contactFlash ?? 0,
  );
}
