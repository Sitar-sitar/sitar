import {
  LEVEL_DESCRIPTIONS,
  LEVELS,
  POINT_BANNER_FINAL_SEC,
  POINT_BANNER_SEC,
  SCORE_PULSE_MS,
} from "./config.ts";
import { matchSituation } from "./rules.ts";
import {
  formatRecordLabel,
  formatResultRecordText,
  resolveResultRecord,
} from "./stats.ts";
import type {
  GameState,
  HudSnapshot,
  LevelId,
  MatchSituation,
  PlayerRecord,
  PlayerStats,
  ResultRecord,
  Side,
  StatsPhase,
  StatsUnavailableReason,
} from "./types.ts";
import { effectPolicy, type EffectPolicy } from "./view/effects.ts";
import { hudPulseEvents, pointBannerText } from "./view/hud-text.ts";

const SITUATION_LABELS: Record<
  Exclude<MatchSituation, null>,
  string
> = {
  deuce: "デュース",
  "match-point-P": "マッチポイント",
  "match-point-A": "相手マッチポイント",
};

interface UiHandlers {
  start: () => void;
  playAgain: () => void;
  backToTitle: () => void;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  selectLevel: (level: LevelId) => void;
  toggleSound: () => void;
  toggleVibration: () => void;
}

export interface PlayerUiHandlers {
  add: (name: string) => void;
  select: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  openPlayers: () => void;
  openStats: () => void;
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
  private readonly pointBanner = requiredElement(
    "pointBanner",
    HTMLDivElement,
  );
  private readonly pointBannerTitle = requiredElement(
    "pointBannerTitle",
    HTMLDivElement,
  );
  private readonly pointBannerDetail = requiredElement(
    "pointBannerDetail",
    HTMLDivElement,
  );
  private readonly situation = requiredElement(
    "situation",
    HTMLDivElement,
  );
  private readonly resultMaxRally = requiredElement(
    "rMaxRally",
    HTMLDivElement,
  );
  private readonly serveControls = requiredElement(
    "serveControls",
    HTMLElement,
  );
  private readonly scP = requiredElement("scP", HTMLDivElement);
  private readonly scA = requiredElement("scA", HTMLDivElement);
  private readonly playerScoreCard = requiredElement(
    "playerScoreCard",
    HTMLDivElement,
  );
  private readonly opponentScoreCard = requiredElement(
    "opponentScoreCard",
    HTMLDivElement,
  );
  private readonly levelName = requiredElement(
    "lvName",
    HTMLDivElement,
  );
  private readonly levelDesc = requiredElement(
    "lvDesc",
    HTMLDivElement,
  );
  private readonly rally = requiredElement("rally", HTMLDivElement);
  private readonly playStatus = requiredElement(
    "playStatus",
    HTMLDivElement,
  );
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
  private readonly resultRecordElement = requiredElement(
    "rRecord",
    HTMLDivElement,
  );
  private readonly playersOverlay = requiredElement(
    "players",
    HTMLDivElement,
  );
  private readonly playerList = requiredElement(
    "playerList",
    HTMLDivElement,
  );
  private readonly playerInput = requiredElement(
    "playerInput",
    HTMLInputElement,
  );
  private readonly playerError = requiredElement(
    "playerError",
    HTMLDivElement,
  );
  private readonly statsOverlay = requiredElement(
    "stats",
    HTMLDivElement,
  );
  private readonly statsSummary = requiredElement(
    "statsSummary",
    HTMLDivElement,
  );
  private readonly statsByLevel = requiredElement(
    "statsByLevel",
    HTMLDivElement,
  );
  private readonly statsRecent = requiredElement(
    "statsRecent",
    HTMLDivElement,
  );
  private readonly playerName = requiredElement(
    "playerName",
    HTMLSpanElement,
  );
  private readonly playerRecord = requiredElement(
    "playerRecord",
    HTMLSpanElement,
  );
  private readonly playerNotice = requiredElement(
    "playerNotice",
    HTMLDivElement,
  );
  private readonly hudPlayerName = requiredElement(
    "hudPlayerName",
    HTMLSpanElement,
  );
  private readonly openPlayers = requiredElement(
    "openPlayers",
    HTMLButtonElement,
  );
  private readonly openStats = requiredElement(
    "openStats",
    HTMLButtonElement,
  );
  private flashTime = 0;
  private bannerTime = 0;
  private hudPrev: HudSnapshot = { scP: 0, scA: 0, rally: 0 };
  private policy: EffectPolicy = effectPolicy(false);
  private readonly pulseTimers = new Map<HTMLElement, number>();
  private playerHandlers: PlayerUiHandlers | null = null;
  private playersCache: readonly PlayerRecord[] = [];
  private selectedPlayerId: string | null = null;
  private playersBusy = false;
  private resultRecord: ResultRecord | null = null;
  private resultSeq = -1;

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

