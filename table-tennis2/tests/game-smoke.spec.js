import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// cache名は package.json の版数から導出する。テスト側へ固定値を重複させない。
const EXPECTED_CACHE_NAME = `table-tennis2-v${
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    .version
}`;

async function expectServeControlsWithinRightRail(page) {
  const layout = await page.evaluate(() => {
    const controls = document.querySelector("#serveControls");
    const rightRail = document.querySelector("#rightRail");
    if (!(controls instanceof HTMLElement) || !(rightRail instanceof HTMLElement)) {
      throw new Error("サーブ操作または右レールが見つかりません。");
    }
    const panel = controls.getBoundingClientRect();
    const rail = rightRail.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      panel: {
        x: panel.x,
        y: panel.y,
        right: panel.right,
        bottom: panel.bottom,
      },
      rail: {
        x: rail.x,
        y: rail.y,
        right: rail.right,
        bottom: rail.bottom,
      },
    };
  });
  const safeBottom = Math.min(layout.viewport.height, layout.rail.bottom) - 2;

  expect(layout.panel.x).toBeGreaterThanOrEqual(layout.rail.x);
  expect(layout.panel.right).toBeLessThanOrEqual(layout.rail.right);
  expect(layout.panel.y).toBeGreaterThanOrEqual(Math.max(0, layout.rail.y));
  expect(layout.panel.bottom).toBeLessThanOrEqual(safeBottom);

  const buttons = page.locator(
    "#gear, [data-serve-type], [data-serve-length]",
  );
  await expect(buttons).toHaveCount(13);
  for (const button of await buttons.all()) {
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(layout.rail.x);
    expect(box.x + box.width).toBeLessThanOrEqual(layout.rail.right);
    expect(box.y).toBeGreaterThanOrEqual(Math.max(0, layout.rail.y));
    expect(box.y + box.height).toBeLessThanOrEqual(safeBottom);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

test("タイトルから試合を開始できる", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("卓球 横画面");
  await expect(page.locator("#title")).toHaveClass(/show/u);
  await expect(page.locator("#cv")).toBeVisible();

  await page.locator("#start").click();

  await expect(page.locator("#title")).not.toHaveClass(/show/u);
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("#scP")).toHaveText("0");
  await expect(page.locator("#scA")).toHaveText("0");
});

test("v0.2.3はdirect paddleを既定としlegacyへ一時退避できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute(
    "data-control-model",
    "direct-paddle-v1",
  );
  await page.goto("/?controlModel=legacy");
  await expect(page.locator("body")).toHaveAttribute(
    "data-control-model",
    "legacy",
  );
});

