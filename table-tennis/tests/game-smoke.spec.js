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

test("PWAのService Workerが登録される", async ({ page }) => {
  await page.goto("/");

  const scriptUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });

  expect(scriptUrl).toMatch(/\/sw\.js$/u);
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
