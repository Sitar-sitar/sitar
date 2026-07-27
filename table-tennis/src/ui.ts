import { SERVE_TYPES } from "./config.ts";
import type { GameState, LevelId, ServeType } from "./types.ts";

interface UiHandlers {
  start: () => void;
  playAgain: () => void;
  backToTitle: () => void;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  selectLevel: (level: LevelId) => void;
  selectServe: (serveType: ServeType) => void;
  toggleSound: () => void;
  toggleVibration: () => void;
}

function requiredElement<T extends HTMLElement>(
  id: string,
  constructor: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`#${id} が見つからないか、要素型が不正です。`);
  }
  return element;
}

export class Ui {
  private readonly title = requiredElement(
    "title",
    HTMLDivElement,
  );
  private readonly result = requiredElement(
    "result",
    HTMLDivElement,
  );
  private readonly pauseOverlay = requiredElement(
    "pause",
    HTMLDivElement,
  );
  private readonly flashElement = requiredElement(
    "flash",
    HTMLDivElement,
  );
  private readonly hintElement = requiredElement(
    "hint",
    HTMLDivElement,
  );
  private readonly serveControls = requiredElement(
    "serveControls",
    HTMLElement,
  );
  private readonly scP = requiredElement("scP", HTMLDivElement);
  private readonly scA = requiredElement("scA", HTMLDivElement);
  private readonly levelName = requiredElement(
    "lvName",
    HTMLDivElement,
  );
  private readonly rally = requiredElement("rally", HTMLDivElement);
  private readonly serveP = requiredElement("sP", HTMLSpanElement);
  private readonly serveA = requiredElement("sA", HTMLSpanElement);
  private readonly pauseScore = requiredElement(
    "pScore",
    HTMLDivElement,
  );
  private readonly resultEye = requiredElement(
    "rEye",
    HTMLDivElement,
  );
  private readonly resultTitle = requiredElement(
    "rTitle",
    HTMLHeadingElement,
  );
  private readonly resultScore = requiredElement(
    "rScore",
    HTMLDivElement,
  );
  private readonly resultSub = requiredElement(
    "rSub",
    HTMLDivElement,
  );
  private flashTime = 0;

  public bind(handlers: UiHandlers): void {
    requiredElement("start", HTMLButtonElement).addEventListener(
      "click",
      handlers.start,
    );
    requiredElement("again", HTMLButtonElement).addEventListener(
      "click",
      handlers.playAgain,
    );
    requiredElement("back", HTMLButtonElement).addEventListener(
      "click",
      handlers.backToTitle,
    );
    requiredElement("gear", HTMLButtonElement).addEventListener(
      "click",
      handlers.pause,
    );
    requiredElement("resume", HTMLButtonElement).addEventListener(
      "click",
      handlers.resume,
    );
    requiredElement("quit", HTMLButtonElement).addEventListener(
      "click",
      handlers.quit,
    );

    document.querySelectorAll<HTMLButtonElement>("#lvs [data-lv]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const level = button.dataset.lv;
          if (level === "easy" || level === "mid" || level === "hard") {
            handlers.selectLevel(level);
          }
        });
      },
    );

    document
      .querySelectorAll<HTMLButtonElement>("[data-serve-type]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const serveType = button.dataset.serveType;
          if (
            serveType &&
            SERVE_TYPES.includes(serveType as ServeType)
          ) {
            handlers.selectServe(serveType as ServeType);
          }
        });
      });

    for (const id of ["tgS", "tgS2"]) {
      requiredElement(id, HTMLButtonElement).addEventListener(
        "click",
        handlers.toggleSound,
      );
    }
    for (const id of ["tgV", "tgV2"]) {
      requiredElement(id, HTMLButtonElement).addEventListener(
        "click",
        handlers.toggleVibration,
      );
    }
  }

  public updateHud(state: GameState): void {
    this.scP.textContent = String(state.scP);
    this.scA.textContent = String(state.scA);
    this.levelName.textContent = state.levelConfig.name;
    this.rally.textContent = `RALLY ${state.rally}`;
    this.serveP.className = `serve${state.server === "P" ? " on" : ""}`;
    this.serveA.className = `serve${state.server === "A" ? " on" : ""}`;
    document.body.dataset.phase = state.phase;
    document.body.dataset.server = state.server;
    document.body.dataset.selectedServeType = state.selectedServeType;
  }

  public updateLevelSelection(level: LevelId): void {
    document.querySelectorAll<HTMLButtonElement>("#lvs [data-lv]").forEach(
      (button) => {
        button.classList.toggle("sel", button.dataset.lv === level);
      },
    );
  }

  public updateServeControls(state: GameState): void {
    const visible =
      state.phase === "serve" && state.server === "P" && !state.paused;
    this.serveControls.hidden = !visible;
    document
      .querySelectorAll<HTMLButtonElement>("[data-serve-type]")
      .forEach((button) => {
        const selected =
          button.dataset.serveType === state.selectedServeType;
        button.disabled = !visible;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("sel", selected);
      });
  }

  public flash(text: string, color = "#e8eef3", duration = 0.8): void {
    this.flashElement.textContent = text;
    this.flashElement.style.color = color;
    this.flashElement.style.opacity = "1";
    this.flashTime = duration;
  }

  public tickFlash(dt: number): void {
    if (this.flashTime <= 0) {
      return;
    }
    this.flashTime -= dt;
    this.flashElement.style.opacity = String(
      Math.max(0, Math.min(1, this.flashTime * 2.2)),
    );
  }

  public hint(lines: readonly string[]): void {
    this.hintElement.replaceChildren();
    lines.forEach((line, index) => {
      if (index > 0) {
        this.hintElement.append(document.createElement("br"));
      }
      this.hintElement.append(document.createTextNode(line));
    });
  }

  public showGame(): void {
    this.title.classList.remove("show");
    this.result.classList.remove("show");
    this.pauseOverlay.classList.remove("show");
  }

  public showTitle(): void {
    this.result.classList.remove("show");
    this.pauseOverlay.classList.remove("show");
    this.title.classList.add("show");
  }

  public showPause(state: GameState): void {
    this.pauseScore.textContent = `${state.levelConfig.name} ／ ${state.scP} - ${state.scA}`;
    this.pauseOverlay.classList.add("show");
  }

  public hidePause(): void {
    this.pauseOverlay.classList.remove("show");
  }

  public showResult(state: GameState): void {
    const playerWon = state.scP > state.scA;
    this.resultEye.textContent = playerWon ? "GAME · WIN" : "GAME · LOSE";
    this.resultTitle.textContent = playerWon ? "勝ち" : "負け";
    this.resultScore.textContent = `${state.scP} - ${state.scA}`;
    this.resultSub.textContent = playerWon
      ? `あいて：${state.levelConfig.name} を破りました`
      : `${state.levelConfig.name} に届かず`;
    this.result.classList.add("show");
    this.hint([]);
  }

  public syncToggles(state: GameState): void {
    for (const id of ["tgS", "tgS2"]) {
      requiredElement(id, HTMLButtonElement).classList.toggle(
        "on",
        state.sound,
      );
    }
    for (const id of ["tgV", "tgV2"]) {
      requiredElement(id, HTMLButtonElement).classList.toggle(
        "on",
        state.vibe,
      );
    }
  }
}
