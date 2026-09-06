// v0.3.0 §6.1: design-qa の証跡スクリーンショットを決定論的に撮影する。
// 製品コードは変更しない。撮影は Chromium（production build の vite preview）で行い、
// 実 Chrome での手動受入（G2）は別途行う。
//
//   node scripts/capture-design-qa.mjs --url http://127.0.0.1:4175
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const baseUrl =
  args[args.indexOf("--url") + 1] ?? "http://127.0.0.1:4173";
const outDir = resolve(import.meta.dirname, "..", "design-qa");
await mkdir(outDir, { recursive: true });

const WIDE = { width: 844, height: 390 };
const COMPACT = { width: 568, height: 320 };

const browser = await chromium.launch();

async function openPage(viewport, seed) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(seed);
  const page = await context.newPage();
  const consoleIssues = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));
  return { context, page, consoleIssues };
}

const AI_SERVE_SEED = () => {
  Math.random = () => 0.6;
};
const PLAYER_SERVE_SEED = () => {
  Math.random = () => 0;
};

async function shot(page, name) {
  await page.screenshot({
    path: resolve(outDir, `${name}.jpg`),
    type: "jpeg",
    quality: 88,
  });
  console.log(`saved design-qa/${name}.jpg`);
}

const allIssues = [];

// 1) ラリー中（プレイヤー迎球直前）
for (const [viewport, label] of [
  [WIDE, "wide-844x390"],
  [COMPACT, "compact-568x320"],
]) {
  const { context, page, consoleIssues } = await openPage(viewport, AI_SERVE_SEED);
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.body.dataset.phase === "rally",
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(420);
  await shot(page, `v030-rally-${label}`);
  allIssues.push(...consoleIssues);
  await context.close();
}

// 2) プレイヤーサーブ選択中（着地帯表示）
for (const [viewport, label] of [
  [WIDE, "wide-844x390"],
  [COMPACT, "compact-568x320"],
]) {
  const { context, page, consoleIssues } = await openPage(
    viewport,
    PLAYER_SERVE_SEED,
  );
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.body.dataset.serveZone === "middle",
    undefined,
    { timeout: 10_000 },
  );
  await page.locator('[data-serve-length="long"]').click();
  await page.waitForTimeout(200);
  await shot(page, `v030-serve-${label}`);
  allIssues.push(...consoleIssues);
  await context.close();
}

// 3) 得点直後（バナー・死球・パルス）
{
  const { context, page, consoleIssues } = await openPage(WIDE, AI_SERVE_SEED);
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.body.dataset.phase === "point",
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(220);
  await shot(page, "v030-point-wide-844x390");
  allIssues.push(...consoleIssues);
  await context.close();
}

// 4) 最終得点直後（バナー → リザルト）
{
  const { context, page, consoleIssues } = await openPage(WIDE, AI_SERVE_SEED);
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      phase: document.body.dataset.phase,
      server: document.body.dataset.server,
    }));
    if (state.phase === "over") break;
    if (state.phase === "serve" && state.server === "P") {
      await page.locator("#cv").click({ position: { x: 400, y: 260 } });
    }
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(180);
  await shot(page, "v030-final-point-wide-844x390");
  allIssues.push(...consoleIssues);
  await context.close();
}

await browser.close();

if (allIssues.length > 0) {
  console.error("console warning / error を検出しました:");
  for (const issue of allIssues) console.error(`  ${issue}`);
  process.exit(1);
}
console.log("console warning / error: 0件");
