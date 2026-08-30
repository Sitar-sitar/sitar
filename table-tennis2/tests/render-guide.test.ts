import assert from "node:assert/strict";
import test from "node:test";

import { playerContactGuideAlpha } from "../src/render-guide.ts";

test("迎球ガイドalphaはsimulation残り時間の境界に従う", () => {
  assert.equal(playerContactGuideAlpha(0.351), 0.25);
  assert.equal(playerContactGuideAlpha(0.35), 0.4);
  assert.equal(playerContactGuideAlpha(0.101), 0.4);
  assert.equal(playerContactGuideAlpha(0.1), 0.4);
  assert.equal(playerContactGuideAlpha(0.05), 0.2);
  assert.equal(playerContactGuideAlpha(0), 0);
  assert.equal(playerContactGuideAlpha(-0.001), 0);
});
