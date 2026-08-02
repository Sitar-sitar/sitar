import type { LevelId, MatchRecord, PlayerRecord } from "./types.ts";

const LEVEL_IDS = new Set<LevelId>(["easy", "mid", "hard"]);
const SELECTED_PLAYER_KEY = "selectedPlayerId";

export interface SettingRecord {
  key: string;
  value: string;
}

export class StorageDataError extends Error {
  public readonly store: "players" | "matches" | "settings";
  public readonly field: string;

  public constructor(
    store: "players" | "matches" | "settings",
    field: string,
  ) {
    super(`保存データの形式が不正です（${store}.${field}）。`);
    this.name = "StorageDataError";
    this.store = store;
    this.field = field;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectRecord(
  value: unknown,
  store: StorageDataError["store"],
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new StorageDataError(store, "$record");
  }
  return value;
}

function nonEmptyString(
  value: unknown,
  store: StorageDataError["store"],
  field: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new StorageDataError(store, field);
  }
  return value;
}

function dateString(
  value: unknown,
  store: StorageDataError["store"],
  field: string,
): string {
  const text = nonEmptyString(value, store, field);
  if (!Number.isFinite(Date.parse(text))) {
    throw new StorageDataError(store, field);
  }
  return text;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new StorageDataError("matches", field);
  }
  return value;
}

export function parsePlayerRecord(value: unknown): PlayerRecord {
  const record = objectRecord(value, "players");
  const name = nonEmptyString(record.name, "players", "name");
  if (name.trim() !== name || [...name].length > 12) {
    throw new StorageDataError("players", "name");
  }
  return {
    id: nonEmptyString(record.id, "players", "id"),
    name,
    createdAt: dateString(record.createdAt, "players", "createdAt"),
  };
}

export function parseMatchRecord(value: unknown): MatchRecord {
  const record = objectRecord(value, "matches");
  const level = record.level;
  if (typeof level !== "string" || !LEVEL_IDS.has(level as LevelId)) {
    throw new StorageDataError("matches", "level");
  }
  if (typeof record.won !== "boolean") {
    throw new StorageDataError("matches", "won");
  }
  return {
    id: nonEmptyString(record.id, "matches", "id"),
    playerId: nonEmptyString(record.playerId, "matches", "playerId"),
    playedAt: dateString(record.playedAt, "matches", "playedAt"),
    level: level as LevelId,
    won: record.won,
    scoreP: nonNegativeInteger(record.scoreP, "scoreP"),
    scoreA: nonNegativeInteger(record.scoreA, "scoreA"),
    maxRally: nonNegativeInteger(record.maxRally, "maxRally"),
    durationSec: nonNegativeInteger(record.durationSec, "durationSec"),
  };
}

export function parseSelectedPlayerSetting(
  value: unknown,
): SettingRecord | null {
  if (value === null || value === undefined) {
    return null;
  }
  const record = objectRecord(value, "settings");
  if (record.key !== SELECTED_PLAYER_KEY) {
    throw new StorageDataError("settings", "key");
  }
  return {
    key: SELECTED_PLAYER_KEY,
    value: nonEmptyString(record.value, "settings", "value"),
  };
}
