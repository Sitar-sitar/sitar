import {
  BALL_R,
  FLOOR,
  HL,
  HW,
  NET_H,
  NET_HW,
  PADDLE_BLADE_SCALE,
  PADDLE_HANDLE_INSET,
  PADDLE_HANDLE_LENGTH,
  PADDLE_HANDLE_WIDTH,
} from "./config.ts";
import { onTable } from "./physics.ts";
import type { RenderScene, Viewport } from "./types.ts";
import {
  clampPaddleScreenY,
  paddleDepthRatio,
  paddleHandleAngle,
  paddleScreenRadius,
  paddleScreenY,
  paddleShadowY,
  projectScale,
} from "./utils.ts";

interface ProjectedPoint {
  x: number;
  y: number;
  s: number;
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private scene: RenderScene | null = null;
  private readonly camera = {
    x: 0,
    y: 190,
    z: -330,
    f: 0,
    cx: 0,
    cy: 0,
  };

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getScene: () => RenderScene,
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

  public render(): void {
    this.scene = this.getScene();
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawScene();
    this.drawOpponent();
    this.drawTable();
    this.drawMark();
    this.drawBall();
    this.drawPlayerPaddle();
  }

  public destroy(): void {
    window.removeEventListener("resize", this.resize);
    window.visualViewport?.removeEventListener("resize", this.resize);
    window.removeEventListener(
      "orientationchange",
      this.onOrientationChange,
    );
  }

  private readonly resize = (): void => {
    const coarsePointer =
      window.matchMedia?.("(pointer: coarse)").matches ?? false;
    this.dpr = Math.min(
      coarsePointer ? 2 : 3,
      window.devicePixelRatio || 1,
    );
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
    this.camera.f = Math.max(
      300,
      Math.min(1.3 * this.width, 0.8 * this.height),
    );
    this.camera.cx = this.width / 2;
    const near = this.camera.f / (-HL - this.camera.z);
    this.camera.cy = this.height * 0.735 - this.camera.y * near;
  };

  private readonly onOrientationChange = (): void => {
    this.resize();
    window.setTimeout(this.resize, 250);
  };

  private project(x: number, y: number, z: number): ProjectedPoint {
    const scale = projectScale(this.camera.f, this.camera.z, z);
    return {
      x: this.camera.cx + (x - this.camera.x) * scale,
      y: this.camera.cy - (y - this.camera.y) * scale,
      s: scale,
    };
  }

  private quad(
    first: ProjectedPoint,
    second: ProjectedPoint,
    third: ProjectedPoint,
    fourth: ProjectedPoint,
    fill: string | CanvasGradient,
  ): void {
    const context = this.context;
    context.beginPath();
    context.moveTo(first.x, first.y);
    context.lineTo(second.x, second.y);
    context.lineTo(third.x, third.y);
    context.lineTo(fourth.x, fourth.y);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }

  private drawScene(): void {
    const context = this.context;
    const horizon = this.camera.cy;
    let gradient = context.createLinearGradient(0, 0, 0, horizon);
    gradient.addColorStop(0, "#8d8778");
    gradient.addColorStop(0.55, "#bdb5a4");
    gradient.addColorStop(1, "#d6cfbe");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, horizon + 1);

    context.fillStyle = "rgba(255,246,220,.22)";
    for (let index = 0; index < 4; index += 1) {
      const x = this.width * (0.14 + index * 0.24);
      context.fillRect(
        x - this.width * 0.055,
        horizon * 0.1,
        this.width * 0.11,
        5,
      );
    }

    const waistHeight = Math.max(10, this.height * 0.028);
    context.fillStyle = "#7e786a";
    context.fillRect(0, horizon - waistHeight, this.width, waistHeight);
    context.fillStyle = "rgba(255,255,255,.10)";
    context.fillRect(0, horizon - waistHeight, this.width, 2);

