import { GESTURE_MIN_SPEED, STROKE_SNAPSHOT_TTL_SEC } from "./config.ts";
import {
  appendPointerSample,
  computeStrokeMetrics,
  normalizeStagePoint,
} from "./control/stroke.ts";
import type {
  Flick,
  PointerKind,
  PointerSample,
  StrokeMetrics,
} from "./types.ts";

export interface InputFrame {
  sample: PointerSample;
  metrics: StrokeMetrics;
  history: readonly PointerSample[];
  width: number;
  height: number;
  time: number;
}

interface InputCallbacks {
  onInput: (frame: InputFrame) => void;
  onRelease: (time: number) => void;
  onReset: () => void;
  onServe: (flick: Flick | null) => boolean;
  onUserGesture: () => void;
}

export class InputController {
  private activePointerId: number | null = null;
  private activePointerKind: PointerKind | null = null;
  private down = false;
  private downAt = 0;
  private flick: Flick | null = null;
  private readonly samples: PointerSample[] = [];
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
    if (
      !this.flick ||
      this.now() - this.flick.t >= STROKE_SNAPSHOT_TTL_SEC
    ) {
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
    this.activePointerKind = null;
    this.down = false;
    this.flick = null;
    this.samples.length = 0;
    this.servedDuringGesture = false;
    this.callbacks.onReset();
  }

  public destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || this.activePointerId !== null) return;
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
    this.activePointerKind = this.pointerKind(event.pointerType);
    this.down = true;
    this.downAt = this.eventTime(event);
    this.flick = null;
    this.samples.length = 0;
    this.servedDuringGesture = false;
    this.ingest(event, rect);
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
    this.ingest(event);
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
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.ingest(event);
    const time = this.eventTime(event);
    if (
      this.down &&
      !this.servedDuringGesture &&
      time - this.downAt < 0.25 &&
      !this.currentFlick()
    ) {
      this.servedDuringGesture = this.callbacks.onServe(null);
    }
    this.callbacks.onRelease(time);
    this.release(event.pointerId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.release(event.pointerId);
      this.callbacks.onReset();
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
    this.activePointerKind = null;
    this.down = false;
    this.samples.length = 0;
    this.servedDuringGesture = false;
  }

  private ingest(
    event: PointerEvent,
    rect = this.canvas.getBoundingClientRect(),
  ): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    let events: PointerEvent[] = [];
    try {
      events = event.getCoalescedEvents?.() ?? [];
    } catch {
      // Some embedded browsers expose the method but cannot read its buffer.
    }
    const points = events.length > 0 ? [...events, event] : [event];
    let lastFrame: InputFrame | null = null;
    for (const point of points) {
      const normalized = normalizeStagePoint(point.clientX, point.clientY, rect);
      const sample: PointerSample = {
        clientX: point.clientX,
        clientY: point.clientY,
        ...normalized,
        time: this.eventTime(point),
        pointerType: this.activePointerKind ?? this.pointerKind(point.pointerType),
      };
      const appended = appendPointerSample(this.samples, sample);
      if (!appended && point !== event) continue;
      const metrics = computeStrokeMetrics(
        this.samples,
        rect.height,
        appended ? sample.time : (this.samples.at(-1)?.time ?? sample.time),
      );
      if (metrics.speed > GESTURE_MIN_SPEED) {
        this.flick = {
          vx: metrics.vx,
          vy: metrics.vy,
          sp: metrics.speed,
          t: sample.time,
        };
      }
      lastFrame = {
        sample,
        metrics,
        history: this.samples.slice(),
        width: rect.width,
        height: rect.height,
        time: sample.time,
      };
    }
    if (lastFrame) this.callbacks.onInput(lastFrame);
  }

  private eventTime(event: PointerEvent): number {
    const candidate = event.timeStamp / 1_000;
    const now = this.now();
    return Number.isFinite(candidate) &&
        candidate > 0 &&
        Number.isFinite(now) &&
        Math.abs(candidate - now) <= 5
      ? candidate
      : now;
  }

  private pointerKind(pointerType: string): PointerKind {
    return pointerType === "touch" || pointerType === "pen"
      ? pointerType
      : "mouse";
  }

  private now(): number {
    return performance.now() / 1_000;
  }
}
