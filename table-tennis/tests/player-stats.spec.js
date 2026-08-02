import { expect, test } from "@playwright/test";

async function openDatabase(page) {
  await page.goto("/");
  await expect(page.locator("#openPlayers")).toBeEnabled();
  await expect(page.locator("#playerName")).toHaveText("ゲスト");
}

async function openPlayers(page) {
  await page.locator("#openPlayers").click();
  await expect(page.locator("#players")).toHaveClass(/show/u);
  await expect(page.locator(".player-row")).toHaveCount(1);
}

async function readPlayers(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("table-tennis", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("players", "readonly");
          const getAll = transaction.objectStore("players").getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            database.close();
            resolve(getAll.result);
          };
        };
      }),
  );
}

async function seedDatabase(page, seed) {
  await page.evaluate(
    (data) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("table-tennis", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["players", "matches", "settings"],
            "readwrite",
          );
          for (const player of data.players ?? []) {
            transaction.objectStore("players").put(player);
          }
          for (const match of data.matches ?? []) {
            transaction.objectStore("matches").put(match);
          }
          if (data.selectedPlayerId) {
            transaction.objectStore("settings").put({
              key: "selectedPlayerId",
              value: data.selectedPlayerId,
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    seed,
  );
}

async function countMatches(page, playerId = null) {
  return page.evaluate(
    (id) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("table-tennis", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("matches", "readonly");
          const store = transaction.objectStore("matches");
          const count = id
            ? store.index("playerId").count(IDBKeyRange.only(id))
            : store.count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            database.close();
            resolve(count.result);
          };
        };
      }),
    playerId,
  );
}

test("プレイヤーを追加して選択できる", async ({ page }) => {
  await openDatabase(page);
  await openPlayers(page);

  await page.locator("#playerInput").fill("テスト太郎");
  await page.locator("#playerAdd").click();
  const row = page.locator(".player-row").filter({ hasText: "テスト太郎" });
  await expect(row).toHaveCount(1);
  await row.locator(".player-select").click();

  await expect(page.locator("#playerName")).toHaveText("テスト太郎");
  await expect(page.locator("#hudPlayerName")).toHaveText("テスト太郎");
});

test("不正な名前と重複名を拒否する", async ({ page }) => {
  await openDatabase(page);
  await openPlayers(page);

  for (const [name, message] of [
    ["   ", "名前は1〜12文字で入力してください。"],
    ["あ".repeat(13), "名前は1〜12文字で入力してください。"],
    ["ゲスト", "同じ名前のプレイヤーがすでにいます。"],
  ]) {
    await page.locator("#playerInput").fill(name);
    await page.locator("#playerAdd").click();
    await expect(page.locator("#playerError")).toHaveText(message);
    await expect(page.locator(".player-row")).toHaveCount(1);
  }
});

test("プレイヤーを改名でき、取り消しでは変更しない", async ({ page }) => {
  await openDatabase(page);
  await openPlayers(page);
  const row = page.locator(".player-row").filter({ hasText: "ゲスト" });

  await row.getByRole("button", { name: "改名" }).click();
  await expect(page.locator(".player-rename-input")).toHaveValue("ゲスト");
  await page.locator(".player-rename-input").fill("変更しない");
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(row.locator(".player-select")).toHaveText("ゲスト");

  await row.getByRole("button", { name: "改名" }).click();
  await page.locator(".player-rename-input").fill("テスト花子");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.locator("#hudPlayerName")).toHaveText("テスト花子");
  await expect(
    page.locator(".player-row").filter({ hasText: "テスト花子" }),
  ).toHaveCount(1);
});

test("選択中プレイヤー削除で代替選択と戦績連鎖削除を行う", async ({
  page,
}) => {
  await openDatabase(page);
  const [guest] = await readPlayers(page);
  const targetId = "player-delete";
  const playedAt = "2026-07-28T10:00:00.000Z";
  await seedDatabase(page, {
    players: [
      {
        id: targetId,
        name: "削除対象",
        createdAt: "2026-07-28T09:00:00.000Z",
      },
    ],
    matches: Array.from({ length: 3 }, (_, index) => ({
      id: `delete-match-${index}`,
      playerId: targetId,
      playedAt,
      level: "mid",
      won: index % 2 === 0,
      scoreP: 11,
      scoreA: 8,
      maxRally: 5,
      durationSec: 90,
    })),
    selectedPlayerId: targetId,
  });
  await page.reload();
  await expect(page.locator("#playerName")).toHaveText("削除対象");
  await page.locator("#openPlayers").click();

  const row = page.locator(`[data-player-id="${targetId}"]`);
  await row.getByRole("button", { name: "削除", exact: true }).click();
  await expect(row).toContainText("戦績も一緒に消えます");
  await row.getByRole("button", { name: "削除する" }).click();

  await expect(page.locator("#playerName")).toHaveText(guest.name);
  await expect(row).toHaveCount(0);
  expect(await countMatches(page, targetId)).toBe(0);
});

test("最後の1人は削除できない", async ({ page }) => {
  await openDatabase(page);
  await openPlayers(page);
  const row = page.locator(".player-row");

  await row.getByRole("button", { name: "削除", exact: true }).click();
  await row.getByRole("button", { name: "削除する" }).click();

  await expect(page.locator("#playerError")).toHaveText(
    "最後のプレイヤーは削除できません。",
  );
  await expect(page.locator(".player-row")).toHaveCount(1);
});