test("33ms pointer間隔で16ms予測・6% offset・passive追従を観測できる", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debugInput=1");

  const observed = await page.evaluate(async () => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");
    const rect = canvas.getBoundingClientRect();
    const dispatch = (type, init, ageMs = 0) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        pointerType: "touch",
        pointerId: 41,
        buttons: type === "pointerup" ? 0 : 1,
        ...init,
      });
      Object.defineProperty(event, "timeStamp", {
        value: performance.now() - ageMs,
      });
      canvas.dispatchEvent(event);
    };
    dispatch("pointerdown", {
      clientX: rect.left + rect.width * 0.35,
      clientY: rect.top + rect.height * 0.8,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => {
        const targetX = rect.left + rect.width * (attempt % 2 === 0 ? 0.55 : 0.45);
        dispatch("pointermove", {
          clientX: targetX - rect.width * 0.08,
          clientY: rect.top + rect.height * 0.8,
        }, 33);
        dispatch("pointermove", {
          clientX: targetX,
          clientY: rect.top + rect.height * 0.8,
        });
        resolve();
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (Number(document.body.dataset.predictionMs) > 0) break;
    }
    const tracking = {
      height: rect.height,
      paddleY: Number(document.body.dataset.paddleScreenY),
      predictionMs: Number(document.body.dataset.predictionMs),
      predictionDistance: Number(document.body.dataset.predictionDistancePx),
      strikeActive: document.body.dataset.strikeActive,
      assistScale: document.body.dataset.contactAssistScale,
    };
    dispatch("pointerup", {
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.8,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterRelease = {
      phase: document.body.dataset.paddlePhase,
      predictionMs: Number(document.body.dataset.predictionMs),
      strikeActive: document.body.dataset.strikeActive,
      contactGraceMs: Number(document.body.dataset.contactGraceMs),
    };
    let verticalStrikeActive = "false";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => {
        dispatch("pointercancel", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.8,
          buttons: 0,
        });
        dispatch("pointerdown", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.8,
        }, 33);
        dispatch("pointermove", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.64,
        });
        resolve();
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      verticalStrikeActive = document.body.dataset.strikeActive ?? "false";
      if (verticalStrikeActive === "true") break;
    }
    dispatch("pointercancel", {
      pointerId: 42,
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.64,
      buttons: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterCancel = {
      phase: document.body.dataset.paddlePhase,
      predictionMs: Number(document.body.dataset.predictionMs),
      assistScale: document.body.dataset.contactAssistScale,
    };
    return { ...tracking, afterRelease, verticalStrikeActive, afterCancel };
  });

  expect(observed.predictionMs).toBeGreaterThan(0);
  expect(observed.predictionMs).toBeLessThanOrEqual(16);
  expect(observed.predictionDistance).toBeGreaterThan(0);
  expect(observed.predictionDistance).toBeLessThanOrEqual(observed.height * 0.05 + 0.1);
  expect(Math.abs(observed.paddleY - observed.height * 0.74)).toBeLessThanOrEqual(0.5);
  expect(observed.strikeActive).toBe("false");
  expect(observed.assistScale).toBe("1.40");
  expect(observed.afterRelease.phase).toBe("follow");
  expect(observed.afterRelease.predictionMs).toBe(0);
  expect(observed.afterRelease.strikeActive).toBe("false");
  expect(observed.afterRelease.contactGraceMs).toBeGreaterThan(0);
  // Linux WebKitはworker 1でもrAFが80msを越えることがあるため、瞬間値の
  // active断面はChromiumで固定する。WebKitは本suiteの実衝突とresetを検証する。
  if (browserName !== "webkit") {
    expect(observed.verticalStrikeActive).toBe("true");
  }
  expect(["recover", "idle"]).toContain(observed.afterCancel.phase);
  expect(observed.afterCancel.predictionMs).toBe(0);
  expect(observed.afterCancel.assistScale).toBeUndefined();
});

test("難易度を変更して一時停止できる", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-lv="hard"]').click();
  await expect(page.locator('[data-lv="hard"]')).toHaveClass(/sel/u);

  await page.locator("#start").click();
  await expect(page.locator("#lvName")).toHaveText("上級");

  await page.locator("#gear").click();
  await expect(page.locator("#pause")).toHaveClass(/show/u);
  await expect(page.locator("#pScore")).toContainText("上級");

  await page.locator("#resume").click();
  await expect(page.locator("#pause")).not.toHaveClass(/show/u);
});

test("難易度説明文が選択に追従し、568×320で開始操作が埋もれない", async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/");

  const desc = page.locator("#lvDesc");
  // 初期表示は既定の中級。
  await expect(desc).toHaveText("ふつうの球速。狙って合わせれば返せる");

  await page.locator('[data-lv="easy"]').click();
  await expect(desc).toHaveText(
    "球が遅く、ラケットが当たりやすい。置くだけでも返せる",
  );
  await page.locator('[data-lv="hard"]').click();
  await expect(desc).toHaveText(
    "球が速く逆を突かれる。正確に合わせる必要がある",
  );

  // 説明行の追加で総高は19px増える（22px→41px）。タイトル画面は本変更前から
  // 既にスクロールするため、受入条件は「開始操作が初期表示で可能」であること。
  const start = page.locator("#start");
  await expect(start).toBeVisible();
  const reachable = await page.evaluate(() => {
    const button = document.querySelector("#start");
    if (!button) return null;
    const box = button.getBoundingClientRect();
    return {
      withinViewport: box.top >= 0 && box.bottom <= window.innerHeight,
      height: Math.round(box.height),
    };
  });
  expect(reachable).not.toBeNull();
  expect(reachable.withinViewport).toBe(true);
  expect(reachable.height).toBeGreaterThanOrEqual(44);
  // 44px操作領域は維持する。
  for (const level of ["easy", "mid", "hard"]) {
    const box = await page.locator(`[data-lv="${level}"]`).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  // 実際に押せることまで確認する（説明行の追加で開始操作が埋もれない）。
  await start.click();
  await expect(page.locator("#lvName")).toHaveText("上級");
});

