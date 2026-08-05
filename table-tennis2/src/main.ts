import "./styles.css";

import { Feedback } from "./feedback.ts";
import { Game } from "./game.ts";
import { InputController } from "./input.ts";
import { Renderer } from "./render.ts";
import { formatRecordLabel, summarize } from "./stats.ts";
import { StorageDataError } from "./storage-schema.ts";
import { StatsStore } from "./storage.ts";
import type {
  ControlModel,
  MatchResult,
  PlayerRecord,
  PlayerSelection,
  PlayerStats,
  StatsPhase,
  StatsUnavailableReason,
} from "./types.ts";
import { Ui } from "./ui.ts";
import { mountFeatures, type FeatureSlot } from "./ui/feature.ts";
import { matchContextFeature } from "./ui/features/match-context.ts";
import { servePanelFeature } from "./ui/features/serve-panel.ts";
import { ViewportController } from "./view/orientation.ts";

const canvas = document.getElementById("cv");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#cv Canvasが見つかりません。");
}
const viewportGate = document.getElementById("viewportGate");
const viewportGateMessage = document.getElementById("viewportGateMessage");
if (
  !(viewportGate instanceof HTMLElement) ||
  !(viewportGateMessage instanceof HTMLElement)
) {
  throw new Error("横画面案内が見つかりません。");
}

const ui = new Ui();
const query = new URLSearchParams(window.location.search);
const controlModel: ControlModel =
  query.get("controlModel") === "legacy" ? "legacy" : "direct-paddle-v1";
const debugInput = query.get("debugInput") === "1";
document.body.dataset.controlModel = controlModel;
const gameHolder: { current?: Game } = {};
const feedback = new Feedback(() => ({
  sound: gameHolder.current?.state.sound ?? true,
  vibe: gameHolder.current?.state.vibe ?? true,
}));
const game = new Game(ui, feedback, Math.random, controlModel, debugInput);
gameHolder.current = game;
const featureHosts = {
  "left-rail": document.getElementById("leftRail"),
  "right-rail": document.getElementById("rightRail"),
  "hud-secondary": document.getElementById("hudSecondary"),
  overlay: document.getElementById("overlaySlot"),
} satisfies Record<FeatureSlot, HTMLElement | null>;
for (const [slot, host] of Object.entries(featureHosts)) {
  if (!(host instanceof HTMLElement)) {
    throw new Error(`Feature slotが見つかりません: ${slot}`);
  }
}
mountFeatures(
  [servePanelFeature, matchContextFeature],
  featureHosts as Record<FeatureSlot, HTMLElement>,
  {
    getGameSnapshot: () => game.state,
    subscribe: (listener) => game.subscribe(listener),
    commands: {
      selectServe: (type) => game.selectServe(type),
      selectServeLength: (length) => game.selectServeLength(length),
    },
  },
);
new ViewportController({
  gate: viewportGate,
  message: viewportGateMessage,
  onBlockedChange: (blocked) => game.setViewportBlocked(blocked),
});
let store: StatsStore | null = null;
let statsPhase: StatsPhase = "loading";
let selectedPlayerId: string | null = null;
let selectedPlayer: PlayerRecord | null = null;

const renderer = new Renderer(canvas, () => game.getRenderScene());
const input = new InputController(canvas, {
  onInput: (frame) => game.updatePlayerInput(frame),
  onRelease: (time) => game.releasePlayerInput(time),
  onReset: () => game.resetPlayerInput(),
  onServe: (flick) => game.tryPlayerServe(flick),
  onUserGesture: () => {
    feedback.initializeAudio();
  },
});

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "操作に失敗しました。";
}

function unavailableReason(error: unknown): StatsUnavailableReason {
  return error instanceof StorageDataError
    ? "invalid-data"
    : "open-failed";
}

function setStatsUnavailable(
  reason: StatsUnavailableReason,
  error?: unknown,
): void {
  statsPhase = "unavailable";
  store = null;
  selectedPlayerId = null;
  selectedPlayer = null;
  game.setPlayer(null);
  ui.setStatsPhase("unavailable", reason);
  const details: Record<string, string> = { reason };
  if (error instanceof Error) {
    details.error = error.name;
  }
  if (error instanceof StorageDataError) {
    details.store = error.store;
    details.field = error.field;
  }
  console.warn("戦績機能を停止しました。", details);
}

function readyStore(): StatsStore {
  if (statsPhase !== "ready" || store === null) {
    throw new Error("この端末では戦績を保存できません。");
  }
  return store;
}

async function loadStats(
  statsStore: StatsStore,
  playerId: string,
): Promise<PlayerStats> {
  return summarize(await statsStore.listMatches(playerId));
}

async function applySelection(
  selection: PlayerSelection,
  showPlayers: boolean,
): Promise<PlayerStats> {
  const statsStore = readyStore();
  const player =
    selection.players.find(({ id }) => id === selection.selectedPlayerId) ??
    null;
  if (player === null) {
    throw new Error("選択中のプレイヤーが見つかりません。");
  }

  const stats = await loadStats(statsStore, player.id);
  selectedPlayerId = player.id;
  selectedPlayer = player;
  game.setPlayer(player);
  ui.updatePlayerBar(player.name, stats);
  if (showPlayers) {
    ui.showPlayers(selection.players, player.id);
  }
  return stats;
}

