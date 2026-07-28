import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(message);
}

const html = await read("index.html");
if (
  !/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="\.\/src\/main\.ts")[^>]*>/u.test(
    html,
  )
) {
  fail("index.html がTypeScriptモジュールを参照していません。");
}
if (!/<body\b[^>]*\bdata-service-worker="\.\/sw\.js"[^>]*>/u.test(html)) {
  fail("index.html がService Worker登録先を宣言していません。");
}
if (/<script(?![^>]*\bsrc=)[^>]*>/u.test(html)) {
  fail("index.html にインラインスクリプトを残さないでください。");
}

for (const elementId of [
  "playerBar",
  "playerName",
  "playerRecord",
  "hudPlayerName",
  "players",
  "stats",
  "rRecord",
]) {
  if (!new RegExp(`\\bid="${elementId}"`, "u").test(html)) {
    fail(`index.html に戦績UIの #${elementId} がありません。`);
  }
}

for (const sourcePath of [
  "src/main.ts",
  "src/config.ts",
  "src/types.ts",
  "src/physics.ts",
  "src/rules.ts",
  "src/stats.ts",
  "src/storage.ts",
  "src/game.ts",
  "src/input.ts",
  "src/render.ts",
  "src/ui.ts",
  "src/feedback.ts",
  "src/styles.css",
]) {
  await access(resolve(root, sourcePath));
}

const manifest = JSON.parse(await read("manifest.webmanifest"));
for (const field of ["name", "short_name", "start_url", "display", "icons"]) {
  if (manifest[field] === undefined) {
    fail(`manifest.webmanifest に ${field} がありません。`);
  }
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  fail("manifest.webmanifest にアイコンがありません。");
}
for (const icon of manifest.icons) {
  const relativePath = icon.src.replace(/^\.\//u, "");
  await access(resolve(root, relativePath));
}

for (const reference of [
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
]) {
  if (!html.includes(reference)) {
    fail(`index.html が ${reference} を参照していません。`);
  }
}
if ((html.match(/\bvite-ignore\b/gu) ?? []).length < 3) {
  fail("PWA固定アセットにvite-ignoreが不足しています。");
}

const serviceWorker = await read("sw.js");
new vm.Script(serviceWorker, { filename: "sw.js" });
for (const appShellPath of [
  "./",
  "./index.html",
  "./assets/app.js",
  "./assets/app.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
]) {
  if (!serviceWorker.includes(`"${appShellPath}"`)) {
    fail(`Service Worker のAPP_SHELLに ${appShellPath} がありません。`);
  }
}

console.log(
  `app check: OK (${manifest.icons.length} manifest icons, TypeScript modules)`,
);