test("844×390では得点をstage両上隅へ分離する", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();

  const boxes = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`${selector} が見つかりません。`);
      }
      const value = element.getBoundingClientRect();
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        right: value.right,
        bottom: value.bottom,
      };
    };
    return {
      stage: rect("#stage"),
      opponent: rect("#opponentScoreCard"),
      meta: rect("#matchMeta"),
      player: rect("#playerScoreCard"),
      gear: rect("#gear"),
      rightRail: rect("#rightRail"),
    };
  });

  expect(boxes.opponent.height).toBeLessThanOrEqual(48);
  expect(boxes.player.height).toBeLessThanOrEqual(48);
  expect(boxes.meta.height).toBeLessThanOrEqual(28);
  expect(boxes.opponent.x).toBeGreaterThanOrEqual(boxes.stage.x);
  expect(boxes.player.right).toBeLessThanOrEqual(boxes.stage.right);
  expect(boxes.opponent.right).toBeLessThan(boxes.meta.x);
  expect(boxes.meta.right).toBeLessThan(boxes.player.x);
  expect(boxes.opponent.right).toBeLessThan(
    boxes.stage.x + boxes.stage.width / 2,
  );
  expect(boxes.player.x).toBeGreaterThan(
    boxes.stage.x + boxes.stage.width / 2,
  );
  expect(boxes.gear.x).toBeGreaterThanOrEqual(boxes.rightRail.x);
  expect(boxes.gear.right).toBeLessThanOrEqual(boxes.rightRail.right);

  await expect(page.locator("#leftRail")).toBeVisible();
  await expect(page.locator("[data-match-server]")).toHaveText("あなた");
});

test("568×320でも両得点とサーブ操作を画面内に保つ", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("#leftRail")).toBeHidden();
  await expect(page.locator("#opponentScoreCard")).toBeVisible();
  await expect(page.locator("#playerScoreCard")).toBeVisible();
  await expect(page.locator("#matchMeta")).toBeVisible();
  await expect(page.locator("#tgSHud")).toBeHidden();
  await expect(page.locator("#tgVHud")).toBeHidden();

  const boxes = await page.evaluate(() => {
    const selectors = [
      "#stage",
      "#opponentScoreCard",
      "#matchMeta",
      "#playerScoreCard",
      "#rightRail",
      "#gear",
      "#serveControls",
    ];
    return Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`${selector} が見つかりません。`);
        }
        const rect = element.getBoundingClientRect();
        return [selector, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        }];
      }),
    );
  });

  expect(boxes["#opponentScoreCard"].height).toBeLessThanOrEqual(44);
  expect(boxes["#playerScoreCard"].height).toBeLessThanOrEqual(44);
  expect(boxes["#matchMeta"].height).toBeLessThanOrEqual(24);
  for (const selector of [
    "#opponentScoreCard",
    "#matchMeta",
    "#playerScoreCard",
  ]) {
    expect(boxes[selector].x).toBeGreaterThanOrEqual(boxes["#stage"].x);
    expect(boxes[selector].right).toBeLessThanOrEqual(
      boxes["#stage"].right,
    );
  }
  expect(boxes["#gear"].width).toBeGreaterThanOrEqual(44);
  expect(boxes["#gear"].height).toBeGreaterThanOrEqual(44);
  await expectServeControlsWithinRightRail(page);
});

test("759×360ではcompact配置を維持し、760×360でleft railへ切り替える", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });

  for (const [width, leftRailVisible] of [[759, false], [760, true]]) {
    await page.setViewportSize({ width, height: 360 });
    await page.goto("/");
    await page.locator("#start").click();
    if (leftRailVisible) {
      await expect(page.locator("#leftRail")).toBeVisible();
    } else {
      await expect(page.locator("#leftRail")).toBeHidden();
    }
    await expectServeControlsWithinRightRail(page);
  }
});

