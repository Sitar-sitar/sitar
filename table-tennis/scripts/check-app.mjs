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
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)];

if (scripts.length === 0) {
  fail("index.html にインラインスクリプトがありません。");
}

for (const [index, match] of scripts.entries()) {
  new vm.Script(match[1], { filename: `index.html#script-${index + 1}` });
}

const manifest = JSON.parse(await read("manifest.webmanifest"));
const requiredManifestFields = ["name", "short_name", "start_url", "display", "icons"];

for (const field of requiredManifestFields) {
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

const requiredHtmlReferences = [
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./sw.js",
];

for (const reference of requiredHtmlReferences) {
  if (!html.includes(reference)) {
    fail(`index.html が ${reference} を参照していません。`);
  }
}

const serviceWorker = await read("sw.js");
new vm.Script(serviceWorker, { filename: "sw.js" });

for (const appShellPath of [
  "./",
  "./index.html",
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
  `app check: OK (${scripts.length} scripts, ${manifest.icons.length} manifest icons)`,
);
