import assert from "node:assert/strict";
import test from "node:test";

import { isSuspended } from "../src/view/suspension.ts";

test("停止理由の全8組合せをORで合成する", () => {
  for (const userPaused of [false, true]) {
    for (const documentHidden of [false, true]) {
      for (const viewportBlocked of [false, true]) {
        assert.equal(
          isSuspended({ userPaused, documentHidden, viewportBlocked }),
          userPaused || documentHidden || viewportBlocked,
        );
      }
    }
  }
});