test("HUDから音と振動を切り替え一時停止表示と同期する", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");

  await expect(page.locator("#tgSHud")).toBeVisible();
  await expect(page.locator("#tgVHud")).toBeVisible();
  await page.locator("#tgSHud").click();
  await page.locator("#tgVHud").click();
  await expect(page.locator("#tgSHud")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#tgVHud")).toHaveAttribute("aria-pressed", "false");

  await page.locator("#gear").click();
  await expect(page.locator("#tgS2")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#tgV2")).toHaveAttribute("aria-pressed", "false");
});

test("PWA登録とオフライン用キャッシュを確認できる", async ({
  browserName,
  context,
  page,
}) => {
  const consoleFailures = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleFailures.push(message.text());
    }
  });
  await page.goto("/");

  const scriptUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });

  expect(scriptUrl).toMatch(/\/sw\.js$/u);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 10_000 },
  );
  await page.reload();
  await expect(page.locator("#openStats")).toBeEnabled();

  if (browserName === "webkit") {
    const cachedPaths = await page.evaluate(async () => {
      const cacheName = (await caches.keys()).find((key) =>
        key.startsWith("table-tennis2-"),
      );
      if (!cacheName) {
        return [];
      }
      return (await (await caches.open(cacheName)).keys()).map(
        (request) => new URL(request.url).pathname,
      );
    });
    expect(cachedPaths).toEqual(
      expect.arrayContaining([
        "/",
        "/index.html",
        "/assets/app.js",
        "/assets/app.css",
      ]),
    );
    return;
  }

  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveTitle("卓球 横画面");
  await expect(page.locator("#playerName")).toHaveText("ゲスト");
  await expect(page.locator("#openStats")).toBeEnabled();
  expect(consoleFailures).toEqual([]);
});

test("Service Worker登録失敗を警告しゲームを継続する", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.addInitScript(() => {
    const originalWarn = console.warn.bind(console);
    window.__serviceWorkerWarningArgs = [];
    window.__unhandledRejections = [];
    console.warn = (...args) => {
      window.__serviceWorkerWarningArgs.push(
        args.map((argument) => argument instanceof Error
          ? { name: argument.name, message: argument.message }
          : argument),
      );
      originalWarn(...args);
    };
    window.addEventListener("unhandledrejection", (event) => {
      window.__unhandledRejections.push(
        event.reason instanceof Error ? event.reason.message : String(event.reason),
      );
    });
    Object.defineProperty(ServiceWorkerContainer.prototype, "register", {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error("TEST_SW_REGISTER_FAILED")),
    });
  });

  await page.goto("/");
  await expect.poll(() => page.evaluate(
    () => window.__serviceWorkerWarningArgs.length,
  )).toBe(1);
  await expect(page.locator("#title")).toHaveClass(/show/u);
  await page.locator("#start").click();
  await expect(page.locator("#board")).toBeVisible();

  expect(await page.evaluate(() => window.__serviceWorkerWarningArgs)).toEqual([
    ["Service Worker の登録に失敗しました。", {
      name: "Error",
      message: "TEST_SW_REGISTER_FAILED",
    }],
  ]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("9種類のサーブを3×3で選択して実行できる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  const serveTypes = [
    "topspin-left",
    "topspin",
    "topspin-right",
    "side-left",
    "knuckle",
    "side-right",
    "backspin-left",
    "backspin",
    "backspin-right",
  ];
  await expect(page.locator("[data-serve-type]")).toHaveCount(9);
  expect(
    await page
      .locator("[data-serve-type]")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.serveType),
      ),
  ).toEqual(serveTypes);
  for (const serveType of serveTypes) {
    const button = page.locator(`[data-serve-type="${serveType}"]`);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator('[data-serve-type="knuckle"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-serve-type="knuckle"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("#flash")).toHaveText("ナックルサーブ（中）");
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-type",
    "knuckle",
  );
  await expect(controls).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");
});

test("Service Workerは他世代キャッシュの同一URLを参照しない", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 10_000 },
  );
  await page.reload();

  const result = await page.evaluate(async (expectedCacheName) => {
    const currentName = (await caches.keys()).find(
      (key) => key === expectedCacheName,
    );
    if (!currentName) throw new Error("現行キャッシュがありません。");
    const current = await caches.open(currentName);
    const appUrl = new URL("./assets/app.js", location.href).href;
    await current.delete(appUrl);
    const staleName = "table-tennis2-stale-e22";
    const stale = await caches.open(staleName);
    const poison = "SECRET-POISON-E22";
    await stale.put(
      appUrl,
      new Response(poison, {
        headers: { "content-type": "text/javascript" },
      }),
    );
    try {
      const response = await fetch(appUrl, { cache: "reload" });
      const body = await response.text();
      const refilled = await current.match(appUrl);
      return {
        poisoned: body.includes(poison),
        refilled: Boolean(refilled),
      };
    } finally {
      await caches.delete(staleName);
    }
  }, EXPECTED_CACHE_NAME);

  expect(result).toEqual({ poisoned: false, refilled: true });
});

