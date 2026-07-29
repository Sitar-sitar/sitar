import { expect, test } from "@playwright/test";

test("タイトルから試合を開始できる", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("卓球");
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
        key.startsWith("table-tennis-"),
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

  await expect(page).toHaveTitle("卓球");
  await expect(page.locator("#playerName")).toHaveText("ゲスト");
  await expect(page.locator("#openStats")).toBeEnabled();
});

test("5種類のサーブを選択して実行できる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  const serveTypes = [
    "topspin",
    "backspin",
    "side-left",
    "side-right",
    "knuckle",
  ];
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
  await expect(page.locator("#flash")).toHaveText("ナックルサーブ");
  await expect(controls).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");
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

test("320px幅でサーブ操作が画面内に収まる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  const box = await controls.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(568);

  const buttons = page.locator("[data-serve-type]");
  await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) {
    await expect(button).toBeVisible();
  }
});
