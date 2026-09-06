// v0.3.0 §9.2: U-V10（layerKey）/ U-V15（LayerCache の再生成回数）
import assert from "node:assert/strict";
import test from "node:test";

import {
  LayerCache,
  layerKey,
  type LayerSurface,
} from "../src/render/layers.ts";

interface SpyFactory {
  factory: (widthPx: number, heightPx: number) => LayerSurface;
  created: { width: number; height: number }[];
}

function spyFactory(): SpyFactory {
  const created: { width: number; height: number }[] = [];
  return {
    created,
    factory: (widthPx, heightPx) => {
      created.push({ width: widthPx, height: heightPx });
      const context = {
        setTransform: () => undefined,
        clearRect: () => undefined,
      } as unknown as CanvasRenderingContext2D;
      return {
        image: {} as unknown as CanvasImageSource,
        context,
      };
    },
  };
}

test("U-V10: layerKey()は寸法とDPRで一意になる", () => {
  assert.equal(layerKey(844, 390, 2), layerKey(844, 390, 2));
  assert.notEqual(layerKey(844, 390, 2), layerKey(843, 390, 2));
  assert.notEqual(layerKey(844, 390, 2), layerKey(844, 391, 2));
  assert.notEqual(layerKey(844, 390, 2), layerKey(844, 390, 3));
});

test("U-V15: LayerCacheは同じkeyで描画関数を再実行しない", () => {
  const spy = spyFactory();
  const cache = new LayerCache(spy.factory);
  let draws = 0;
  const draw = (): void => {
    draws += 1;
  };

  cache.ensure(844, 390, 2, draw);
  assert.equal(draws, 1);
  assert.equal(spy.created.length, 1);
  assert.deepEqual(spy.created[0], { width: 1688, height: 780 });

  // 同じ key の 2 回目（orientationchange の即時 + 250ms 相当）では描き直さない。
  cache.ensure(844, 390, 2, draw);
  cache.ensure(844, 390, 2, draw);
  assert.equal(draws, 1);
  assert.equal(spy.created.length, 1);

  // width / height / dpr のいずれかが変わると各1回だけ再生成する。
  cache.ensure(843, 390, 2, draw);
  assert.equal(draws, 2);
  cache.ensure(843, 391, 2, draw);
  assert.equal(draws, 3);
  cache.ensure(843, 391, 3, draw);
  assert.equal(draws, 4);
  cache.ensure(843, 391, 3, draw);
  assert.equal(draws, 4);
  assert.equal(spy.created.length, 4);
});

test("U-V15': L0 / L1 の2つのキャッシュはそれぞれ1回だけ再生成する", () => {
  const backdrop = new LayerCache(spyFactory().factory);
  const table = new LayerCache(spyFactory().factory);
  let backdropDraws = 0;
  let tableDraws = 0;
  for (let frame = 0; frame < 10; frame += 1) {
    backdrop.ensure(844, 390, 2, () => {
      backdropDraws += 1;
    });
    table.ensure(844, 390, 2, () => {
      tableDraws += 1;
    });
  }
  assert.equal(backdropDraws, 1);
  assert.equal(tableDraws, 1);

  for (let frame = 0; frame < 10; frame += 1) {
    backdrop.ensure(568, 320, 2, () => {
      backdropDraws += 1;
    });
    table.ensure(568, 320, 2, () => {
      tableDraws += 1;
    });
  }
  assert.equal(backdropDraws, 2);
  assert.equal(tableDraws, 2);
});

test("LayerCacheは寸法0で生成しない", () => {
  const spy = spyFactory();
  const cache = new LayerCache(spy.factory);
  let draws = 0;
  assert.equal(
    cache.ensure(0, 390, 2, () => {
      draws += 1;
    }),
    null,
  );
  assert.equal(
    cache.ensure(844, 0, 2, () => {
      draws += 1;
    }),
    null,
  );
  assert.equal(draws, 0);
  assert.equal(spy.created.length, 0);
});