test("サーブ長3種を選択できポイントと再試合をまたいで保持する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();

  const serveLengths = ["short", "middle", "long"];
  for (const serveLength of serveLengths) {
    const button = page.locator(
      `[data-serve-length="${serveLength}"]`,
    );
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator('[data-serve-length="short"]').click();
  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-length",
    "short",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-selected-serve-length",
    "short",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "serve",
    { timeout: 10_000 },
  );
  await expect(page.locator('[data-serve-length="short"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("#gear").click();
  await page.locator("#quit").click();
  await page.locator("#start").click();
  await expect(page.locator('[data-serve-length="short"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("AIサーブから自動でラリーが始まる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("#serveControls")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "rally",
    { timeout: 3000 },
  );

  // E-V2: 得点で #pointBanner が出て、増えた側の得点バッジにパルスが付く。
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "point",
    { timeout: 15_000 },
  );
  await expect(page.locator("#pointBanner")).toContainText("の得点");
  await expect(page.locator("#opponentScoreCard")).toHaveClass(/pulse/u);
});

test("E-V2': reduced-motionでは得点バッジにパルスを付けない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "point",
    { timeout: 15_000 },
  );
  await expect(page.locator("#pointBanner")).toContainText("の得点");
  await expect(page.locator("#opponentScoreCard")).not.toHaveClass(/pulse/u);
});

test("合成pointer入力でdirect paddleが実衝突して返球する", async ({ page }) => {
  await page.addInitScript(() => {
    const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let index = 0;
    Math.random = () => values[index++] ?? 0.5;
  });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-length",
    "short",
    { timeout: 3000 },
  );

  const observed = await page.evaluate(async () => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("E14に必要なDOMが見つかりません。");
    }
    const dispatch = (type, init) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          isPrimary: true,
          pointerType: "touch",
          ...init,
        }),
      );
    };
    const pointerId = 1;
    let sawGuide = false;
    const firstRect = canvas.getBoundingClientRect();
    dispatch("pointerdown", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 1,
    });
    for (let frame = 0; frame < 360 && !document.body.dataset.directShot; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      sawGuide ||= [
        document.body.dataset.predictedContactX,
        document.body.dataset.predictedContactY,
        document.body.dataset.predictedContactRemainingMs,
      ].every((value) => Number.isFinite(Number(value)));
      const rect = canvas.getBoundingClientRect();
      const ballX = Number(document.body.dataset.ballScreenX);
      const ballY = Number(document.body.dataset.ballScreenY);
      if (!Number.isFinite(ballX) || !Number.isFinite(ballY)) continue;
      dispatch("pointermove", {
        pointerId,
        clientX: rect.left + Math.max(1, Math.min(rect.width - 1, ballX)),
        clientY:
          rect.top +
          Math.max(1, Math.min(rect.height - 1, ballY + rect.height * 0.06)),
        buttons: 1,
      });
    }
    dispatch("pointerup", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 0,
    });
    return {
      sawGuide,
      predictedContactX: document.body.dataset.predictedContactX,
      predictedContactY: document.body.dataset.predictedContactY,
      screenQuality: Number(document.body.dataset.screenQuality),
      timingQuality: Number(document.body.dataset.timingQuality),
      contactQuality: Number(document.body.dataset.contactQuality),
    };
  });

  await expect(page.locator("body")).toHaveAttribute(
    "data-direct-shot",
    /DRIVE|SMASH|PUSH|CHOP|LOB|STOP|FLICK/u,
  );
  expect(observed.sawGuide).toBe(true);
  expect(observed.predictedContactX).toBeUndefined();
  expect(observed.predictedContactY).toBeUndefined();
  expect(observed.screenQuality).toBeGreaterThanOrEqual(0);
  expect(observed.timingQuality).toBeGreaterThanOrEqual(0);
  expect(observed.contactQuality).toBeGreaterThanOrEqual(0.4);

  // E-V1: direct 経路のトーストは「打球名・品質ラベル」の形式になる。
  // 瞬間表示の観測は Chromium 責務（Obsidian注意点23）。
  if (test.info().project.name === "desktop-chromium") {
    await expect(page.locator("#flash")).toHaveText(
      /・(ジャスト|ナイス|OK|ギリギリ)$/u,
    );
  }
});

