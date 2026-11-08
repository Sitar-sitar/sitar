import {
  evaluateViewport,
  isViewportBlocked,
  portraitStageSide,
  type ViewportSize,
  type ViewportState,
} from "./layout.ts";

interface ViewportControllerOptions {
  readonly shell: HTMLElement;
  readonly gate: HTMLElement;
  readonly message: HTMLElement;
  readonly onViewportChange: (state: ViewportState) => void;
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
  private state: ViewportState | null = null;

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
    const viewport = currentViewport();
    const { shell, gate, message } = this.options;
    const padding = getComputedStyle(shell);
    const content = {
      width: shell.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight),
      height: shell.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom),
    };
    const next = evaluateViewport({ viewport, content });
    const { dataset, style } = document.body;
    dataset.viewport = next;
    if (next === "portrait") {
      style.setProperty("--portrait-stage-side", `${portraitStageSide(content)}px`);
    } else {
      style.removeProperty("--portrait-stage-side");
    }

    const blocked = isViewportBlocked(next);
    gate.hidden = !blocked;
    gate.setAttribute("aria-hidden", String(!blocked));
    if (next === "portrait-too-small") {
      message.textContent = `画面が小さすぎます（現在 ${content.width}×${content.height}、縦画面は安全領域を除いて 360×664 以上が必要）`;
    } else if (next === "too-small") {
      message.textContent = `画面が小さすぎます（現在 ${viewport.width}×${viewport.height}、横画面は 568×320 以上が必要）`;
    } else {
      message.textContent = "";
    }

    if (next !== this.state) {
      this.state = next;
      this.options.onBlockedChange(blocked);
      this.options.onViewportChange(next);
    }
  }
}
