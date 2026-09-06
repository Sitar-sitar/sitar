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
  "pointBanner",
  "situation",
  "rMaxRally",
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
  "src/render-guide.ts",
  "src/render/theme.ts",
  "src/render/layers.ts",
  "src/render/environment.ts",
  "src/render/table.ts",
  "src/render/actors.ts",
  "src/render/effects-draw.ts",
  "src/view/effects.ts",
  "src/view/hud-text.ts",
  "src/ui/feature.ts",
  "src/ui/features/match-context.ts",
  "src/ui/features/serve-panel.ts",
]) {
  await access(resolve(root, sourcePath));
}

for (const [name, expected] of [
  ["POINTER_OFFSET_TOUCH", "0.06"],
  ["POINTER_PREDICTION_MAX_SEC", "0.016"],
  ["STRIKE_ACTIVE_MAX_AGE_SEC", "0.16"],
  ["CONTACT_RELEASE_GRACE_TOUCH_SEC", "0.35"],
  ["CONTACT_RELEASE_GRACE_FINE_SEC", "0.22"],
  ["STRIKE_WINDOW_SEC", "0.08"],
  ["STRIKE_MIN_SPEED", "1.1"],
  ["STRIKE_MIN_DISPLACEMENT", "0.04"],
  ["STRIKE_MIN_VERTICALITY", "0.55"],
  ["CONTACT_ASSIST_TOUCH", "1.4"],
  ["CONTACT_ASSIST_FINE", "1.2"],
  ["ASSIST_CONTACT_QUALITY_FLOOR", "0.4"],
  ["PADDLE_SCREEN_Y_MIN", "0.35"],
  ["SHOT_MIN_SPEED_ELEV", "0.55"],
  ["PLAYER_SHOT_SPEED_MARGIN", "1.16"],
  ["AI_SHOT_SPEED_MARGIN", "1.05"],
]) {
  if (!new RegExp(`export const ${name} = ${expected.replace(".", "\\.")};`, "u").test(configSource)) {
    fail(`src/config.ts の ${name} をv0.2.3設計値 ${expected} に合わせてください。`);
  }
}
// v0.3.0 §5.12: グラフィック強化と演出の定数を固定する。
for (const [name, expected] of [
  ["VISUAL_EVENT_BUFFER", "16"],
  ["EFFECT_MAX_PARTICLES", "48"],
  ["CONTACT_SPARK_TTL_SEC", "0.28"],
  ["EFFECT_GRAVITY", "600"],
  ["BOUNCE_RING_TTL_SEC", "0.32"],
  ["NET_WOBBLE_SEC", "0.36"],
  ["NET_WOBBLE_AMP", "1.5"],
  ["NET_WOBBLE_HZ", "14"],
  ["NET_WOBBLE_DECAY_SEC", "0.12"],
  ["SMASH_STREAK_SEC", "0.18"],
  ["DEAD_BALL_HOLD_SEC", "0.5"],
  ["DEAD_BALL_FADE_SEC", "0.75"],
  ["SHOT_TOAST_SEC", "0.9"],
  ["SHOT_TOAST_SMASH_SEC", "1.1"],
  ["POINT_BANNER_SEC", "1.1"],
  ["POINT_BANNER_FINAL_SEC", "0.95"],
  ["SCORE_PULSE_MS", "420"],
  ["RALLY_PULSE_EVERY", "5"],
  ["SPIN_TINT_THRESHOLD", "0.25"],
  ["SERVE_ZONE_PAD", "6"],
  ["OPPONENT_LEAN_GAIN", "0.08"],
  ["OPPONENT_LEAN_MAX", "6"],
  ["EFFECT_DT_MAX_SEC", "0.25"],
]) {
  if (
    !new RegExp(
      `export const ${name} = ${expected.replace(".", "\\.")};`,
      "u",
    ).test(configSource)
  ) {
    fail(`src/config.ts の ${name} をv0.3.0設計値 ${expected} に合わせてください。`);
  }
}
// N-5: 既存のタイミング契約は変えない。
for (const [name, expected] of [
  ["POINT_INTERVAL", "1.25"],
  ["RESULT_DELAY_MS", "1000"],
  ["TRAIL_LENGTH", "9"],
  ["AI_SERVE_DELAY_MS", "700"],
]) {
  if (
    !new RegExp(
      `export const ${name} = ${expected.replace(".", "\\.")};`,
      "u",
    ).test(configSource)
  ) {
    fail(`src/config.ts の ${name} は N-5 により ${expected} のままにしてください。`);
  }
}
if (!/export const SERVE_ZONE_Z:/u.test(configSource)) {
  fail("src/config.ts に測定済みの SERVE_ZONE_Z がありません（§5.9.2）。");
}
const serveZoneBlock = /export const SERVE_ZONE_Z:[\s\S]*?\n\};/u.exec(
  configSource,
)?.[0];
for (const length of ["short", "middle", "long"]) {
  if (
    !serveZoneBlock ||
    !new RegExp(`${length}: \\[-?\\d+(\\.\\d+)?, -?\\d+(\\.\\d+)?\\]`, "u").test(
      serveZoneBlock,
    )
  ) {
    fail(`src/config.ts の SERVE_ZONE_Z.${length} に測定値を入れてください。`);
  }
}

// v0.2.4: 難易度別プロファイル15値とAI blunder確率を固定する。
// 正規表現を使わず、"  <level>: {" 〜 "  }," のブロックを文字列で切り出して照合する。
function levelBlock(source, declaration, level) {
  const declStart = source.indexOf(declaration);
  if (declStart < 0) return null;
  const start = source.indexOf("  " + level + ": {", declStart);
  if (start < 0) return null;
  const end = source.indexOf("\n  },", start);
  if (end < 0) return null;
  return source.slice(start, end);
}

