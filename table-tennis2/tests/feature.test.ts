import assert from "node:assert/strict";
import test from "node:test";

import { validateFeatureModules } from "../src/ui/feature.ts";

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