test("touch release後160ms超の迎球はpassive PUSHになりguideを消費する", async ({ page }) => {
  await page.addInitScript(() => {
    const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let index = 0;
    Math.random = () => values[index++] ?? 0.5;
  });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-server", "A");

  const releaseMinMs = 160;
  const observed = await page.evaluate(async (releaseMin) => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");
    let releasedWithMs = 0;
    let firstGuideMs = 0;
    await new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, 8_000);
      const observer = new MutationObserver(() => {
        const remaining = Number(document.body.dataset.predictedContactRemainingMs);
        if (Number.isFinite(remaining) && remaining > 0 && firstGuideMs === 0) {
          firstGuideMs = remaining;
        }
        if (!Number.isFinite(remaining) || remaining < releaseMin || remaining > 300) return;
        const guideX = Number(document.body.dataset.predictedContactX);
        const guideY = Number(document.body.dataset.predictedContactY);
        if (!Number.isFinite(guideX) || !Number.isFinite(guideY)) return;
        const rect = canvas.getBoundingClientRect();
        const common = {
          bubbles: true,
          isPrimary: true,
          pointerType: "touch",
          pointerId: 77,
          clientX: rect.left + guideX,
          clientY: rect.top + guideY + rect.height * 0.06,
        };
        canvas.dispatchEvent(new PointerEvent("pointerdown", { ...common, buttons: 1 }));
        canvas.dispatchEvent(new PointerEvent("pointerup", { ...common, buttons: 0 }));
        releasedWithMs = remaining;
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve();
      });
      observer.observe(document.body, { attributes: true });
    });
    for (let frame = 0; frame < 240 && !document.body.dataset.directShot; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return {
      releasedWithMs,
      firstGuideMs,
      directShot: document.body.dataset.directShot,
      guideX: document.body.dataset.predictedContactX,
      guideY: document.body.dataset.predictedContactY,
      contactGraceMs: Number(document.body.dataset.contactGraceMs),
      contactQuality: Number(document.body.dataset.contactQuality),
    };
  }, releaseMinMs);

  expect(observed.releasedWithMs, JSON.stringify(observed)).toBeGreaterThanOrEqual(releaseMinMs);
  expect(observed.releasedWithMs).toBeLessThanOrEqual(300);
  expect(observed.directShot).toBe("PUSH");
  expect(observed.guideX).toBeUndefined();
  expect(observed.guideY).toBeUndefined();
  expect(observed.contactGraceMs).toBe(0);
  expect(observed.contactQuality).toBeGreaterThanOrEqual(0.4);
});

test("pagehideからpageshowへ復帰してもAIサーブは一度だけ始まる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.evaluate(() => {
    window.__aiServeExecutions = 0;
    new MutationObserver((records) => {
      window.__aiServeExecutions += records.filter(
        (record) => record.attributeName === "data-served-serve-type",
      ).length;
    }).observe(document.body, { attributes: true });
  });
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).toHaveAttribute("data-phase", "serve");
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });

  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "rally",
    { timeout: 3000 },
  );
  await expect
    .poll(() => page.evaluate(() => window.__aiServeExecutions))
    .toBe(1);
  await page.waitForTimeout(100);
  await expect
    .poll(() => page.evaluate(() => window.__aiServeExecutions))
    .toBe(1);
});

test("縦画面を停止し横画面へ戻すと操作できる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#viewportGate")).toBeVisible();
  await expect(page.locator("#viewportGateMessage")).toHaveText(
    "端末を横向きにしてください",
  );

  await page.setViewportSize({ width: 568, height: 320 });
  await expect(page.locator("#viewportGate")).toBeHidden();
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  await expectServeControlsWithinRightRail(page);
});

// --- v0.3.0 §9.3: グラフィック強化と演出のE2E ---