    gradient = context.createLinearGradient(0, horizon, 0, this.height);
    gradient.addColorStop(0, "#a67c3f");
    gradient.addColorStop(0.45, "#c4934c");
    gradient.addColorStop(1, "#d9a960");
    context.fillStyle = gradient;
    context.fillRect(0, horizon, this.width, this.height - horizon);

    context.strokeStyle = "rgba(120,80,32,.20)";
    context.lineWidth = 1;
    for (let index = -12; index <= 12; index += 1) {
      const x = index * 46;
      const near = this.project(x, FLOOR, -300);
      const far = this.project(x, FLOOR, 1500);
      context.beginPath();
      context.moveTo(near.x, near.y);
      context.lineTo(far.x, far.y);
      context.stroke();
    }

    context.strokeStyle = "rgba(120,80,32,.13)";
    for (let z = -260; z < 1400; z += 180) {
      const left = this.project(-900, FLOOR, z);
      const right = this.project(900, FLOOR, z);
      context.beginPath();
      context.moveTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.stroke();
    }

    context.strokeStyle = "rgba(226,232,238,.34)";
    context.lineWidth = 2;
    for (const x of [-330, 330]) {
      const near = this.project(x, FLOOR, -320);
      const far = this.project(x, FLOOR, 900);
      context.beginPath();
      context.moveTo(near.x, near.y);
      context.lineTo(far.x, far.y);
      context.stroke();
    }

    const light = context.createRadialGradient(
      this.width / 2,
      horizon + (this.height - horizon) * 0.45,
      10,
      this.width / 2,
      horizon + (this.height - horizon) * 0.45,
      this.width * 0.95,
    );
    light.addColorStop(0, "rgba(255,247,225,.16)");
    light.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = light;
    context.fillRect(0, horizon, this.width, this.height - horizon);

