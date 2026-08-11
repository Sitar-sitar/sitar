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
const packageJson = JSON.parse(await read("package.json"));
if (packageJson.name !== "sitar-table-tennis2") {
  fail("package.json のnameは sitar-table-tennis2 にしてください。");
}
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
  "opponentScoreCard",
  "matchMeta",
  "playerScoreCard",
  "railMatchTools",
  "tgSHud",
  "tgVHud",
  "playStatus",
  "players",
  "stats",
  "rRecord",
]) {
  if (!new RegExp(`\\bid="${elementId}"`, "u").test(html)) {
    fail(`index.html に戦績UIの #${elementId} がありません。`);
  }
}

const configSource = await read("src/config.ts");

function stringArray(name) {
  const body = new RegExp(
    `export const ${name}:[^=]+=\\s*\\[([\\s\\S]*?)\\];`,
    "u",
  ).exec(configSource)?.[1];
  if (!body) {
    fail(`src/config.ts の ${name} を検出できません。`);
  }
  return [...body.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function attributeValues(attribute) {
  return [
    ...html.matchAll(
      new RegExp(`\\b${attribute}="([^"]+)"`, "gu"),
    ),
  ].map((match) => match[1]);
}

function sameMembers(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().join("\n") === [...expected].sort().join("\n")
  );
}

const serveTypes = attributeValues("data-serve-type");
const configuredServeTypes = stringArray("SERVE_TYPES");
if (!sameMembers(serveTypes, configuredServeTypes)) {
  fail(
    "index.html の data-serve-type は SERVE_TYPES の9識別子と一致させてください。",
  );
}

const serveLengths = attributeValues("data-serve-length");
const configuredServeLengths = stringArray("SERVE_LENGTHS");
if (!sameMembers(serveLengths, configuredServeLengths)) {
  fail(
    "index.html の data-serve-length は SERVE_LENGTHS の3識別子と一致させてください。",
  );
}

for (const sourcePath of [
  "src/main.ts",
  "src/config.ts",
  "src/types.ts",
  "src/physics.ts",
  "src/rules.ts",
  "src/stats.ts",
  "src/storage.ts",
  "src/storage-schema.ts",
  "src/game.ts",
  "src/input.ts",
  "src/render.ts",
  "src/ui.ts",
  "src/feedback.ts",
  "src/styles.css",
  "src/view/camera.ts",
  "src/view/input-math.ts",
  "src/view/layout.ts",
  "src/view/orientation.ts",
  "src/view/suspension.ts",
  "src/control/stroke.ts",
  "src/control/paddle.ts",
  "src/control/contact.ts",
  "src/control/shot-intent.ts",
  "src/ui/feature.ts",
  "src/ui/features/match-context.ts",
  "src/ui/features/serve-panel.ts",
]) {
  await access(resolve(root, sourcePath));
}

for (const [name, expected] of [
  ["POINTER_OFFSET_TOUCH", "0.06"],
  ["POINTER_PREDICTION_MAX_SEC", "0.016"],
  ["RELEASE_GRACE_SEC", "0.16"],
  ["STRIKE_WINDOW_SEC", "0.08"],
  ["STRIKE_MIN_SPEED", "1.1"],
  ["STRIKE_MIN_DISPLACEMENT", "0.04"],
  ["STRIKE_MIN_VERTICALITY", "0.55"],
  ["CONTACT_ASSIST_TOUCH", "1.3"],
  ["CONTACT_ASSIST_FINE", "1.15"],
]) {
  if (!new RegExp(`export const ${name} = ${expected.replace(".", "\\.")};`, "u").test(configSource)) {
    fail(`src/config.ts の ${name} をv0.2.1設計値 ${expected} に合わせてください。`);
  }
}
if (configSource.includes("CONTACT_VISUAL_ASSIST")) {
  fail("一律CONTACT_VISUAL_ASSISTをpointer別assistへ置き換えてください。");
}

const renderSource = await read("src/render.ts");
const drawPlayerPaddle = /private drawPlayerPaddle\(\): void \{[\s\S]*?\n {2}\}/u
  .exec(renderSource)?.[0];
if (!drawPlayerPaddle) {
  fail("src/render.ts の drawPlayerPaddle() を検出できません。");
}
if (!drawPlayerPaddle.includes("this.project(player.x, 0, player.z)")) {
  fail(
    "drawPlayerPaddle() は横位置を判定平面 player.z で投影してください。",
  );
}
if (/project\([^)]*viewZ/u.test(drawPlayerPaddle)) {
  fail(
    "drawPlayerPaddle() は横位置の投影に viewZ を使わないでください。",
  );
}

const gameSource = await read("src/game.ts");
if (!gameSource.includes("this.directPaddle.advanceFrame(")) {
  fail("Game loopはfixed step前にdirect paddleのadvanceFrame()を呼んでください。");
}
if (
  gameSource.indexOf("this.directPaddle.advanceFrame(")
  > gameSource.indexOf("for (let step = 0; step < plan.steps; step += 1)")
) {
  fail("Game loopはadvanceFrame()の後にfixed stepを実行してください。");
}
if (!gameSource.includes("this.currentInputTime")) {
  fail("direct contact期限はwall clockのcurrentInputTimeを使ってください。");
}
const startServe = /private startServe\(\): void \{[\s\S]*?\n {2}\}/u.exec(
  gameSource,
)?.[0];
if (!startServe) {
  fail("src/game.ts の startServe() を検出できません。");
}
if (!/this\.player\.viewZ = PZ;/u.test(startServe)) {
  fail("startServe() は点間で player.viewZ を PZ へ戻してください。");
}
const makeShot = /private makeShot\([\s\S]*?\n {2}\}/u.exec(
  gameSource,
)?.[0];
if (!makeShot) {
  fail("src/game.ts の makeShot() を検出できません。");
}
const judgeBounce = /private judgeBounce\(\): void \{[\s\S]*?\n {2}\}/u.exec(
  gameSource,
)?.[0];
if (!judgeBounce) {
  fail("src/game.ts の judgeBounce() を検出できません。");
}
if (!judgeBounce.includes("this.ball.lastBounceZ = this.ball.z;")) {
  fail("judgeBounce() はバウンド位置を lastBounceZ へ記録してください。");
}
if (
  !startServe.includes("this.ball.lastBounceZ = null;") ||
  !makeShot.includes("this.ball.lastBounceZ = null;")
) {
  fail("startServe() と makeShot() は lastBounceZ を null へ戻してください。");
}
const tick = /private tick\(dt: number\): void \{[\s\S]*?\n {2}\}/u.exec(
  gameSource,
)?.[0];
if (!tick) {
  fail("src/game.ts の tick() を検出できません。");
}
if (!tick.includes("stepViewZ(")) {
  fail("tick() は stepViewZ() で player.viewZ を追従させてください。");
}
if ((await read("src/ai.ts")).includes("stepViewZ")) {
  fail("src/ai.ts は viewZ を追従させない設計です。");
}

const contactPlaneMethod =
  /private contactPlane\(receiver: Side\): number \{[\s\S]*?\n {2}\}/u.exec(
    gameSource,
  )?.[0];
if (!contactPlaneMethod) {
  fail("src/game.ts の contactPlane() を検出できません。");
}
if (!contactPlaneMethod.includes("solveContactPlane(")) {
  fail(
    "contactPlane() は打点平面の計算を solveContactPlane() へ委譲してください。",
  );
}
if (contactPlaneMethod.includes("integrate(")) {
  fail(
    "contactPlane() が integrate() を直接呼んでいます。打点計算は solveContactPlane() へ集約してください。",
  );
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
if (manifest.orientation !== "landscape") {
  fail("manifest.webmanifest のorientationは landscape にしてください。");
}
if (manifest.start_url !== "./" || manifest.scope !== "./") {
  fail("manifest.webmanifest のstart_urlとscopeは新URL配下の ./ にしてください。");
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
const cacheName = /const CACHE_NAME = "([^"]+)";/u.exec(
  serviceWorker,
)?.[1];
if (cacheName !== `table-tennis2-v${packageJson.version}`) {
  fail(
    `Service WorkerのCACHE_NAMEをpackage.jsonの版数に合わせてください（期待: table-tennis2-v${packageJson.version}）。`,
  );
}
if (!serviceWorker.includes("const cached = await cache.match(event.request)")) {
  fail("Service Workerは現行CACHE_NAMEのcache.matchを使用してください。");
}
if (/caches\.match\(/u.test(serviceWorker)) {
  fail("Service Workerは他世代を含むcaches.matchを使用しないでください。");
}
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

const playwrightConfig = await read("playwright.config.js");
if (!playwrightConfig.includes("http://127.0.0.1:3039")) {
  fail("PlaywrightのローカルURLは専用ポート3039を使用してください。");
}
if (!/workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*undefined/u.test(playwrightConfig)) {
  fail("PlaywrightはCI時だけworkers=1へ固定してください。");
}

const storageSource = await read("src/storage.ts");
if (!storageSource.includes('const DATABASE_NAME = "table-tennis2";')) {
  fail("IndexedDB名は table-tennis2 にしてください。");
}

console.log(
  `app check: OK (${manifest.icons.length} manifest icons, TypeScript modules)`,
);