    for (const id of ["tgS", "tgS2", "tgSHud"]) {
      requiredElement(id, HTMLButtonElement).addEventListener(
        "click",
        handlers.toggleSound,
      );
    }
    for (const id of ["tgV", "tgV2", "tgVHud"]) {
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
    this.playStatus.textContent =
      state.phase === "serve" && state.server === "P"
        ? "サーブを選ぶ"
        : state.phase === "rally"
          ? "ラリー中"
          : "";
    this.serveP.className = `serve${state.server === "P" ? " on" : ""}`;
    this.serveA.className = `serve${state.server === "A" ? " on" : ""}`;
    document.body.dataset.phase = state.phase;
    document.body.dataset.server = state.server;
    document.body.dataset.selectedServeType = state.selectedServeType;
    document.body.dataset.selectedServeLength =
      state.selectedServeLength;
    this.updateSituation(state);
    this.updateServeZoneAttribute(state);
    this.applyHudPulses(state);
  }

  /** v0.3.0 §5.8.3: null では属性そのものを削除する（空文字を置かない）。 */
  private updateSituation(state: GameState): void {
    const situation = matchSituation(state.scP, state.scA);
    if (situation === null) {
      delete document.body.dataset.situation;
      this.situation.hidden = true;
      this.situation.textContent = "";
      return;
    }
    document.body.dataset.situation = situation;
    this.situation.textContent = SITUATION_LABELS[situation];
    this.situation.hidden = false;
  }

  /**
   * v0.3.0 §5.9.1: 表示条件が真のときだけ置き、偽では削除する。
   * `updateHud()` と `updateServeControls()` の両方からこの関数で更新する。
   * phase が "serve" の間 ball.live は必ず false なので、Renderer 側の
   * `serveZoneVisible()`（!ball.live を含む）と同じ結果になる。
   */
  private updateServeZoneAttribute(state: GameState): void {
    const visible =
      state.phase === "serve" && state.server === "P" && !state.paused;
    if (visible) {
      document.body.dataset.serveZone = state.selectedServeLength;
    } else {
      delete document.body.dataset.serveZone;
    }
  }

  /** v0.3.0 §5.8.4: 240Hz の updateHud() で連打しないようエッジ検出にする。 */
  private applyHudPulses(state: GameState): void {
    const next: HudSnapshot = {
      scP: state.scP,
      scA: state.scA,
      rally: state.rally,
    };
    const pulses = hudPulseEvents(this.hudPrev, next);
    this.hudPrev = next;
    if (!this.policy.hudPulse) {
      return;
    }
    for (const pulse of pulses) {
      if (pulse === "score-P") this.pulse(this.playerScoreCard);
      if (pulse === "score-A") this.pulse(this.opponentScoreCard);
      if (pulse === "rally") this.pulse(this.rally);
    }
  }