/** 合成pointer入力でdirect接触を起こし、その間の data-particles-live の最大値を返す。 */
async function driveSyntheticContact(page, frames = 360) {
  return page.evaluate(async (maxFrames) => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("#cv が見つかりません。");
    }
    const dispatch = (type, init) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          isPrimary: true,
          pointerType: "touch",
          ...init,
        }),
      );
    };
    const pointerId = 1;
    const firstRect = canvas.getBoundingClientRect();
    let maxParticles = 0;
    let sawContact = false;
    let framesAfterContact = 0;
    dispatch("pointerdown", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 1,
    });
    for (let frame = 0; frame < maxFrames; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const live = Number(document.body.dataset.particlesLive ?? 0);
      if (Number.isFinite(live)) maxParticles = Math.max(maxParticles, live);
      if (sawContact) framesAfterContact += 1;
      sawContact ||= Boolean(document.body.dataset.directShot);
      // 接触後も粒子寿命 0.28s ぶんを観測してから止める。
      if (framesAfterContact > 20) break;
      const rect = canvas.getBoundingClientRect();
      const ballX = Number(document.body.dataset.ballScreenX);
      const ballY = Number(document.body.dataset.ballScreenY);
      if (!Number.isFinite(ballX) || !Number.isFinite(ballY)) continue;
      dispatch("pointermove", {
        pointerId,
        clientX: rect.left + Math.max(1, Math.min(rect.width - 1, ballX)),
        clientY:
          rect.top +
          Math.max(1, Math.min(rect.height - 1, ballY + rect.height * 0.06)),
        buttons: 1,
      });
    }
    dispatch("pointerup", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 0,
    });
    return { maxParticles, sawContact };
  }, frames);
}

test("E-V3: full/reducedで接触スパークの有無が入れ替わる", async ({ page }) => {
  // 合成接触を使うため Desktop Chromium のみ（Obsidian注意点23）。
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "合成接触の観測は Desktop Chromium の責務",
  );
  await page.addInitScript(() => {
    const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let index = 0;
    Math.random = () => values[index++] ?? 0.5;
  });

  await page.goto("/?debugInput=1");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "full");
  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  const full = await driveSyntheticContact(page);
  expect(full.sawContact).toBe(true);
  expect(full.maxParticles).toBeGreaterThanOrEqual(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  const reduced = await driveSyntheticContact(page);
  expect(reduced.sawContact).toBe(true);
  expect(reduced.maxParticles).toBe(0);
});

test("E-V4: data-serve-zoneはplayer serve時だけ選択長さを反映する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "P");
  for (const length of ["short", "middle", "long"]) {
    await page.locator(`[data-serve-length="${length}"]`).click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-serve-zone",
      length,
    );
  }

  // 一時停止中は属性が存在しない。
  await page.locator("#gear").click();
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-serve-zone",
    /./u,
  );
  await page.locator("#resume").click();
  await expect(page.locator("body")).toHaveAttribute("data-serve-zone", "long");

  // サーブ後（ラリー中）は属性が存在しない。
  await page.locator("#cv").click({ position: { x: 400, y: 260 } });
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-serve-zone",
    /./u,
  );
});

test("E-V4': AIサーブ時はdata-serve-zoneが存在しない", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-serve-zone",
    /./u,
  );
});

test("E-V5: 状況チップは初期非表示でHUD寸法契約を変えない", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("#situation")).toBeHidden();
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-situation",
    /./u,
  );

  const observed = await page.evaluate(() => {
    const pointerEvents = (selector) =>
      window.getComputedStyle(document.querySelector(selector)).pointerEvents;
    const rect = (selector) => {
      const value = document.querySelector(selector).getBoundingClientRect();
      return { width: value.width, height: value.height };
    };
    return {
      banner: pointerEvents("#pointBanner"),
      situation: pointerEvents("#situation"),
      flash: pointerEvents("#flash"),
      opponent: rect("#opponentScoreCard"),
      player: rect("#playerScoreCard"),
      meta: rect("#matchMeta"),
    };
  });
  expect(observed.banner).toBe("none");
  expect(observed.situation).toBe("none");
  expect(observed.flash).toBe("none");
  // v0.1.1 の寸法契約（wide: 92×48 / 132×28）を維持する。
  expect(observed.opponent.width).toBeLessThanOrEqual(92);
  expect(observed.opponent.height).toBeLessThanOrEqual(48);
  expect(observed.player.width).toBeLessThanOrEqual(92);
  expect(observed.player.height).toBeLessThanOrEqual(48);
  expect(observed.meta.width).toBeLessThanOrEqual(132);
  expect(observed.meta.height).toBeLessThanOrEqual(28);
});

