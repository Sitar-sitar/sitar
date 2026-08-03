import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateViewport,
  isViewportBlocked,
} from "../src/view/layout.ts";

test("viewport境界を安全側で分類する", () => {
  assert.equal(evaluateViewport({ width: 567, height: 320 }), "too-small");
  assert.equal(evaluateViewport({ width: 568, height: 319 }), "too-small");
  assert.equal(
    evaluateViewport({ width: 568, height: 320 }),
    "compact-landscape",
  );
  assert.equal(
    evaluateViewport({ width: 759, height: 320 }),
    "compact-landscape",
  );
  assert.equal(
    evaluateViewport({ width: 760, height: 320 }),
    "wide-landscape",
  );
  assert.equal(
    evaluateViewport({ width: 568, height: 568 }),
    "portrait-blocked",
  );
});

test("縦画面と最小未満だけを停止対象にする", () => {
  assert.equal(isViewportBlocked("portrait-blocked"), true);
  assert.equal(isViewportBlocked("too-small"), true);
  assert.equal(isViewportBlocked("compact-landscape"), false);
  assert.equal(isViewportBlocked("wide-landscape"), false);
});
