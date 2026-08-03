import assert from "node:assert/strict";
import test from "node:test";

import { validateFeatureModules } from "../src/ui/feature.ts";
import {
  formatMatchServerLabel,
  matchContextFeature,
} from "../src/ui/features/match-context.ts";
import type { FeatureServices } from "../src/ui/feature.ts";
import type { GameState } from "../src/types.ts";

function stateWithServer(server: "P" | "A"): Readonly<GameState> {
  return { server } as unknown as Readonly<GameState>;
}

test("FeatureModuleは空idと重複idを拒否する", () => {
  assert.throws(
    () => validateFeatureModules([{ id: "", slot: "overlay" }]),
    /空/u,
  );
  assert.throws(
    () =>
      validateFeatureModules([
        { id: "serve", slot: "right-rail" },
        { id: "serve", slot: "overlay" },
      ]),
    /重複/u,
  );
  assert.doesNotThrow(() =>
    validateFeatureModules([
      { id: "serve", slot: "right-rail" },
      { id: "guide", slot: "left-rail" },
    ]),
  );
});

test("試合文脈は現在サーバーを読み取り専用で表示する", () => {
  assert.equal(formatMatchServerLabel(stateWithServer("P")), "あなた");
  assert.equal(formatMatchServerLabel(stateWithServer("A")), "あいて");

  const value = { textContent: "" } as HTMLElement;
  const host = {
    dataset: {} as DOMStringMap,
    querySelector: () => value,
  } as unknown as HTMLElement;
  let listener: ((state: Readonly<GameState>) => void) | null = null;
  let disposed = false;
  const services = {
    getGameSnapshot: () => stateWithServer("P"),
    subscribe: (next: (state: Readonly<GameState>) => void) => {
      listener = next;
      return () => {
        disposed = true;
      };
    },
    commands: {
      selectServe: () => undefined,
      selectServeLength: () => undefined,
    },
  } satisfies FeatureServices;

  const dispose = matchContextFeature.mount(host, services);
  assert.equal(value.textContent, "あなた");
  assert.equal(host.dataset.featureMounted, "match-context");

  assert.ok(listener !== null);
  const notify = listener as (state: Readonly<GameState>) => void;
  notify(stateWithServer("A"));
  assert.equal(value.textContent, "あいて");

  dispose();
  assert.equal(disposed, true);
  assert.equal(host.dataset.featureMounted, undefined);
});
