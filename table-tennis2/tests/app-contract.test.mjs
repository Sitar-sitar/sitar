import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) {
    throw new Error(`semver形式ではありません: ${version}`);
  }
  return match.slice(1).map(Number);
}

function isAtLeast(version, minimum) {
  const actual = parseSemver(version);
  const required = parseSemver(minimum);
  return actual.every((value, index) =>
    actual.slice(0, index).every((prior, priorIndex) => prior === required[priorIndex])
      ? value >= required[index]
      : true,
  );
}

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

test("lockfileは既知脆弱性の修正版下限を満たす", async () => {
  const lockfile = JSON.parse(
    await readFile(resolve(root, "package-lock.json"), "utf8"),
  );
  const requirements = [
    ["node_modules/brace-expansion", 5, "5.0.9"],
    ["node_modules/nanoid", 3, "3.3.18"],
  ];

  for (const [path, expectedMajor, minimum] of requirements) {
    const entry = lockfile.packages[path];
    assert.ok(entry, `${path} がlockfileに存在する`);
    assert.equal(parseSemver(entry.version)[0], expectedMajor);
    assert.ok(
      isAtLeast(entry.version, minimum),
      `${path} は ${minimum} 以上である`,
    );
  }
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
