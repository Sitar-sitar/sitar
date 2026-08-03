import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

for (const relativePath of [
  "index.html",
  ".nojekyll",
  "manifest.webmanifest",
  "sw.js",
  "assets/app.js",
  "assets/app.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
]) {
  await access(resolve(dist, relativePath));
}

const html = await readFile(resolve(dist, "index.html"), "utf8");
for (const reference of [
  "./assets/app.js",
  "./assets/app.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
]) {
  if (!html.includes(reference)) {
    throw new Error(`dist/index.html が ${reference} を参照していません。`);
  }
}
if (/(?:src|href)="\/(?!\/)/u.test(html)) {
  throw new Error("dist/index.html にルート絶対アセットURLがあります。");
}

const serviceWorker = await readFile(resolve(dist, "sw.js"), "utf8");
for (const reference of ["./assets/app.js", "./assets/app.css"]) {
  if (!serviceWorker.includes(`"${reference}"`)) {
    throw new Error(`dist/sw.js が ${reference} を事前キャッシュしません。`);
  }
}

console.log("dist check: OK (fixed app shell and relative URLs)");
