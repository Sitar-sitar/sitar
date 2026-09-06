import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "parts/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ["*.config.js", "scripts/**/*.mjs", "tests/**/*.{js,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // page.evaluate() / addInitScript() でブラウザ内へ注入する関数を含むファイル。
    files: [
      "tests/**/*.js",
      "scripts/measure-render-perf.mjs",
      "scripts/capture-design-qa.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
