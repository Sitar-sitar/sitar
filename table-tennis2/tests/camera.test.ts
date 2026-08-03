import assert from "node:assert/strict";
import test from "node:test";

import { computeCamera } from "../src/view/camera.ts";

test("cameraはstage寸法だけから決定する", () => {
  const compact = computeCamera(400, 320);
  assert.equal(compact.f, 300);
  assert.equal(compact.cx, 200);
  assert.ok(Number.isFinite(compact.cy));
  const wide = computeCamera(900, 412);
  assert.equal(wide.f, 329.6);
  assert.equal(wide.cx, 450);
  assert.ok(Number.isFinite(wide.cy));
});
