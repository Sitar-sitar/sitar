import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRecordLabel,
  formatResultRecordText,
  resolveResultRecord,
  sortPlayers,
  summarize,
} from "../src/stats.ts";
import type {
  MatchRecord,
  PlayerRecord,
  ResultRecord,
} from "../src/types.ts";
import {
  formatUuidV4,
  normalizePlayerName,
} from "../src/utils.ts";

function match(
  id: string,
  playedAt: string,
  overrides: Partial<MatchRecord> = {},
): MatchRecord {
  return {
    id,
    playerId: "player-1",
    playedAt,
    level: "mid",
    won: false,
    scoreP: 8,
    scoreA: 11,
    maxRally: 3,
    durationSec: 90,
    ...overrides,
  };
}

test("summarizeは0件の初期値と3難易度を返す", () => {
  const stats = summarize([]);

  assert.equal(stats.matches, 0);
  assert.equal(stats.wins, 0);
  assert.equal(stats.losses, 0);
  assert.equal(stats.winRate, 0);
  assert.equal(stats.maxRally, 0);
  assert.deepEqual(stats.byLevel, {
    easy: { matches: 0, wins: 0 },
    mid: { matches: 0, wins: 0 },
    hard: { matches: 0, wins: 0 },
  });
  assert.deepEqual(stats.recent, []);
});

test("summarizeは勝敗・勝率・難易度別・最高ラリーを集計する", () => {
  const stats = summarize([
    match("a", "2026-07-28T00:00:00.000Z", {
      level: "easy",
      won: true,
      maxRally: 4,
    }),
    match("b", "2026-07-28T00:01:00.000Z", {
      level: "mid",
      won: false,
      maxRally: 7,
    }),
    match("c", "2026-07-28T00:02:00.000Z", {
      level: "mid",
      won: true,
      maxRally: 5,
    }),
  ]);

  assert.equal(stats.matches, 3);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.winRate, 2 / 3);
  assert.equal(stats.maxRally, 7);
  assert.deepEqual(stats.byLevel.mid, { matches: 2, wins: 1 });
});

test("summarizeは直近10件を決定論的に並べ入力を破壊しない", () => {
  const input = Array.from({ length: 12 }, (_, index) =>
    match(
      String.fromCharCode(97 + index),
      `2026-07-28T00:${String(index).padStart(2, "0")}:00.000Z`,
    ),
  );
  const originalIds = input.map(({ id }) => id);
  const stats = summarize(input);

  assert.equal(stats.recent.length, 10);
  assert.equal(stats.recent[0]!.id, "l");
  assert.equal(stats.recent[9]!.id, "c");
  assert.deepEqual(input.map(({ id }) => id), originalIds);

  const tied = summarize([
    match("b", "2026-07-28T01:00:00.000Z"),
    match("a", "2026-07-28T01:00:00.000Z"),
  ]);
  assert.deepEqual(tied.recent.map(({ id }) => id), ["a", "b"]);
});

test("formatRecordLabelは勝敗または記録なしを返す", () => {
  assert.equal(formatRecordLabel(summarize([])), "記録なし");
  assert.equal(
    formatRecordLabel(
      summarize([
        match("a", "2026-07-28T00:00:00.000Z", { won: true }),
        match("b", "2026-07-28T00:01:00.000Z"),
      ]),
    ),
    "1勝1敗",
  );
});

test("sortPlayersは作成日時とIDで並べ入力を破壊しない", () => {
  const players: PlayerRecord[] = [
    { id: "b", name: "二", createdAt: "2026-07-28T00:00:00.000Z" },
    { id: "c", name: "三", createdAt: "2026-07-27T00:00:00.000Z" },
    { id: "a", name: "一", createdAt: "2026-07-28T00:00:00.000Z" },
  ];

  assert.deepEqual(
    sortPlayers(players).map(({ id }) => id),
    ["c", "a", "b"],
  );
  assert.deepEqual(players.map(({ id }) => id), ["b", "c", "a"]);
});

test("formatUuidV4は決定論的なversion 4 UUIDを作る", () => {
  const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
  const uuid = formatUuidV4(bytes);

  assert.equal(uuid, "00010203-0405-4607-8809-0a0b0c0d0e0f");
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.equal(formatUuidV4(bytes), uuid);
  assert.throws(
    () => formatUuidV4(new Uint8Array(15)),
    /UUIDには16バイトが必要/u,
  );
});

test("normalizePlayerNameはコードポイント数で検証する", () => {
  assert.equal(normalizePlayerName("  テスト太郎  "), "テスト太郎");
  assert.equal(normalizePlayerName("😀".repeat(12)), "😀".repeat(12));
  assert.throws(() => normalizePlayerName("   "), /1〜12文字/u);
  assert.throws(() => normalizePlayerName("あ".repeat(13)), /1〜12文字/u);
  assert.throws(() => normalizePlayerName("😀".repeat(13)), /1〜12文字/u);
});

test("resolveResultRecordは同じ世代の状態更新を採用する", () => {
  const pending: ResultRecord = {
    matchSeq: 1,
    status: "pending",
    label: "",
  };
  const saved: ResultRecord = {
    matchSeq: 1,
    status: "saved",
    label: "ゲスト の通算 1勝0敗",
  };
  const failed: ResultRecord = {
    matchSeq: 1,
    status: "failed",
    label: "",
  };

  assert.equal(resolveResultRecord(null, pending), pending);
  assert.equal(resolveResultRecord(pending, saved), saved);
  assert.equal(resolveResultRecord(pending, failed), failed);
});

test("resolveResultRecordは古い世代を破棄し新しい世代を採用する", () => {
  const current: ResultRecord = {
    matchSeq: 2,
    status: "pending",
    label: "",
  };
  const old: ResultRecord = {
    matchSeq: 1,
    status: "saved",
    label: "古い記録",
  };
  const next: ResultRecord = {
    matchSeq: 3,
    status: "pending",
    label: "",
  };

  assert.equal(resolveResultRecord(current, old), current);
  assert.equal(resolveResultRecord(current, next), next);
});

test("formatResultRecordTextは世代一致時だけ4状態を表示する", () => {
  assert.equal(formatResultRecordText(null, 1), "");
  assert.equal(
    formatResultRecordText(
      { matchSeq: 1, status: "unavailable", label: "" },
      1,
    ),
    "この端末では戦績を保存できません",
  );
  assert.equal(
    formatResultRecordText(
      { matchSeq: 1, status: "pending", label: "" },
      1,
    ),
    "戦績を保存しています…",
  );
  assert.equal(
    formatResultRecordText(
      { matchSeq: 1, status: "saved", label: "通算" },
      1,
    ),
    "通算",
  );
  assert.equal(
    formatResultRecordText(
      { matchSeq: 1, status: "failed", label: "" },
      1,
    ),
    "戦績を保存できませんでした",
  );
  assert.equal(
    formatResultRecordText(
      { matchSeq: 1, status: "saved", label: "古い" },
      2,
    ),
    "",
  );
});
