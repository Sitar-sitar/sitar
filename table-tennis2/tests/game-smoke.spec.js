import { expect, test } from "@playwright/test";

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
  expect(boxes["#serveControls"].bottom).toBeLessThanOrEqual(320);
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

  const result = await page.evaluate(async () => {
    const currentName = (await caches.keys()).find(
      (key) => key === "table-tennis2-v0.1.1",
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
  });

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
});

test("短い球に合成フリックで台上技術が出る", async ({ page }) => {
  await page.addInitScript(() => {
    const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let index = 0;
    Math.random = () => values[index++] ?? 0.5;
  });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-length",
    "short",
    { timeout: 3000 },
  );

  await page.evaluate(async () => {
    const canvas = document.querySelector("#cv");
    const flash = document.querySelector("#flash");
    if (
      !(canvas instanceof HTMLCanvasElement) ||
      !(flash instanceof HTMLDivElement)
    ) {
      throw new Error("E14に必要なDOMが見つかりません。");
    }
    const wait = (ms) =>
      new Promise((resolve) => window.setTimeout(resolve, ms));
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

    for (
      let gesture = 0;
      gesture < 24 && !/ストップ|フリック/u.test(flash.textContent ?? "");
      gesture += 1
    ) {
      const rect = canvas.getBoundingClientRect();
      const pointerId = gesture + 1;
      const x = rect.left + rect.width / 2;
      const startY = rect.top + rect.height * 0.1;
      dispatch("pointerdown", {
        pointerId,
        clientX: x,
        clientY: startY,
        buttons: 1,
      });
      for (let move = 1; move <= 4; move += 1) {
        await wait(move === 1 ? 10 : 80);
        dispatch("pointermove", {
          pointerId,
          clientX: x,
          clientY: startY + rect.height * move * 0.18,
          buttons: 1,
        });
      }
      dispatch("pointerup", {
        pointerId,
        clientX: x,
        clientY: startY + rect.height * 4 * 0.18,
        buttons: 0,
      });
      await wait(10);
    }
  });

  await expect(page.locator("#flash")).toHaveText(/ストップ|フリック/u);
});

test("pagehideからpageshowへ復帰してもAIサーブは一度だけ始まる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
    window.__aiServeExecutions = 0;
    const originalSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) =>
      originalSetTimeout(
        (...callbackArgs) => {
          if (delay === 700) {
            window.__aiServeExecutions += 1;
          }
          if (typeof callback === "function") {
            callback(...callbackArgs);
          }
        },
        delay,
        ...args,
      );
  });
  await page.goto("/");
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
  await page.waitForTimeout(900);
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");
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
  const box = await controls.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(568);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(320);

  const typeButtons = page.locator("[data-serve-type]");
  await expect(typeButtons).toHaveCount(9);
  const lengthButtons = page.locator("[data-serve-length]");
  await expect(lengthButtons).toHaveCount(3);
  for (const button of await typeButtons.all()) {
    await expect(button).toBeVisible();
    const buttonBox = await button.boundingBox();
    expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  }
  for (const button of await lengthButtons.all()) {
    await expect(button).toBeVisible();
    const buttonBox = await button.boundingBox();
    expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  }
});