test("E-V6: 最終得点でもバナーと死球が出てリザルトへ遷移する", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "所要時間のため Desktop Chromium のみ",
  );
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();

  // 返球はせず、自分のサーブ順のときだけ台をタップして試合を進め、決着まで持っていく。
  // （AIサーブの放置だけでは2点でサーブ権がプレイヤーへ移り試合が止まる。）
  const deadline = Date.now() + 120_000;
  let phase = "";
  while (Date.now() < deadline) {
    phase = await page.evaluate(() => document.body.dataset.phase ?? "");
    if (phase === "over") break;
    if (
      phase === "serve" &&
      (await page.evaluate(() => document.body.dataset.server)) === "P"
    ) {
      await page.locator("#cv").click({ position: { x: 400, y: 260 } });
    }
    await page.waitForTimeout(120);
  }
  expect(phase).toBe("over");
  const scores = await page.evaluate(() => ({
    player: Number(document.querySelector("#scP").textContent),
    opponent: Number(document.querySelector("#scA").textContent),
  }));
  expect(Math.max(scores.player, scores.opponent)).toBeGreaterThanOrEqual(11);

  // 最終得点でもバナーと死球が出る（phase は既に over）。
  await expect(page.locator("#pointBanner")).toContainText("の得点");
  await expect(page.locator("body")).toHaveAttribute("data-dead-ball", "1");
  await expect(page.locator("#result")).toHaveClass(/show/u, {
    timeout: 4000,
  });
  await expect(page.locator("#rMaxRally")).toContainText("最長ラリー");
  // 死球は寿命で必ず消え、over のまま永続しない。
  await expect(page.locator("body")).toHaveAttribute("data-dead-ball", "0", {
    timeout: 4000,
  });
});

test("E-V7: 一時停止中は視覚時計が止まり情報表示が保持される", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "point", {
    timeout: 15_000,
  });

  await page.locator("#gear").click();
  await expect(page.locator("body")).toHaveAttribute("data-suspended", "true");
  const before = await page.evaluate(() => ({
    simTime: document.body.dataset.effectsSimTime,
    bannerOpacity: document.querySelector("#pointBanner").style.opacity,
  }));
  await page.waitForTimeout(1_200);
  const after = await page.evaluate(() => ({
    simTime: document.body.dataset.effectsSimTime,
    bannerOpacity: document.querySelector("#pointBanner").style.opacity,
  }));
  expect(after.simTime).toBe(before.simTime);
  expect(after.bannerOpacity).toBe(before.bannerOpacity);

  await page.locator("#resume").click();
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-suspended",
    /./u,
  );
  await page.waitForTimeout(600);
  const resumed = await page.evaluate(
    () => document.body.dataset.effectsSimTime,
  );
  expect(Number(resumed)).toBeGreaterThan(Number(before.simTime));
});

test("E-V8: 得点パルスはエッジで1回だけ付与される", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute("data-server", "A");

  // 同じ得点値でパルスが再付与されないことを数える（得点は約2.8秒間隔で進む）。
  await page.evaluate(() => {
    window.__pulseAdds = [];
    const target = document.querySelector("#opponentScoreCard");
    let had = target.classList.contains("pulse");
    new MutationObserver(() => {
      const has = target.classList.contains("pulse");
      if (has && !had) {
        window.__pulseAdds.push(document.querySelector("#scA").textContent);
      }
      had = has;
    }).observe(target, { attributes: true, attributeFilter: ["class"] });
  });

  await expect(page.locator("body")).toHaveAttribute("data-phase", "point", {
    timeout: 15_000,
  });
  await expect(page.locator("#opponentScoreCard")).toHaveClass(/pulse/u);
  const firstScore = await page.locator("#scA").textContent();
  // 600ms 以内に外れる。
  await expect(page.locator("#opponentScoreCard")).not.toHaveClass(/pulse/u, {
    timeout: 600,
  });
  // 同じ得点値のままなら、その後さらに待っても再付与されない（240Hz の updateHud で連打しない）。
  await page.waitForTimeout(1_000);
  const adds = await page.evaluate(() => window.__pulseAdds);
  expect(adds.filter((score) => score === firstScore)).toHaveLength(1);
});
