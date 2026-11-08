import assert from "node:assert/strict";
import test from "node:test";
import { Renderer } from "../src/render.ts";

test("canvas のレイアウト確定後に Renderer を同期し、destroy で購読を解除する", (t) => {
  const listeners = new Map<string, EventListener>();
  const globals = {
    addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    clearTimeout,
    devicePixelRatio: 2,
  };
  const canvas = {
    clientWidth: 390, clientHeight: 390, width: 0, height: 0,
    getContext: () => ({ setTransform() {} }),
  };
  let notify: (() => void) | undefined;
  let observed: unknown;
  class Observer {
    public constructor(callback: () => void) { notify = callback; }
    public observe(target: unknown): void { observed = target; }
    public disconnect(): void { observed = undefined; }
  }
  Object.defineProperty(globalThis, "window", { value: globals, configurable: true });
  Object.defineProperty(globalThis, "ResizeObserver", { value: Observer, configurable: true });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "ResizeObserver");
  });
  const renderer = new Renderer(canvas as unknown as HTMLCanvasElement, () => {
    throw new Error("resize does not require a scene");
  });
  assert.equal(observed, canvas);
  listeners.get("resize")?.(new Event("resize"));
  canvas.clientWidth = 625;
  assert.deepEqual(renderer.getViewport(), { width: 390, height: 390 });
  notify?.();
  assert.deepEqual(renderer.getViewport(), { width: 625, height: 390 });
  assert.equal(canvas.width, 1250);
  renderer.destroy();
  assert.equal(observed, undefined);
  assert.equal(listeners.size, 0);
});
