import { sortPlayers } from "./stats.ts";
import type {
  MatchRecord,
  PlayerRecord,
  PlayerSelection,
} from "./types.ts";
import { formatUuidV4, normalizePlayerName } from "./utils.ts";

const DATABASE_NAME = "table-tennis";
const DATABASE_VERSION = 1;
const SELECTED_PLAYER_KEY = "selectedPlayerId";

interface SettingRecord {
  key: string;
  value: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("データの読み書きに失敗しました。"));
    });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(
        transaction.error ?? new Error("データの更新を中断しました。"),
      );
    });
    transaction.addEventListener("error", () => {
      reject(
        transaction.error ?? new Error("データの更新に失敗しました。"),
      );
    });
  });
}

async function runTransaction<T>(
  database: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const transaction = database.transaction(stores, mode);
  const done = transactionDone(transaction);
  try {
    const result = await operation(transaction);
    await done;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have aborted because of the request error.
    }
    await done.catch(() => undefined);
    throw error;
  }
}

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

function deleteMatchesByPlayer(
  index: IDBIndex,
  playerId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(playerId));
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (cursor === null) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("戦績の削除に失敗しました。"));
    });
  });
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return formatUuidV4(bytes);
}

export class StatsStore {
  private constructor(private readonly database: IDBDatabase) {}

