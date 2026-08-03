import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStageX } from "../src/view/input-math.ts";

test("stage左端・中央・右端を0〜1へ正規化する", () => {
  assert.equal(normalizeStageX(120, 120, 400), 0);
  assert.equal(normalizeStageX(320, 120, 400), 0.5);
  assert.equal(normalizeStageX(520, 120, 400), 1);
  assert.equal(normalizeStageX(80, 120, 400), 0);
  assert.equal(normalizeStageX(600, 120, 400), 1);
});
