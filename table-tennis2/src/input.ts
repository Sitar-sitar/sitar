import type { Flick } from "./types.ts";
import { normalizeStageX } from "./view/input-math.ts";

interface InputCallbacks {
  onPosition: (stageX: number) => void;
  onServe: (flick: Flick | null) => boolean;
  onUserGesture: () => void;
}

interface InputSample {
  x: number;
  y: number;
  t: number;
}

export class InputController {
  private activePointerId: number | null = null;
  private down = false;
  private downAt = 0;
  private flick: Flick | null = null;
  private readonly samples: InputSample[] = [];
  private servedDuringGesture = false;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: InputCallbacks,
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  public currentFlick(): Flick | null {
    if (!this.flick || this.now() - this.flick.t >= 0.16) {
      return null;
    }
    return this.flick;
  }

  public clearFlick(): void {
    this.flick = null;
  }

  public reset(): void {
    if (this.activePointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture(this.activePointerId)) {
          this.canvas.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Rotation or pagehide may have released capture already.
      }
    }
    this.activePointerId = null;
    this.down = false;
    this.flick = null;
    this.samples.length = 0;
    this.servedDuringGesture = false;
  }

  public destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || this.activePointerId !== null) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return;
    }
    event.preventDefault();
    this.callbacks.onUserGesture();
    this.activePointerId = event.pointerId;
    this.down = true;
    this.downAt = this.now();
    this.flick = null;
    this.samples.length = 0;
    this.servedDuringGesture = false;
    this.pushSample(event.clientX, event.clientY);
    this.callbacks.onPosition(this.stageX(event.clientX, rect));
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; document-level events are not needed.
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (
      !this.down ||
      event.pointerId !== this.activePointerId ||
      !event.isPrimary
    ) {
      return;
    }
    event.preventDefault();
    this.pushSample(event.clientX, event.clientY);
    this.callbacks.onPosition(this.stageX(event.clientX));

    const current = this.currentFlick();
    if (
      current &&
      !this.servedDuringGesture &&
      this.callbacks.onServe(current)
    ) {
      this.servedDuringGesture = true;
      this.flick = null;
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    if (
      this.down &&
      !this.servedDuringGesture &&
      this.now() - this.downAt < 0.25 &&
      !this.currentFlick()
    ) {
      this.servedDuringGesture = this.callbacks.onServe(null);
    }
    this.release(event.pointerId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.release(event.pointerId);
    }
  };

  private readonly preventContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private release(pointerId: number): void {
    try {
      if (this.canvas.hasPointerCapture(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // The browser may have released capture during cancellation.
    }
    this.activePointerId = null;
    this.down = false;
    this.samples.length = 0;
    this.servedDuringGesture = false;
  }

  private pushSample(x: number, y: number): void {
    const time = this.now();
    this.samples.push({ x, y, t: time });
    while (
      this.samples.length > 1 &&
      time - (this.samples[0]?.t ?? time) > 0.11
    ) {
      this.samples.shift();
    }

    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last || first === last) {
      return;
    }

    const elapsed = last.t - first.t;
    const height = Math.max(1, this.canvas.getBoundingClientRect().height);
    if (elapsed <= 0.008) {
      return;
    }

    const vx = (last.x - first.x) / elapsed / height;
    const vy = (last.y - first.y) / elapsed / height;
    const speed = Math.hypot(vx, vy);
    if (speed > 1.25) {
      this.flick = { vx, vy, sp: speed, t: time };
    }
  }

  private now(): number {
    return performance.now() / 1000;
  }

  private stageX(
    clientX: number,
    rect = this.canvas.getBoundingClientRect(),
  ): number {
    return normalizeStageX(clientX, rect.left, rect.width);
  }
}
