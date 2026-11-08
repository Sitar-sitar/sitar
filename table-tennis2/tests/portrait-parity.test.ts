import assert from "node:assert/strict";
import test from "node:test";

import { HW, PADDLE_BLADE_SCALE } from "../src/config.ts";
import { paddleScreenRadius } from "../src/utils.ts";
import {
  evaluateViewport,
  MIN_PORTRAIT_STAGE_SIDE,
  PORTRAIT_RAIL_HEIGHT,
  portraitStageSide,
} from "../src/view/layout.ts";
import { createProjectionCamera, projectWorldPoint } from "../src/view/projection.ts";

const contactZ = -178;

for (const [side, landscapeWidth] of [[390, 625], [412, 677]] as const) {
  test(`辺長 ${side} の縦横stageで焦点距離と地平線が一致する`, () => {
    const portrait = createProjectionCamera(side, side);
    const landscape = createProjectionCamera(landscapeWidth, side);
    assert.equal(portrait.f, landscape.f);
    assert.equal(portrait.cy, landscape.cy);
  });
}

function contactMetrics(width: number, height: number) {
  const camera = createProjectionCamera(width, height);
  const pixelsPerCm = projectWorldPoint(camera, 0, 0, contactZ).s;
  const radius = paddleScreenRadius(width, height, 1);
  return {
    radiusCm: radius / pixelsPerCm,
    reachCm: (width / 2 - radius * PADDLE_BLADE_SCALE) / pixelsPerCm,
  };
}

for (const [side, expectedRadiusCm] of [
  [360, 10.03], [375, 10.45], [390, 10.45],
  [412, 10.45], [430, 10.45], [820, 10.45],
] as const) {
  test(`辺長 ${side} の捕球半径と左右到達距離が縦画面の契約を満たす`, () => {
    const { radiusCm, reachCm } = contactMetrics(side, side);
    assert.ok(Math.abs(radiusCm - expectedRadiusCm) <= 0.01, `捕球半径 ${radiusCm}cm`);
    assert.ok(reachCm > HW, `左右到達 ${reachCm}cm / 台半幅 ${HW}cm`);
  });
}

test("プレイ可能な最小の縦画面で台の横端に届く", () => {
  const viewport = {
    width: MIN_PORTRAIT_STAGE_SIDE,
    height: MIN_PORTRAIT_STAGE_SIDE + PORTRAIT_RAIL_HEIGHT,
  };
  assert.equal(
    evaluateViewport({ viewport, content: viewport }),
    "portrait",
  );
  const side = portraitStageSide(viewport);
  const { reachCm } = contactMetrics(side, side);
  assert.ok(reachCm > HW, `左右到達 ${reachCm}cm / 台半幅 ${HW}cm`);
});
