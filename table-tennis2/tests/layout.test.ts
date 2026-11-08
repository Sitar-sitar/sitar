import assert from "node:assert/strict";
import test from "node:test";

import {
  PORTRAIT_RAIL_HEIGHT,
  evaluateViewport,
  isViewportBlocked,
  portraitStageSide,
  type ViewportMetrics,
  type ViewportState,
} from "../src/view/layout.ts";

interface BoundaryCase {
  readonly viewport: readonly [number, number];
  /** 省略時は viewport と同じ（セーフエリア 0）。 */
  readonly content?: readonly [number, number];
  readonly expected: ViewportState;
  readonly note: string;
}

/** 設計書 §4.1 の境界表。content 列がある行はセーフエリア非ゼロ。 */
const boundaryCases: readonly BoundaryCase[] = [
  { viewport: [390, 844], expected: "portrait", note: "side = min(390, 540) = 390" },
  { viewport: [390, 664], expected: "portrait", note: "side = 360（境界ちょうど）" },
  { viewport: [390, 663], expected: "portrait-too-small", note: "side = 359" },
  { viewport: [360, 664], expected: "portrait", note: "side = min(360, 360) = 360" },
  { viewport: [360, 663], expected: "portrait-too-small", note: "side = 359" },
  { viewport: [359, 844], expected: "portrait-too-small", note: "幅が binding" },
  { viewport: [430, 664], expected: "portrait", note: "レターボックス side = 360" },
  { viewport: [430, 660], expected: "portrait-too-small", note: "side = 356" },
  { viewport: [568, 568], expected: "portrait-too-small", note: "正方形は縦扱い、side = 264" },
  { viewport: [820, 1180], expected: "portrait", note: "side = min(820, 876) = 820" },
  {
    viewport: [390, 844],
    content: [390, 786],
    expected: "portrait",
    note: "inset 上24/下34、side = 390",
  },
  {
    viewport: [360, 664],
    content: [360, 606],
    expected: "portrait-too-small",
    note: "inset 上24/下34、side = 302（F-04 の反例）",
  },
  {
    viewport: [390, 700],
    content: [350, 700],
    expected: "portrait-too-small",
    note: "inset 左右20、side = 350",
  },
  { viewport: [568, 320], expected: "compact-landscape", note: "既存不変" },
  { viewport: [759, 320], expected: "compact-landscape", note: "既存不変" },
  { viewport: [567, 320], expected: "too-small", note: "既存不変" },
  { viewport: [568, 319], expected: "too-small", note: "既存不変" },
  { viewport: [760, 320], expected: "wide-landscape", note: "既存不変" },
  {
    viewport: [568, 320],
    content: [568, 262],
    expected: "compact-landscape",
    note: "横画面しきい値はセーフエリアの影響を受けない",
  },
];

function metrics({ viewport, content }: BoundaryCase): ViewportMetrics {
  const [width, height] = viewport;
  const [contentWidth, contentHeight] = content ?? viewport;
  return {
    viewport: { width, height },
    content: { width: contentWidth, height: contentHeight },
  };
}

for (const boundary of boundaryCases) {
  const [width, height] = boundary.viewport;
  const label = boundary.content
    ? `${width}×${height}（content ${boundary.content[0]}×${boundary.content[1]}）`
    : `${width}×${height}`;
  test(`viewport ${label} を ${boundary.expected} に分類する（${boundary.note}）`, () => {
    assert.equal(evaluateViewport(metrics(boundary)), boundary.expected);
  });
}

test("縦画面のstage辺長をcontent幅とレール控除後のcontent高さで制限する", () => {
  assert.equal(portraitStageSide({ width: 390, height: 844 }), 390);
  assert.equal(portraitStageSide({ width: 360, height: 664 }), 360);
  assert.equal(portraitStageSide({ width: 430, height: 664 }), 360);
  assert.equal(portraitStageSide({ width: 360, height: 606 }), 302);
});

test("stage辺長をCSSへ渡せるよう整数へ切り捨てる", () => {
  assert.equal(portraitStageSide({ width: 390.6, height: 844.4 }), 390);
  assert.equal(portraitStageSide({ width: 820, height: 664.9 }), 360);
});

test("レール控除がPORTRAIT_RAIL_HEIGHTと一致する", () => {
  const height = 1000;
  assert.equal(
    portraitStageSide({ width: 9999, height }),
    height - PORTRAIT_RAIL_HEIGHT,
  );
});

test("非有限または非正数のviewportを拒否する", () => {
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    for (const size of [
      { width: invalid, height: 844 },
      { width: 844, height: invalid },
    ]) {
      assert.equal(portraitStageSide(size), 0);
      assert.equal(
        evaluateViewport({ viewport: size, content: size }),
        "too-small",
      );
      assert.equal(
        evaluateViewport({ viewport: { width: 390, height: 844 }, content: size }),
        "too-small",
      );
    }
  }
});

test("最小寸法未満の縦横画面を停止対象にする", () => {
  assert.equal(isViewportBlocked("portrait-too-small"), true);
  assert.equal(isViewportBlocked("too-small"), true);
  assert.equal(isViewportBlocked("portrait"), false);
  assert.equal(isViewportBlocked("compact-landscape"), false);
  assert.equal(isViewportBlocked("wide-landscape"), false);
});