const expectedLevelPlay = {
  easy: ["aiPace: 0.2,", "aiPrecision: 1.55,", "assistScale: 1.25,", "contactQualityFloor: 0.55,", "playerErrorScale: 0.6,"],
  mid: ["aiPace: 0.65,", "aiPrecision: 0.9,", "assistScale: 1.1,", "contactQualityFloor: 0.47,", "playerErrorScale: 0.85,"],
  hard: ["aiPace: 1,", "aiPrecision: 0.45,", "assistScale: 1,", "contactQualityFloor: 0.4,", "playerErrorScale: 1,"],
};
for (const [level, fields] of Object.entries(expectedLevelPlay)) {
  const block = levelBlock(configSource, "export const LEVEL_PLAY", level);
  if (!block) {
    fail("src/config.ts の LEVEL_PLAY." + level + " が見つかりません。");
    continue;
  }
  for (const field of fields) {
    if (!block.includes(field)) {
      fail("src/config.ts の LEVEL_PLAY." + level + " をv0.2.4設計値 " + field + " に合わせてください。");
    }
  }
}

for (const [level, miss] of [["easy", "miss: 0.26,"], ["mid", "miss: 0.09,"], ["hard", "miss: 0.01,"]]) {
  const block = levelBlock(configSource, "export const LEVELS", level);
  if (!block || !block.includes(miss)) {
    fail("src/config.ts の LEVELS." + level + " をv0.2.4設計値 " + miss + " に合わせてください。");
  }
}

if (configSource.includes("RELEASE_GRACE_SEC")) {
  fail("共用RELEASE_GRACE_SECを用途別のv0.2.3定数へ置き換えてください。");
}
if (configSource.includes("CONTACT_VISUAL_ASSIST")) {
  fail("一律CONTACT_VISUAL_ASSISTをpointer別assistへ置き換えてください。");
}

const gameSource = await read("src/game.ts");

// v0.3.0: 作画は src/render/actors.ts へ移設したが、判定共有の式は変えない（N-3）。
const actorsSource = await read("src/render/actors.ts");
const drawPlayerPaddle =
  /export function drawPlayerPaddle\([\s\S]*?\n\}/u.exec(actorsSource)?.[0];
if (!drawPlayerPaddle) {
  fail("src/render/actors.ts の drawPlayerPaddle() を検出できません。");
}
if (!drawPlayerPaddle.includes("projectOn(surface, player.x, 0, player.z)")) {
  fail(
    "drawPlayerPaddle() は横位置を判定平面 player.z で投影してください。",
  );
}
if (/project[A-Za-z]*\([^)]*viewZ/u.test(drawPlayerPaddle)) {
  fail(
    "drawPlayerPaddle() は横位置の投影に viewZ を使わないでください。",
  );
}
for (const shared of [
  "paddleScreenRadius(",
  "clampPaddleScreenY(",
  "paddleShadowY(",
  "PADDLE_BLADE_SCALE * assist.scale",
]) {
  if (!drawPlayerPaddle.includes(shared)) {
    fail(
      `drawPlayerPaddle() の判定共有の式 ${shared} を変えないでください（N-3）。`,
    );
  }
}

// v0.3.0 N-1: view 層のエフェクトは乱数生成器へ触れない。
for (const modulePath of [
  "src/view/effects.ts",
  "src/view/hud-text.ts",
  "src/render.ts",
  "src/render/theme.ts",
  "src/render/layers.ts",
  "src/render/environment.ts",
  "src/render/table.ts",
  "src/render/actors.ts",
  "src/render/effects-draw.ts",
]) {
  const moduleSource = await read(modulePath);
  if (/Math\.random/u.test(moduleSource)) {
    fail(`${modulePath} は Math.random を参照しないでください（N-1）。`);
  }
  if (/this\.random/u.test(moduleSource)) {
    fail(`${modulePath} は Game.random を参照しないでください（N-1）。`);
  }
}
const rendererSource = await read("src/render.ts");
if (!/mulberry32\(EFFECT_SEED\)/u.test(rendererSource)) {
  fail("Renderer はエフェクト用に固定seedの mulberry32 を使ってください（N-1）。");
}

// v0.3.0 N-6: RenderScene は非破壊。イベントは drainVisualEvents() だけが消費する。
const typesSource = await read("src/types.ts");
const renderSceneBlock = /export interface RenderScene \{[\s\S]*?\n\}/u.exec(
  typesSource,
)?.[0];
if (!renderSceneBlock) {
  fail("src/types.ts の RenderScene を検出できません。");
}
for (const forbidden of ["random", "events", "visualEvents"]) {
  if (new RegExp(`\\n\\s+${forbidden}[?:]`, "u").test(renderSceneBlock ?? "")) {
    fail(`RenderScene に ${forbidden} を載せないでください（N-1 / N-6）。`);
  }
}
if (!/export type VisualEvent =/u.test(typesSource)) {
  fail("src/types.ts に VisualEvent がありません（§5.1.3）。");
}
if (!/public drainVisualEvents\(\): VisualEvent\[\]/u.test(gameSource)) {
  fail("src/game.ts に drainVisualEvents() がありません（N-6）。");
}
const getRenderScene = /public getRenderScene\(\): RenderScene \{[\s\S]*?\n {2}\}/u
  .exec(gameSource)?.[0];
if (!getRenderScene) {
  fail("src/game.ts の getRenderScene() を検出できません。");
}
if (/splice\(|\.length = 0/u.test(getRenderScene ?? "")) {
  fail("getRenderScene() は非破壊にしてください（N-6）。");
}

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
