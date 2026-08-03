import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("PWAの必須ファイルが存在する", async () => {
  await Promise.all(
    [
      "index.html",
      "manifest.webmanifest",
      "sw.js",
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-maskable-512.png",
      "icons/apple-touch-icon.png",
      "src/main.ts",
      "src/game.ts",
      "src/physics.ts",
      "src/styles.css",
    ].map((path) => access(resolve(root, path))),
  );
});

test("マニフェストはstandaloneアプリとして構成されている", async () => {
  const manifest = JSON.parse(
    await readFile(resolve(root, "manifest.webmanifest"), "utf8"),
  );

  assert.equal(manifest.lang, "ja");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("Service Workerはアプリシェルをキャッシュする", async () => {
  const serviceWorker = await readFile(resolve(root, "sw.js"), "utf8");

  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)/u);
  assert.match(serviceWorker, /cache\.addAll\(APP_SHELL\)/u);
  assert.match(serviceWorker, /cache\.match\(event\.request\)/u);
  assert.match(serviceWorker, /cache\.match\("\.\/index\.html"\)/u);
  assert.doesNotMatch(serviceWorker, /caches\.match\(/u);
  assert.match(serviceWorker, /"\.\/assets\/app\.js"/u);
  assert.match(serviceWorker, /"\.\/assets\/app\.css"/u);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/u);
});

test("root Service Workerはtable-tennis2配下を処理しない", async () => {
  const serviceWorker = await readFile(resolve(root, "sw.js"), "utf8");
  const childPathIndex = serviceWorker.indexOf("CHILD_APP_PATH");
  const bypassIndex = serviceWorker.indexOf(
    "requestUrl.pathname.startsWith(CHILD_APP_PATH)",
  );
  const respondIndex = serviceWorker.indexOf("event.respondWith(");

  assert.ok(childPathIndex >= 0);
  assert.match(serviceWorker, /self\.registration\.scope/u);
  assert.ok(bypassIndex > childPathIndex);
  assert.ok(respondIndex > bypassIndex);
  assert.doesNotMatch(serviceWorker, /caches\.delete\([^)]*table-tennis2/u);
});
