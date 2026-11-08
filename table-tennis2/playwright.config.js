import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3039",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 3039",
    url: "http://127.0.0.1:3039",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "mobile-portrait-chromium",
      grep: /縦専用/u,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-portrait-webkit",
      grep: /縦専用/u,
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop-chromium",
      grepInvert: /縦専用/u,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile-webkit",
      grepInvert: /縦専用/u,
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "mobile-chromium",
      grepInvert: /縦専用/u,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 915, height: 412 },
      },
    },
  ],
});
