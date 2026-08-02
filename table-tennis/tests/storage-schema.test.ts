import assert from "node:assert/strict";
import test from "node:test";

import {
  StorageDataError,
  parseMatchRecord,
  parsePlayerRecord,
  parseSelectedPlayerSetting,
} from "../src/storage-schema.ts";

test("U34: PlayerRecordの形式を検証する", () => {
  const player = {
    id: "player-1",
    name: "ゲスト",
    createdAt: "2026-08-03T00:00:00.000Z",
  };
  assert.deepEqual(parsePlayerRecord(player), player);
  for (const invalid of [
    { ...player, id: "" },
    { ...player, name: " ゲスト" },
    { ...player, name: "あ".repeat(13) },
    { ...player, createdAt: "not-a-date" },
  ]) {
    assert.throws(
      () => parsePlayerRecord(invalid),
      StorageDataError,
    );
  }
});

test("U35: MatchRecordの形式を検証する", () => {
  const match = {
    id: "match-1",
    playerId: "player-1",
    playedAt: "2026-08-03T00:00:00.000Z",
    level: "mid" as const,
    won: true,
    scoreP: 11,
    scoreA: 8,
    maxRally: 5,
    durationSec: 90,
  };
  assert.deepEqual(parseMatchRecord(match), match);
  for (const invalid of [
    { ...match, playerId: "" },
    { ...match, level: "expert" },
    { ...match, won: "yes" },
    { ...match, scoreP: Number.NaN },
    { ...match, durationSec: 1.5 },
  ]) {
    assert.throws(() => parseMatchRecord(invalid), StorageDataError);
  }
});

test("U36: 選択プレイヤー設定の形式を検証する", () => {
  assert.equal(parseSelectedPlayerSetting(undefined), null);
  assert.equal(parseSelectedPlayerSetting(null), null);
  assert.deepEqual(
    parseSelectedPlayerSetting({
      key: "selectedPlayerId",
      value: "player-1",
    }),
    { key: "selectedPlayerId", value: "player-1" },
  );
  assert.throws(
    () =>
      parseSelectedPlayerSetting({ key: "other", value: "player-1" }),
    StorageDataError,
  );
  assert.throws(
    () =>
      parseSelectedPlayerSetting({
        key: "selectedPlayerId",
        value: "",
      }),
    StorageDataError,
  );
});