async function readSelection(
  statsStore: StatsStore,
): Promise<PlayerSelection> {
  const [players, storedSelectedPlayerId] = await Promise.all([
    statsStore.listPlayers(),
    statsStore.getSelectedPlayerId(),
  ]);
  return {
    players,
    selectedPlayerId: storedSelectedPlayerId,
  };
}

async function recoverSavedState(): Promise<void> {
  if (store === null) {
    setStatsUnavailable("open-failed");
    return;
  }
  try {
    const selection = await readSelection(store);
    await applySelection(selection, true);
  } catch (error) {
    setStatsUnavailable(unavailableReason(error), error);
  }
}

async function runPlayerOperation(
  operation: (statsStore: StatsStore) => Promise<void>,
): Promise<void> {
  ui.setPlayersBusy(true);
  ui.setPlayerError("");
  try {
    await operation(readyStore());
  } catch (error) {
    if (error instanceof StorageDataError) {
      setStatsUnavailable("invalid-data", error);
      ui.setPlayerError("保存データを読み込めません。");
      return;
    }
    ui.setPlayerError(errorMessage(error));
    await recoverSavedState();
  } finally {
    ui.setPlayersBusy(false);
  }
}

async function bootstrapStats(): Promise<void> {
  statsPhase = "loading";
  ui.setStatsPhase("loading");
  if (typeof globalThis.indexedDB === "undefined") {
    setStatsUnavailable("unsupported");
    return;
  }
  try {
    const opened = await StatsStore.open(() => {
      setStatsUnavailable("version-change");
    });
    if (opened === null) {
      setStatsUnavailable("open-failed");
      return;
    }
    store = opened;
    const selection = await opened.ensureSelection();
    statsPhase = "ready";
    await applySelection(selection, false);
    ui.setStatsPhase("ready");
  } catch (error) {
    setStatsUnavailable(unavailableReason(error), error);
  }
}

async function handleMatchEnd(result: MatchResult): Promise<void> {
  if (
    statsPhase !== "ready" ||
    store === null ||
    result.playerId === null
  ) {
    ui.setResultRecord({
      matchSeq: result.matchSeq,
      status: "unavailable",
      label: "",
    });
    return;
  }

  ui.setResultRecord({
    matchSeq: result.matchSeq,
    status: "pending",
    label: "",
  });
  try {
    await store.recordMatch({
      playerId: result.playerId,
      playedAt: result.playedAt,
      level: result.level,
      won: result.won,
      scoreP: result.scoreP,
      scoreA: result.scoreA,
      maxRally: result.maxRally,
      durationSec: result.durationSec,
    });
    const stats = await loadStats(store, result.playerId);
    ui.setResultRecord({
      matchSeq: result.matchSeq,
      status: "saved",
      label: `${result.playerName ?? "あなた"} の通算 ${formatRecordLabel(stats)}`,
    });
    if (
      result.playerId === selectedPlayerId &&
      selectedPlayer !== null
    ) {
      ui.updatePlayerBar(selectedPlayer.name, stats);
    }
  } catch (error) {
    if (error instanceof StorageDataError) {
      setStatsUnavailable("invalid-data", error);
    }
    ui.setResultRecord({
      matchSeq: result.matchSeq,
      status: "failed",
      label: "",
    });
  }
}

game.attach(input, renderer);
game.bindUi();
ui.bindPlayers({
  add: (name) => {
    void runPlayerOperation(async (statsStore) => {
      await statsStore.addPlayer(name);
      ui.showPlayers(await statsStore.listPlayers(), selectedPlayerId);
    });
  },
  select: (id) => {
    void runPlayerOperation(async (statsStore) => {
      await statsStore.setSelectedPlayerId(id);
      await applySelection(
        {
          players: await statsStore.listPlayers(),
          selectedPlayerId: id,
        },
        true,
      );
    });
  },
  rename: (id, name) => {
    void runPlayerOperation(async (statsStore) => {
      await statsStore.renamePlayer(id, name);
      const selection = await readSelection(statsStore);
      await applySelection(selection, true);
    });
  },
  remove: (id) => {
    void runPlayerOperation(async (statsStore) => {
      const selection = await statsStore.deletePlayer(id);
      await applySelection(selection, true);
    });
  },
  openPlayers: () => {
    void runPlayerOperation(async (statsStore) => {
      const selection = await readSelection(statsStore);
      await applySelection(selection, true);
    });
  },
  openStats: () => {
    void runPlayerOperation(async (statsStore) => {
      const selection = await readSelection(statsStore);
      const stats = await applySelection(selection, false);
      if (selectedPlayer !== null) {
        ui.showStats(selectedPlayer.name, stats);
      }
    });
  },
});
game.onMatchEnd = (result) => {
  void handleMatchEnd(result);
};
game.start();
void bootstrapStats();

document.addEventListener("gesturestart", (event) => {
  event.preventDefault();
});
document.addEventListener("visibilitychange", () => {
  game.handleVisibilityChange();
});
window.addEventListener("pageshow", () => {
  game.handlePageShow();
});
window.addEventListener("pagehide", () => {
  game.handlePageHide();
});

if ("serviceWorker" in navigator) {
  const serviceWorkerPath = document.body.dataset.serviceWorker;
  if (!serviceWorkerPath) {
    throw new Error("Service Worker登録先が設定されていません。");
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(serviceWorkerPath)
      .catch(() => undefined);
  });
}