  public static async open(): Promise<StatsStore | null> {
    if (typeof globalThis.indexedDB === "undefined") {
      return null;
    }

    try {
      return await new Promise((resolve) => {
        let settled = false;
        const finish = (store: StatsStore | null): void => {
          if (!settled) {
            settled = true;
            resolve(store);
          }
        };
        const request = globalThis.indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION,
        );

        request.addEventListener("upgradeneeded", () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("players")) {
            const players = database.createObjectStore("players", {
              keyPath: "id",
            });
            players.createIndex("name", "name", { unique: true });
          }
          if (!database.objectStoreNames.contains("matches")) {
            const matches = database.createObjectStore("matches", {
              keyPath: "id",
            });
            matches.createIndex("playerId", "playerId");
            matches.createIndex("playedAt", "playedAt");
          }
          if (!database.objectStoreNames.contains("settings")) {
            database.createObjectStore("settings", { keyPath: "key" });
          }
        });
        request.addEventListener("success", () => {
          if (settled) {
            request.result.close();
            return;
          }
          finish(new StatsStore(request.result));
        });
        request.addEventListener("error", () => {
          finish(null);
        });
        request.addEventListener("blocked", () => {
          finish(null);
        });
      });
    } catch {
      return null;
    }
  }

  public async listPlayers(): Promise<PlayerRecord[]> {
    const players = await runTransaction(
      this.database,
      "players",
      "readonly",
      (transaction) =>
        requestResult<PlayerRecord[]>(
          transaction.objectStore("players").getAll(),
        ),
    );
    return sortPlayers(players);
  }

  public async addPlayer(name: string): Promise<PlayerRecord> {
    const player: PlayerRecord = {
      id: createId(),
      name: normalizePlayerName(name),
      createdAt: new Date().toISOString(),
    };
    try {
      await runTransaction(
        this.database,
        "players",
        "readwrite",
        async (transaction) => {
          await requestResult(
            transaction.objectStore("players").add(player),
          );
        },
      );
      return player;
    } catch (error) {
      if (isConstraintError(error)) {
        throw new Error("同じ名前のプレイヤーがすでにいます。", {
          cause: error,
        });
      }
      throw error;
    }
  }

  public async renamePlayer(
    id: string,
    name: string,
  ): Promise<PlayerRecord> {
    const normalizedName = normalizePlayerName(name);
    try {
      return await runTransaction(
        this.database,
        "players",
        "readwrite",
        async (transaction) => {
          const store = transaction.objectStore("players");
          const player = await requestResult<PlayerRecord | undefined>(
            store.get(id),
          );
          if (!player) {
            throw new Error("プレイヤーが見つかりません。");
          }
          const updated = { ...player, name: normalizedName };
          await requestResult(store.put(updated));
          return updated;
        },
      );
    } catch (error) {
      if (isConstraintError(error)) {
        throw new Error("同じ名前のプレイヤーがすでにいます。", {
          cause: error,
        });
      }
      throw error;
    }
  }

  public async deletePlayer(id: string): Promise<PlayerSelection> {
    return runTransaction(
      this.database,
      ["players", "matches", "settings"],
      "readwrite",
      async (transaction) => {
        const playersStore = transaction.objectStore("players");
        const playerCount = await requestResult(playersStore.count());
        if (playerCount <= 1) {
          throw new Error("最後のプレイヤーは削除できません。");
        }

        const player = await requestResult<PlayerRecord | undefined>(
          playersStore.get(id),
        );
        if (!player) {
          throw new Error("プレイヤーが見つかりません。");
        }

        await requestResult(playersStore.delete(id));
        const matchesStore = transaction.objectStore("matches");
        await deleteMatchesByPlayer(
          matchesStore.index("playerId"),
          id,
        );

        const players = sortPlayers(
          await requestResult<PlayerRecord[]>(playersStore.getAll()),
        );
        const settingsStore = transaction.objectStore("settings");
        const selected =
          await requestResult<SettingRecord | undefined>(
            settingsStore.get(SELECTED_PLAYER_KEY),
          );
        let selectedPlayerId = selected?.value ?? null;
        if (selectedPlayerId === id) {
          selectedPlayerId = players[0]?.id ?? null;
          if (selectedPlayerId !== null) {
            await requestResult(
              settingsStore.put({
                key: SELECTED_PLAYER_KEY,
                value: selectedPlayerId,
              } satisfies SettingRecord),
            );
          }
        }

        return { players, selectedPlayerId };
      },
    );
  }

  public async getSelectedPlayerId(): Promise<string | null> {
    const selected = await runTransaction(
      this.database,
      "settings",
      "readonly",
      (transaction) =>
        requestResult<SettingRecord | undefined>(
          transaction.objectStore("settings").get(SELECTED_PLAYER_KEY),
        ),
    );
    return selected?.value ?? null;
  }

  public async setSelectedPlayerId(id: string): Promise<void> {
    await runTransaction(
      this.database,
      ["players", "settings"],
      "readwrite",
      async (transaction) => {
        const player = await requestResult<PlayerRecord | undefined>(
          transaction.objectStore("players").get(id),
        );
        if (!player) {
          throw new Error("プレイヤーが見つかりません。");
        }
        await requestResult(
          transaction.objectStore("settings").put({
            key: SELECTED_PLAYER_KEY,
            value: id,
          } satisfies SettingRecord),
        );
      },
    );
  }

  public async ensureSelection(): Promise<PlayerSelection> {
    let players = await this.listPlayers();
    if (players.length === 0) {
      await this.addPlayer("ゲスト");
      players = await this.listPlayers();
    }

    let selectedPlayerId = await this.getSelectedPlayerId();
    if (
      selectedPlayerId === null ||
      !players.some(({ id }) => id === selectedPlayerId)
    ) {
      selectedPlayerId = players[0]?.id ?? null;
      if (selectedPlayerId !== null) {
        await this.setSelectedPlayerId(selectedPlayerId);
      }
    }

    return { players, selectedPlayerId };
  }

  public async recordMatch(
    record: Omit<MatchRecord, "id">,
  ): Promise<MatchRecord> {
    return runTransaction(
      this.database,
      ["players", "matches"],
      "readwrite",
      async (transaction) => {
        const player = await requestResult<PlayerRecord | undefined>(
          transaction.objectStore("players").get(record.playerId),
        );
        if (!player) {
          throw new Error("記録先のプレイヤーが見つかりません。");
        }
        const match: MatchRecord = {
          ...record,
          id: createId(),
        };
        await requestResult(
          transaction.objectStore("matches").add(match),
        );
        return match;
      },
    );
  }

  public async listMatches(playerId: string): Promise<MatchRecord[]> {
    const matches = await runTransaction(
      this.database,
      "matches",
      "readonly",
      (transaction) =>
        requestResult<MatchRecord[]>(
          transaction
            .objectStore("matches")
            .index("playerId")
            .getAll(IDBKeyRange.only(playerId)),
        ),
    );
    return matches.slice().sort((left, right) => {
      if (left.playedAt !== right.playedAt) {
        return left.playedAt > right.playedAt ? -1 : 1;
      }
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  }
}
