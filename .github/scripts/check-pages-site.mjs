import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const siteRoot = resolve(repositoryRoot, "_site");

for (const path of [
  "index.html",
  "assets/app.js",
  "assets/app.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "table-tennis2/index.html",
  "table-tennis2/assets/app.js",
  "table-tennis2/assets/app.css",
  "table-tennis2/manifest.webmanifest",
  "table-tennis2/sw.js",
  "table-tennis2/icons/icon-192.png",
]) {
  await access(resolve(siteRoot, path));
}

const rootHtml = await readFile(resolve(siteRoot, "index.html"), "utf8");
const childHtml = await readFile(
  resolve(siteRoot, "table-tennis2", "index.html"),
  "utf8",
);
const rootWorker = await readFile(resolve(siteRoot, "sw.js"), "utf8");
const childWorker = await readFile(
  resolve(siteRoot, "table-tennis2", "sw.js"),
  "utf8",
);
const rootPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, "table-tennis", "package.json"), "utf8"),
);
const childPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, "table-tennis2", "package.json"), "utf8"),
);
const rootCacheName = `table-tennis-v${rootPackage.version}`;
const childCacheName = `table-tennis2-v${childPackage.version}`;

for (const [appPath, html] of [[".", rootHtml], ["table-tennis2", childHtml]]) {
  const manifest = JSON.parse(
    await readFile(resolve(siteRoot, appPath, "manifest.webmanifest"), "utf8"),
  );
  assert.ok(typeof manifest.name === "string" && manifest.name.length > 0);
  assert.equal(html.match(/<title>([^<]*)<\/title>/u)?.[1], manifest.name, appPath);
}
assert.match(rootWorker, /CHILD_APP_PATH/u);
assert.ok(rootWorker.includes(rootCacheName), `root cache missing: ${rootCacheName}`);
assert.ok(childWorker.includes(childCacheName), `child cache missing: ${childCacheName}`);
assert.ok(!childWorker.includes(rootCacheName), `child cache leaked root identity: ${rootCacheName}`);

console.log("Pages site check: OK (root and /table-tennis2/)");
