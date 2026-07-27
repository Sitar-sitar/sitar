import { cp, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const appRoot = import.meta.dirname;
const outputRoot = resolve(appRoot, "dist");

function copyPwaAssets() {
  return {
    name: "copy-pwa-assets",
    apply: "build",
    async closeBundle() {
      await mkdir(outputRoot, { recursive: true });
      await Promise.all([
        copyFile(
          resolve(appRoot, "manifest.webmanifest"),
          resolve(outputRoot, "manifest.webmanifest"),
        ),
        copyFile(resolve(appRoot, "sw.js"), resolve(outputRoot, "sw.js")),
        copyFile(resolve(appRoot, ".nojekyll"), resolve(outputRoot, ".nojekyll")),
        cp(resolve(appRoot, "icons"), resolve(outputRoot, "icons"), {
          recursive: true,
        }),
      ]);
    },
  };
}

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 3038,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 3038,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) =>
          assetInfo.names.some((name) => name.endsWith(".css"))
            ? "assets/app.css"
            : "assets/[name][extname]",
      },
    },
  },
  plugins: [copyPwaAssets()],
});
