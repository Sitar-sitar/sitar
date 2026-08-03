import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const siteRoot = resolve(repositoryRoot, "_site");

await rm(siteRoot, { recursive: true, force: true });
await mkdir(resolve(siteRoot, "table-tennis2"), { recursive: true });
await cp(resolve(repositoryRoot, "table-tennis", "dist"), siteRoot, {
  recursive: true,
});
await cp(
  resolve(repositoryRoot, "table-tennis2", "dist"),
  resolve(siteRoot, "table-tennis2"),
  { recursive: true },
);

console.log("Pages site composed: root + /table-tennis2/");