test("選択したプレイヤーをリロード後も保持する", async ({ page }) => {
  await openDatabase(page);
  await openPlayers(page);
  await page.locator("#playerInput").fill("次郎");
  await page.locator("#playerAdd").click();
  await page
    .locator(".player-row")
    .filter({ hasText: "次郎" })
    .locator(".player-select")
    .click();
  await expect(page.locator("#playerName")).toHaveText("次郎");

  await page.reload();
  await expect(page.locator("#playerName")).toHaveText("次郎");
  await expect(page.locator("#hudPlayerName")).toHaveText("次郎");
});

test("戦績画面に通算・難易度別・直近履歴を表示する", async ({
  page,
}) => {
  await openDatabase(page);
  const [guest] = await readPlayers(page);
  await seedDatabase(page, {
    matches: [
      {
        id: "stats-easy",
        playerId: guest.id,
        playedAt: "2026-07-28T10:00:00.000Z",
        level: "easy",
        won: true,
        scoreP: 11,
        scoreA: 7,
        maxRally: 8,
        durationSec: 90,
      },
      {
        id: "stats-hard",
        playerId: guest.id,
        playedAt: "2026-07-28T11:00:00.000Z",
        level: "hard",
        won: false,
        scoreP: 9,
        scoreA: 11,
        maxRally: 5,
        durationSec: 125,
      },
    ],
  });

  await page.locator("#openStats").click();
  await expect(page.locator("#stats")).toHaveClass(/show/u);
  await expect(page.locator("#statsSummary")).toContainText("2試合");
  await expect(page.locator("#statsSummary")).toContainText("1勝1敗");
  await expect(page.locator("#statsSummary")).toContainText("勝率 50%");
  await expect(page.locator("#statsSummary")).toContainText("最高ラリー 8");
  await expect(page.locator("#statsByLevel")).toContainText("初級：1試合・1勝");
  await expect(page.locator("#statsByLevel")).toContainText("中級：0試合・0勝");
  await expect(page.locator("#statsByLevel")).toContainText("上級：1試合・0勝");
  await expect(page.locator("#statsRecent")).toContainText("9-11");
  await expect(page.locator("#statsRecent")).toContainText("最大ラリー 5");
  await expect(page.locator("#statsRecent")).toContainText("1分30秒");
  await page.locator("#statsClose").click();
  await expect(page.locator("#stats")).not.toHaveClass(/show/u);
});

test("途中でタイトルへ戻ると試合を記録しない", async ({ page }) => {
  await openDatabase(page);
  await page.locator("#start").click();
  await page.locator("#gear").click();
  await page.locator("#quit").click();
  await expect(page.locator("#title")).toHaveClass(/show/u);

  expect(await countMatches(page)).toBe(0);
});

test("IndexedDBが使えない環境でも試合を開始できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");

  await expect(page.locator("#openPlayers")).toBeDisabled();
  await expect(page.locator("#openStats")).toBeDisabled();
  await expect(page.locator("#playerNotice")).toHaveText(
    "この端末では戦績を保存できません。",
  );
  await page.locator("#start").click();
  await expect(page.locator("#title")).not.toHaveClass(/show/u);
  await expect(page.locator("#scP")).toHaveText("0");
  await expect(page.locator("#scA")).toHaveText("0");
});

test("crypto.randomUUIDが無くてもプレイヤーを追加できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (typeof Crypto !== "undefined") {
      Object.defineProperty(Crypto.prototype, "randomUUID", {
        value: undefined,
        configurable: true,
      });
    }
  });
  await openDatabase(page);
  await openPlayers(page);

  await page.locator("#playerInput").fill("LANテスト");
  await page.locator("#playerAdd").click();
  await expect(
    page.locator(".player-row").filter({ hasText: "LANテスト" }),
  ).toHaveCount(1);
});

test("不正な保存データでは戦績だけを停止してゲームを続けられる", async ({
  page,
}) => {
  await openDatabase(page);
  const [guest] = await readPlayers(page);
  const sensitive = "SECRET-PLAYER-DATA-E20";
  await seedDatabase(page, {
    matches: [
      {
        id: "invalid-match-e20",
        playerId: guest.id,
        playedAt: "2026-08-03T00:00:00.000Z",
        level: "mid",
        won: sensitive,
        scoreP: 11,
        scoreA: 8,
        maxRally: 5,
        durationSec: 90,
      },
    ],
  });
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });

  await page.reload();
  await expect(page.locator("#openPlayers")).toBeDisabled();
  await expect(page.locator("#openStats")).toBeDisabled();
  await expect(page.locator("#playerNotice")).toHaveText(
    "保存データを読み込めません。ゲームは続けられます。",
  );
  expect(await countMatches(page)).toBe(1);
  expect(warnings.join("\n")).not.toContain(sensitive);

  await page.locator("#start").click();
  await expect(page.locator("#title")).not.toHaveClass(/show/u);
});

test("IndexedDBのversionchangeで戦績を停止しアップグレードを妨げない", async ({
  page,
}) => {
  await openDatabase(page);

  const result = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open("table-tennis", 2);
        request.onblocked = () => {
          blocked = true;
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve({ blocked });
        };
      }),
  );
  expect(result).toEqual({ blocked: false });
  await expect(page.locator("#playerNotice")).toHaveText(
    "戦績データを更新するため、ページを再読み込みしてください。ゲームは続けられます。",
  );

  await page.locator("#start").click();
  await expect(page.locator("#title")).not.toHaveClass(/show/u);
});
