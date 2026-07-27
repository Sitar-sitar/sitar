import "./styles.css";

import { Feedback } from "./feedback.ts";
import { Game } from "./game.ts";
import { InputController } from "./input.ts";
import { Renderer } from "./render.ts";
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

game.attach(input, renderer);
game.bindUi();
game.start();

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
