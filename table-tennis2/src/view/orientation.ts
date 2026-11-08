import {
  evaluateViewport,
  isViewportBlocked,
  type ViewportSize,
  type ViewportState,
} from "./layout.ts";

type ActiveViewportState = Exclude<ViewportState, "portrait" | "portrait-too-small"> | "portrait-blocked";

interface ViewportControllerOptions {
  readonly gate: HTMLElement;
  readonly message: HTMLElement;
  readonly onBlockedChange: (blocked: boolean) => void;
}

function currentViewport(): ViewportSize {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? document.documentElement.clientWidth),
    height: Math.round(
      viewport?.height ?? document.documentElement.clientHeight,
    ),
  };
}

export class ViewportController {
  private frame = 0;
  private state: ActiveViewportState | null = null;

  public constructor(private readonly options: ViewportControllerOptions) {
    window.addEventListener("resize", this.schedule);
    window.visualViewport?.addEventListener("resize", this.schedule);
    window.screen.orientation?.addEventListener("change", this.schedule);
    this.update();
  }

  public destroy(): void {
    window.removeEventListener("resize", this.schedule);
    window.visualViewport?.removeEventListener("resize", this.schedule);
    window.screen.orientation?.removeEventListener("change", this.schedule);
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
    }
  }

  private readonly schedule = (): void => {
    if (this.frame !== 0) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  };

  private update(): void {
    const size = currentViewport();
    // 13-2 で content を #appShell の content box へ差し替える（設計 §4.2）。
    const classification = evaluateViewport({ viewport: size, content: size });
    // Keep the existing gate until the portrait stage and controls are ready.
    const next = classification === "portrait" || classification === "portrait-too-small"
      ? "portrait-blocked"
      : classification;
    if (next === this.state) {
      return;
    }
    this.state = next;
    document.body.dataset.viewport = next;
    const blocked = next === "portrait-blocked" || isViewportBlocked(next);
    this.options.gate.hidden = !blocked;
    this.options.gate.setAttribute("aria-hidden", String(!blocked));
    this.options.message.textContent =
      next === "portrait-blocked"
        ? "端末を横向きにしてください"
        : `画面が小さすぎます（現在 ${size.width}×${size.height}、必要 568×320）`;
    this.options.onBlockedChange(blocked);
  }
}