    this.drawFence(620);
    this.drawFence(-560);
  }

  private drawFence(z: number): void {
    const context = this.context;
    const base = this.project(0, FLOOR, z);
    const top = this.project(0, FLOOR + 75, z);
    const left = this.project(-460, FLOOR, z);
    const right = this.project(460, FLOOR, z);
    const height = base.y - top.y;
    context.fillStyle = "#17635c";
    context.fillRect(left.x, top.y, right.x - left.x, height);
    context.fillStyle = "rgba(0,0,0,.18)";
    context.fillRect(
      left.x,
      base.y - height * 0.16,
      right.x - left.x,
      height * 0.16,
    );
    context.strokeStyle = "rgba(255,255,255,.22)";
    context.lineWidth = 1.5;
    context.strokeRect(left.x, top.y, right.x - left.x, height);
    context.strokeStyle = "rgba(0,0,0,.28)";
    context.lineWidth = 1;
    for (let index = 1; index < 9; index += 1) {
      const x = left.x + ((right.x - left.x) * index) / 9;
      context.beginPath();
      context.moveTo(x, top.y);
      context.lineTo(x, base.y);
      context.stroke();
    }
  }

  private drawTable(): void {
    const context = this.context;
    const nearLeft = this.project(-HW, 0, -HL);
    const nearRight = this.project(HW, 0, -HL);
    const farRight = this.project(HW, 0, HL);
    const farLeft = this.project(-HW, 0, HL);

    context.fillStyle = "#1c2733";
    const legs: readonly (readonly [number, number])[] = [
      [-HW + 16, -HL + 18],
      [HW - 16, -HL + 18],
      [-HW + 16, HL - 18],
      [HW - 16, HL - 18],
    ];
    for (const [x, z] of legs) {
      const top = this.project(x, -4, z);
      const bottom = this.project(x, FLOOR, z);
      const width = Math.max(3, 7 * top.s);
      context.fillRect(
        top.x - width / 2,
        top.y,
        width,
        bottom.y - top.y,
      );
    }

    const thickNearLeft = this.project(-HW, -5, -HL);
    const thickNearRight = this.project(HW, -5, -HL);
    this.quad(
      nearLeft,
      nearRight,
      thickNearRight,
      thickNearLeft,
      "#10334a",
    );
    this.quad(
      farLeft,
      nearLeft,
      thickNearLeft,
      this.project(-HW, -5, HL),
      "#0e2c40",
    );
    this.quad(
      nearRight,
      farRight,
      this.project(HW, -5, HL),
      thickNearRight,
      "#0e2c40",
    );

    const tableGradient = context.createLinearGradient(
      0,
      farLeft.y,
      0,
      nearLeft.y,
    );
    tableGradient.addColorStop(0, "#123f5c");
    tableGradient.addColorStop(0.5, "#1a5276");
    tableGradient.addColorStop(1, "#1f608a");
    this.quad(
      nearLeft,
      nearRight,
      farRight,
      farLeft,
      tableGradient,
    );

    const shine = context.createLinearGradient(
      0,
      farLeft.y,
      0,
      nearLeft.y,
    );
    shine.addColorStop(0, "rgba(255,255,255,.10)");
    shine.addColorStop(0.35, "rgba(255,255,255,.02)");
    shine.addColorStop(1, "rgba(0,0,0,.10)");
    this.quad(nearLeft, nearRight, farRight, farLeft, shine);

    const lineWidth = 2;
    this.band(-HW, -HW + lineWidth, -HL, HL);
    this.band(HW - lineWidth, HW, -HL, HL);
    this.band(-HW, HW, -HL, -HL + lineWidth);
    this.band(-HW, HW, HL - lineWidth, HL);
    context.globalAlpha = 0.45;
    this.band(-0.15, 0.15, -HL, HL);
    context.globalAlpha = 1;
    this.drawNet();
  }

  private band(x0: number, x1: number, z0: number, z1: number): void {
    this.quad(
      this.project(x0, 0.2, z0),
      this.project(x1, 0.2, z0),
      this.project(x1, 0.2, z1),
      this.project(x0, 0.2, z1),
      "#f3f6f8",
    );
  }

  private drawNet(): void {
    const context = this.context;
    const bottomLeft = this.project(-NET_HW, 0, 0);
    const bottomRight = this.project(NET_HW, 0, 0);
    const topLeft = this.project(-NET_HW, NET_H, 0);
    const topRight = this.project(NET_HW, NET_H, 0);
    this.quad(
      topLeft,
      topRight,
      bottomRight,
      bottomLeft,
      "rgba(232,238,244,.30)",
    );
    context.strokeStyle = "rgba(255,255,255,.22)";
    context.lineWidth = 1;
    for (let index = 1; index < 24; index += 1) {
      const x = -NET_HW + ((2 * NET_HW) * index) / 24;
      const bottom = this.project(x, 0, 0);
      const top = this.project(x, NET_H, 0);
      context.beginPath();
      context.moveTo(bottom.x, bottom.y);
      context.lineTo(top.x, top.y);
      context.stroke();
    }
    this.quad(
      topLeft,
      topRight,
      this.project(NET_HW, NET_H + 1.6, 0),
      this.project(-NET_HW, NET_H + 1.6, 0),
      "#ffffff",
    );
    context.fillStyle = "#e8eef4";
    for (const x of [-NET_HW, NET_HW]) {
      const bottom = this.project(x, 0, 0);
      const top = this.project(x, NET_H + 2, 0);
      const width = Math.max(2, 2.4 * bottom.s);
      context.fillRect(
        bottom.x - width / 2,
        top.y,
        width,
        bottom.y - top.y,
      );
    }
  }

  private drawOpponent(): void {
    const scene = this.requiredScene();
    const opponent = scene.opponent;
    const context = this.context;
    const scale = this.project(
      opponent.x,
      FLOOR,
      opponent.z + 16,
    ).s;
    const hip = this.project(
      opponent.x,
      FLOOR + 46,
      opponent.z + 16,
    );
    const head = this.project(
      opponent.x,
      FLOOR + 72,
      opponent.z + 16,
    );
    const feet = this.project(opponent.x, FLOOR, opponent.z + 16);

    context.fillStyle = "rgba(0,0,0,.22)";
    context.beginPath();
    context.ellipse(feet.x, feet.y, 22 * scale, 7 * scale, 0, 0, 7);
    context.fill();

    context.strokeStyle = "#1b2836";
    context.lineWidth = Math.max(3, 8.5 * scale);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(hip.x - 7 * scale, hip.y);
    context.lineTo(feet.x - 11 * scale, feet.y);
    context.stroke();
    context.beginPath();
    context.moveTo(hip.x + 7 * scale, hip.y);
    context.lineTo(feet.x + 11 * scale, feet.y);
    context.stroke();

    const torsoWidth = 21 * scale;
    const torsoHeight = hip.y - head.y - 9 * scale;
    context.fillStyle = "#e9edf1";
    this.roundRect(
      hip.x - torsoWidth / 2,
      head.y + 9 * scale,
      torsoWidth,
      torsoHeight,
      6 * scale,
    );
    context.fill();
    context.fillStyle = "#c0392b";
    context.fillRect(
      hip.x - torsoWidth / 2,
      head.y + 9 * scale,
      torsoWidth,
      Math.max(2, 4 * scale),
    );

    context.fillStyle = "#2b3a49";
    context.beginPath();
    context.arc(head.x, head.y + 3 * scale, 7.5 * scale, 0, 7);
    context.fill();

    const swing =
      opponent.swing > 0 ? Math.sin(opponent.swing * Math.PI) : 0;
    const racketX = opponent.x + 12 + swing * 16;
    const racketY = FLOOR + 44 + swing * 10;
    const hand = this.project(racketX, racketY, opponent.z + 10);
    const armRoot = {
      x: hip.x + torsoWidth * 0.4,
      y: head.y + 16 * scale,
    };
    context.strokeStyle = "#e9edf1";
    context.lineWidth = Math.max(2.5, 6 * scale);
    context.beginPath();
    context.moveTo(armRoot.x, armRoot.y);
    context.lineTo(hand.x, hand.y);
    context.stroke();
    this.paddle(
      hand,
      scale,
      "#b03a2e",
      Math.atan2(armRoot.y - hand.y, armRoot.x - hand.x),
    );
  }

  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    initialRadius: number,
  ): void {
    const context = this.context;
    const radius = Math.min(initialRadius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  private paddle(
    point: ProjectedPoint,
    scale: number,
    color: string,
    angle: number,
  ): void {
    const context = this.context;
    const radius = Math.max(6, 9.6 * scale * PADDLE_BLADE_SCALE);
    const handleWidth = radius * PADDLE_HANDLE_WIDTH;
    const handleLength = radius * PADDLE_HANDLE_LENGTH;
    const handleStart = radius * PADDLE_HANDLE_INSET;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    this.roundRect(
      handleStart,
      -handleWidth / 2,
      handleLength,
      handleWidth,
      handleWidth * 0.35,
    );
    context.fillStyle = "#7a4a24";
    context.fill();
    context.lineWidth = Math.max(1, radius * 0.1);
    context.strokeStyle = "rgba(0,0,0,.35)";
    context.stroke();
    context.fillStyle = "rgba(255,255,255,.12)";
    context.fillRect(
      handleStart + handleLength * 0.55,
      -handleWidth / 2,
      handleLength * 0.3,
      handleWidth,
    );
    context.restore();

    context.save();
    context.beginPath();
    context.ellipse(
      point.x,
      point.y,
      radius,
      radius * 0.94,
      0,
      0,
      7,
    );
    context.fillStyle = color;
    context.fill();
    context.lineWidth = Math.max(1.5, radius * 0.14);
    context.strokeStyle = "rgba(0,0,0,.35)";
    context.stroke();
    context.beginPath();
    context.ellipse(
      point.x,
      point.y - radius * 0.22,
      radius * 0.62,
      radius * 0.4,
      0,
      0,
      7,
    );
    context.fillStyle = "rgba(255,255,255,.10)";
    context.fill();
    context.restore();
  }

  private drawPlayerPaddle(): void {
    const scene = this.requiredScene();
    const player = scene.player;
    const context = this.context;
    const swing =
      player.swing > 0 ? Math.sin(player.swing * Math.PI) : 0;
    // 横位置は打球判定と同じ平面 player.z で投影する（viewZ を使わない）。
    const x = this.project(player.x, 0, player.z).x;
    const depth = paddleDepthRatio(player.viewZ);
    const radius = paddleScreenRadius(this.width, this.height, depth);
    const y = clampPaddleScreenY(
      paddleScreenY(this.height, swing, player.swingType, depth),
      this.height,
      radius,
    );

    const shadowAlpha = 0.28 - swing * 0.16;
    const shadowRadiusX = radius * (0.9 - swing * 0.2);
    context.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    context.beginPath();
    context.ellipse(
      x,
      paddleShadowY(this.height, depth),
      shadowRadiusX,
      radius * 0.28,
      0,
      0,
      7,
    );
    context.fill();

    if (scene.smashable) {
      context.beginPath();
      context.arc(x, y, radius * 1.55, 0, 7);
      context.strokeStyle = "rgba(255,194,75,.85)";
      context.lineWidth = 2.5;
      context.stroke();
      context.beginPath();
      context.arc(x, y, radius * 1.95, 0, 7);
      context.strokeStyle = "rgba(255,194,75,.22)";
      context.lineWidth = 5;
      context.stroke();
    }
    this.paddle(
      { x, y, s: 1 },
      radius / 9.6,
      "#cb4335",
      paddleHandleAngle(swing, player.swingType),
    );
  }

  private drawBall(): void {
    const scene = this.requiredScene();
    const ball = scene.ball;
    if (!ball.live && scene.game.phase !== "serve") {
      return;
    }
    const context = this.context;
    const surfaceY = onTable(ball.x, ball.z) ? 0.4 : FLOOR;
    const shadow = this.project(ball.x, surfaceY, ball.z);
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
      7,
    );
    context.fill();

    scene.trail.forEach((trailPoint, index) => {
      const progress = (index + 1) / scene.trail.length;
      const point = this.project(
        trailPoint.x,
        trailPoint.y,
        trailPoint.z,
      );
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        BALL_R * 3.1 * point.s * progress * 0.8,
        0,
        7,
      );
      context.fillStyle = `rgba(242,113,28,${0.13 * progress})`;
      context.fill();
    });

    const point = this.project(ball.x, ball.y, ball.z);
    const radius = Math.max(3.6, BALL_R * 3.1 * point.s);
    const gradient = context.createRadialGradient(
      point.x - radius * 0.35,
      point.y - radius * 0.4,
      radius * 0.1,
      point.x,
      point.y,
      radius,
    );
    gradient.addColorStop(0, "#ffd9a8");
    gradient.addColorStop(0.5, "#f2711c");
    gradient.addColorStop(1, "#c8560f");
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, 7);
    context.fillStyle = gradient;
    context.fill();

    const angle = (performance.now() / 1000) * ball.spin * 10;
    context.strokeStyle = "rgba(255,255,255,.55)";
    context.lineWidth = Math.max(1, radius * 0.16);
    context.beginPath();
    context.arc(point.x, point.y, radius * 0.55, angle, angle + 1.5);
    context.stroke();
  }

  private drawMark(): void {
    const mark = this.requiredScene().mark;
    if (!mark) {
      return;
    }
    const context = this.context;
    const point = this.project(mark.x, 0.5, mark.z);
    const progress = Math.max(0, Math.min(1, mark.t));
    const radius = (7 + 16 * progress) * point.s;
    context.strokeStyle = `rgba(255,194,75,${0.25 + 0.5 * (1 - progress)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(
      point.x,
      point.y,
      radius,
      radius * 0.42,
      0,
      0,
      7,
    );
    context.stroke();
  }

  private requiredScene(): RenderScene {
    if (!this.scene) {
      throw new Error("描画状態が初期化されていません。");
    }
    return this.scene;
  }
}
