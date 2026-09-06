// v0.3.0 §9.2: U-V5 / U-V6 / U-V7 / U-V14
import assert from "node:assert/strict";
import test from "node:test";

import {
  contactQualityLabel,
  hudPulseEvents,
  pointBannerText,
  spinTint,
} from "../src/view/hud-text.ts";

test("U-V5: contactQualityLabel()の境界", () => {
  assert.equal(contactQualityLabel(0.9), "ジャスト");
  assert.equal(contactQualityLabel(0.8999), "ナイス");
  assert.equal(contactQualityLabel(0.75), "ナイス");
  assert.equal(contactQualityLabel(0.7499), "OK");
  assert.equal(contactQualityLabel(0.6), "OK");
  assert.equal(contactQualityLabel(0.5999), "ギリギリ");
  // 初級の品質下限 0.55 でも「ギリギリ」は出る。
  assert.equal(contactQualityLabel(0.55), "ギリギリ");
});

test("U-V6: spinTint()の境界", () => {
  assert.equal(spinTint(0.25).kind, "top");
  assert.equal(spinTint(0.2499).kind, "neutral");
  assert.equal(spinTint(-0.25).kind, "back");
  assert.equal(spinTint(-0.2499).kind, "neutral");
  assert.equal(spinTint(0).kind, "neutral");
});

test("U-V7: pointBannerText()が現行5理由×2得点者を網羅する", () => {
  const expected: Record<string, [string, string]> = {
    ネット: ["あいてがネット", "ネットにかけた"],
    アウト: ["あいてがアウト", "台を外した"],
    返せず: ["あいてが返せず", "返せなかった"],
    サーブフォルト: ["あいてがサーブフォルト", "サーブフォルト"],
    自陣に落下: ["あいてが自陣に落とした", "自陣に落とした"],
  };
  for (const [reason, [forPlayer, forOpponent]] of Object.entries(expected)) {
    const player = pointBannerText("P", reason);
    assert.equal(player.title, "あなたの得点");
    assert.equal(player.detail, forPlayer);
    const opponent = pointBannerText("A", reason);
    assert.equal(opponent.title, "あいての得点");
    assert.equal(opponent.detail, forOpponent);
  }
  // 未知の理由は理由文字列をそのまま返す（防御行）。
  assert.equal(pointBannerText("P", "未知の理由").detail, "未知の理由");
  assert.equal(pointBannerText("A", "未知の理由").detail, "未知の理由");
});

test("U-V14: hudPulseEvents()はエッジでだけ発火する", () => {
  const base = { scP: 3, scA: 2, rally: 4 };
  // 同じスナップショットを20回与えても空。
  for (let index = 0; index < 20; index += 1) {
    assert.deepEqual(hudPulseEvents(base, base), []);
  }
  assert.deepEqual(hudPulseEvents(base, { ...base, scP: 4 }), ["score-P"]);
  assert.deepEqual(hudPulseEvents(base, { ...base, scA: 3 }), ["score-A"]);
  // 減少では出さない。
  assert.deepEqual(hudPulseEvents(base, { ...base, scP: 2 }), []);
  assert.deepEqual(hudPulseEvents(base, { ...base, scA: 1 }), []);

  // rally 4 → 5 で発火、5 → 5 は空、5 → 10 で再度発火。
  assert.deepEqual(
    hudPulseEvents({ scP: 0, scA: 0, rally: 4 }, { scP: 0, scA: 0, rally: 5 }),
    ["rally"],
  );
  assert.deepEqual(
    hudPulseEvents({ scP: 0, scA: 0, rally: 5 }, { scP: 0, scA: 0, rally: 5 }),
    [],
  );
  assert.deepEqual(
    hudPulseEvents({ scP: 0, scA: 0, rally: 5 }, { scP: 0, scA: 0, rally: 10 }),
    ["rally"],
  );
  // rally 0 では出さない。
  assert.deepEqual(
    hudPulseEvents({ scP: 0, scA: 0, rally: 5 }, { scP: 0, scA: 0, rally: 0 }),
    [],
  );
  // 11-9 → 0-0（新規試合）では出さない。
  assert.deepEqual(
    hudPulseEvents({ scP: 11, scA: 9, rally: 7 }, { scP: 0, scA: 0, rally: 0 }),
    [],
  );
});