  private pulse(element: HTMLElement): void {
    const existing = this.pulseTimers.get(element);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      this.pulseTimers.delete(element);
    }
    element.classList.remove("pulse");
    requestAnimationFrame(() => {
      element.classList.add("pulse");
      this.pulseTimers.set(
        element,
        window.setTimeout(() => {
          element.classList.remove("pulse");
          this.pulseTimers.delete(element);
        }, SCORE_PULSE_MS),
      );
    });
  }

  /** §5.11.1: Ui も effectPolicy() の結果に従う。 */
  public setReducedMotion(reduced: boolean): void {
    this.policy = effectPolicy(reduced);
  }

  /** v0.3.0 §5.1.4: 停止中は装飾アニメーションを静止させる。 */
  public setSuspended(suspended: boolean): void {
    if (suspended) {
      document.body.dataset.suspended = "true";
    } else {
      delete document.body.dataset.suspended;
    }
  }

  /**
   * v0.3.0 §5.8.2: 得点者と理由を文字で示す。最終得点は RESULT_DELAY_MS = 1000ms
   * より前に消えるよう 0.95s とする（RESULT_DELAY_MS は変えない）。
   */
  public showPointBanner(
    winner: Side,
    reason: string,
    isFinal: boolean,
  ): void {
    const text = pointBannerText(winner, reason);
    this.pointBannerTitle.textContent = text.title;
    this.pointBannerDetail.textContent = text.detail;
    this.pointBanner.style.color = winner === "P" ? "#7ee0a8" : "#ff8a6b";
    this.pointBanner.style.opacity = "1";
    this.bannerTime = isFinal ? POINT_BANNER_FINAL_SEC : POINT_BANNER_SEC;
    // バナー表示中はトーストを出さない。
    this.flashTime = 0;
    this.flashElement.style.opacity = "0";
  }

  public updateLevelSelection(level: LevelId): void {
    document.querySelectorAll<HTMLButtonElement>("#lvs [data-lv]").forEach(
      (button) => {
        button.classList.toggle("sel", button.dataset.lv === level);
      },
    );
    this.levelDesc.textContent = LEVEL_DESCRIPTIONS[level];
  }

  public updateServeControls(state: GameState): void {
    const visible =
      state.phase === "serve" && state.server === "P" && !state.paused;
    this.updateServeZoneAttribute(state);
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
    document
      .querySelectorAll<HTMLButtonElement>("[data-serve-length]")
      .forEach((button) => {
        const selected =
          button.dataset.serveLength === state.selectedServeLength;
        button.disabled = !visible;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("sel", selected);
      });
  }

  public flash(text: string, color = "#e8eef3", duration = 0.8): void {
    if (this.bannerTime > 0) {
      return;
    }
    this.flashElement.textContent = text;
    this.flashElement.style.color = color;
    this.flashElement.style.opacity = "1";
    this.flashTime = duration;
  }

  public tickFlash(dt: number): void {
    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      this.pointBanner.style.opacity = String(
        Math.max(0, Math.min(1, this.bannerTime * 3.2)),
      );
    }
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
    this.resetHudBaseline();
    this.title.classList.remove("show");
    this.result.classList.remove("show");
    this.pauseOverlay.classList.remove("show");
  }

  public showTitle(): void {
    this.resetHudBaseline();
    this.result.classList.remove("show");
    this.pauseOverlay.classList.remove("show");
    this.title.classList.add("show");
  }

  /** 11-9 → 0-0 の遷移でパルスを出さないための基準初期化（§5.8.4）。 */
  private resetHudBaseline(): void {
    this.hudPrev = { scP: 0, scA: 0, rally: 0 };
    this.bannerTime = 0;
    this.pointBanner.style.opacity = "0";
    for (const [element, timer] of this.pulseTimers) {
      window.clearTimeout(timer);
      element.classList.remove("pulse");
    }
    this.pulseTimers.clear();
  }

  public showPause(state: GameState): void {
    this.pauseScore.textContent = `${state.levelConfig.name} ／ ${state.scP} - ${state.scA}`;
    this.pauseOverlay.classList.add("show");
  }

  public hidePause(): void {
    this.pauseOverlay.classList.remove("show");
  }

  public showResult(state: GameState, matchSeq: number): void {
    const playerWon = state.scP > state.scA;
    this.resultEye.textContent = playerWon ? "GAME · WIN" : "GAME · LOSE";
    this.resultTitle.textContent = playerWon ? "勝ち" : "負け";
    this.resultScore.textContent = `${state.scP} - ${state.scA}`;
    this.resultSub.textContent = playerWon
      ? `あいて：${state.levelConfig.name} を破りました`
      : `${state.levelConfig.name} に届かず`;
    this.resultMaxRally.textContent = `最長ラリー ${state.maxRally}`;
    this.resultSeq = matchSeq;
    this.resultRecordElement.textContent = formatResultRecordText(
      this.resultRecord,
      this.resultSeq,
    );
    this.result.classList.add("show");
    this.hint([]);
  }

  public bindPlayers(handlers: PlayerUiHandlers): void {
    this.playerHandlers = handlers;
    requiredElement("playerAdd", HTMLButtonElement).addEventListener(
      "click",
      () => {
        handlers.add(this.playerInput.value);
      },
    );
    this.playerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handlers.add(this.playerInput.value);
      }
    });
    this.openPlayers.addEventListener("click", handlers.openPlayers);
    this.openStats.addEventListener("click", handlers.openStats);
    requiredElement("playersClose", HTMLButtonElement).addEventListener(
      "click",
      () => {
        this.hidePlayers();
      },
    );
    requiredElement("statsClose", HTMLButtonElement).addEventListener(
      "click",
      () => {
        this.hideStats();
      },
    );
  }

  public showPlayers(
    players: readonly PlayerRecord[],
    selectedId: string | null,
  ): void {
    this.playersCache = players;
    this.selectedPlayerId = selectedId;
    this.renderPlayers(null, null);
    this.playerInput.value = "";
    this.playersOverlay.classList.add("show");
    this.playerInput.focus();
  }

  public hidePlayers(): void {
    this.playersOverlay.classList.remove("show");
    this.setPlayerError("");
  }

  public setPlayersBusy(busy: boolean): void {
    this.playersBusy = busy;
    this.playersOverlay
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        "input, button",
      )
      .forEach((element) => {
        element.disabled = busy;
      });
  }

  public setPlayerError(message: string): void {
    this.playerError.textContent = message;
  }

  public showStats(name: string, stats: PlayerStats): void {
    this.statsSummary.textContent =
      stats.matches === 0
        ? "記録なし"
        : `通算 ${stats.matches}試合・${formatRecordLabel(stats)}・勝率 ${Math.round(stats.winRate * 100)}%・最高ラリー ${stats.maxRally}`;

    this.statsByLevel.replaceChildren();
    for (const level of ["easy", "mid", "hard"] as const) {
      const row = document.createElement("div");
      row.className = "stats-row";
      const summary = stats.byLevel[level];
      row.textContent = `${LEVELS[level].name}：${summary.matches}試合・${summary.wins}勝`;
      this.statsByLevel.append(row);
    }

    this.statsRecent.replaceChildren();
    if (stats.recent.length === 0) {
      const empty = document.createElement("div");
      empty.className = "stats-empty";
      empty.textContent = "直近の試合はありません。";
      this.statsRecent.append(empty);
    } else {
      for (const match of stats.recent) {
        const row = document.createElement("div");
        row.className = "stats-recent-row";
        const result = match.won ? "勝ち" : "負け";
        const minutes = Math.floor(match.durationSec / 60);
        const seconds = match.durationSec % 60;
        row.textContent =
          `${new Date(match.playedAt).toLocaleString()}・` +
          `${LEVELS[match.level].name}・${result} ${match.scoreP}-${match.scoreA}・` +
          `最大ラリー ${match.maxRally}・${minutes}分${seconds}秒`;
        this.statsRecent.append(row);
      }
    }

    const heading = requiredElement("statsPlayerName", HTMLHeadingElement);
    heading.textContent = `${name} の戦績`;
    this.statsOverlay.classList.add("show");
  }

  public hideStats(): void {
    this.statsOverlay.classList.remove("show");
  }

  public updatePlayerBar(
    name: string,
    stats: PlayerStats | null,
  ): void {
    this.playerName.textContent = name;
    this.hudPlayerName.textContent = name;
    this.hudPlayerName.setAttribute("aria-label", name);
    this.hudPlayerName.title = name;
    this.playerRecord.textContent =
      stats === null ? "" : formatRecordLabel(stats);
  }

  public setStatsPhase(
    phase: StatsPhase,
    reason: StatsUnavailableReason | null = null,
  ): void {
    const unavailable = phase === "unavailable";
    const loading = phase === "loading";
    this.openPlayers.disabled = phase !== "ready";
    this.openStats.disabled = phase !== "ready";
    if (loading) {
      this.playerNotice.textContent = "戦績を準備しています…";
      return;
    }
    if (!unavailable) {
      this.playerNotice.textContent = "";
      return;
    }
    this.playerNotice.textContent =
      reason === "invalid-data"
        ? "保存データを読み込めません。ゲームは続けられます。"
        : reason === "version-change"
          ? "戦績データを更新するため、ページを再読み込みしてください。ゲームは続けられます。"
          : "この端末では戦績を保存できません。";
  }

  public setResultRecord(record: ResultRecord): void {
    this.resultRecord = resolveResultRecord(this.resultRecord, record);
    this.resultRecordElement.textContent = formatResultRecordText(
      this.resultRecord,
      this.resultSeq,
    );
  }

  private renderPlayers(
    activeId: string | null,
    mode: "rename" | "remove" | null,
  ): void {
    this.playerList.replaceChildren();
    let inputToFocus: HTMLInputElement | null = null;

    for (const player of this.playersCache) {
      const row = document.createElement("div");
      row.className = "player-row";
      row.dataset.playerId = player.id;

      if (activeId === player.id && mode === "rename") {
        const input = document.createElement("input");
        input.type = "text";
        input.value = player.name;
        input.className = "player-rename-input";
        input.disabled = this.playersBusy;

        const save = this.createPlayerButton("保存", "player-action");
        const cancel = this.createPlayerButton("やめる", "player-action");
        const submit = (): void => {
          this.playerHandlers?.rename(player.id, input.value);
        };
        save.addEventListener("click", submit);
        cancel.addEventListener("click", () => {
          this.renderPlayers(null, null);
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            this.renderPlayers(null, null);
          }
        });
        row.append(input, save, cancel);
        inputToFocus = input;
      } else if (activeId === player.id && mode === "remove") {
        const message = document.createElement("span");
        message.className = "player-delete-warning";
        message.textContent = "本当に削除？ 戦績も一緒に消えます";
        const remove = this.createPlayerButton(
          "削除する",
          "player-action player-action--danger",
        );
        const cancel = this.createPlayerButton("やめる", "player-action");
        remove.addEventListener("click", () => {
          this.playerHandlers?.remove(player.id);
        });
        cancel.addEventListener("click", () => {
          this.renderPlayers(null, null);
        });
        row.append(message, remove, cancel);
      } else {
        const select = this.createPlayerButton(
          player.name,
          "player-select",
        );
        if (player.id === this.selectedPlayerId) {
          select.setAttribute("aria-current", "true");
        }
        select.addEventListener("click", () => {
          this.playerHandlers?.select(player.id);
        });
        const rename = this.createPlayerButton("改名", "player-action");
        rename.addEventListener("click", () => {
          this.renderPlayers(player.id, "rename");
        });
        const remove = this.createPlayerButton("削除", "player-action");
        remove.addEventListener("click", () => {
          this.renderPlayers(player.id, "remove");
        });
        row.append(select, rename, remove);
      }
      this.playerList.append(row);
    }

    if (inputToFocus !== null) {
      inputToFocus.focus();
      inputToFocus.select();
    }
  }

  private createPlayerButton(
    text: string,
    className: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.disabled = this.playersBusy;
    return button;
  }

  public syncToggles(state: GameState): void {
    for (const id of ["tgS", "tgS2", "tgSHud"]) {
      const button = requiredElement(id, HTMLButtonElement);
      button.classList.toggle("on", state.sound);
      button.setAttribute("aria-pressed", String(state.sound));
    }
    for (const id of ["tgV", "tgV2", "tgVHud"]) {
      const button = requiredElement(id, HTMLButtonElement);
      button.classList.toggle("on", state.vibe);
      button.setAttribute("aria-pressed", String(state.vibe));
    }
  }
}
