import "./styles.css";

import { Feedback } from "./feedback.ts";
import { Game } from "./game.ts";
import { InputController } from "./input.ts";
import { Renderer } from "./render.ts";
import { formatRecordLabel, summarize } from "./stats.ts";
import { StatsStore } from "./storage.ts";
import type {
  MatchResult,
  PlayerRecord,
  PlayerSelection,
  PlayerStats,
  StatsPhase,
} from "./types.ts";
import { Ui } from "./ui.ts";

const canvas = document.getElementById("cv");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#cv Canvasが見つかりません。");
}

const ui = new Ui();
const gameHolder: { current?: Game } = {};
const feedback = new Feedback(() => ({
  sound: gameHolder.current?.state.sound ?? true,
  vibe: gameHolder.current?.state.vibe ?? true,
}));
const game = new Game(ui, feedback);
gameHolder.current = game;
let store: StatsStore | null = null;
let statsPhase: StatsPhase = "loading";
let selectedPlayerId: string | null = null;
let selectedPlayer: PlayerRecord | null = null;

const renderer = new Renderer(canvas, () => game.getRenderScene());
const input = new InputController(canvas, {
  getViewport: () => renderer.getViewport(),
  onPosition: (clientX) => {
    game.updatePlayerTarget(clientX);
  },
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

function setStatsUnavailable(): void {
  statsPhase = "unavailable";
  selectedPlayerId = null;
  selectedPlayer = null;
  game.setPlayer(null);
  ui.setStatsPhase("unavailable");
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
    setStatsUnavailable();
    return;
  }
  try {
    const selection = await readSelection(store);
    await applySelection(selection, true);
  } catch {
    setStatsUnavailable();
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
    ui.setPlayerError(errorMessage(error));
    await recoverSavedState();
  } finally {
    ui.setPlayersBusy(false);
  }
}

async function bootstrapStats(): Promise<void> {
  statsPhase = "loading";
  ui.setStatsPhase("loading");
  try {
    const opened = await StatsStore.open();
    if (opened === null) {
      setStatsUnavailable();
      return;
    }
    store = opened;
    const selection = await opened.ensureSelection();
    statsPhase = "ready";
    await applySelection(selection, false);
    ui.setStatsPhase("ready");
  } catch {
    store = null;
    setStatsUnavailable();
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
  } catch {
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
