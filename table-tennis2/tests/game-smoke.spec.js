import { expect, test } from "@playwright/test";

async function expectServeControlsWithinRightRail(page) {
  const layout = await page.evaluate(() => {
    const controls = document.querySelector("#serveControls");
    const rightRail = document.querySelector("#rightRail");
    if (!(controls instanceof HTMLElement) || !(rightRail instanceof HTMLElement)) {
      throw new Error("サーブ操作または右レールが見つかりません。");
    }
    const panel = controls.getBoundingClientRect();
    const rail = rightRail.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      panel: {
        x: panel.x,
        y: panel.y,
        right: panel.right,
        bottom: panel.bottom,
      },
      rail: {
        x: rail.x,
        y: rail.y,
        right: rail.right,
        bottom: rail.bottom,
      },
    };
  });
  const safeBottom = Math.min(layout.viewport.height, layout.rail.bottom) - 2;

  expect(layout.panel.x).toBeGreaterThanOrEqual(layout.rail.x);
  expect(layout.panel.right).toBeLessThanOrEqual(layout.rail.right);
  expect(layout.panel.y).toBeGreaterThanOrEqual(Math.max(0, layout.rail.y));
  expect(layout.panel.bottom).toBeLessThanOrEqual(safeBottom);

  const buttons = page.locator(
    "#gear, [data-serve-type], [data-serve-length]",
  );
  await expect(buttons).toHaveCount(13);
  for (const button of await buttons.all()) {
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(layout.rail.x);
    expect(box.x + box.width).toBeLessThanOrEqual(layout.rail.right);
    expect(box.y).toBeGreaterThanOrEqual(Math.max(0, layout.rail.y));
    expect(box.y + box.height).toBeLessThanOrEqual(safeBottom);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

test("タイトルから試合を開始できる", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("卓球 横画面");
  await expect(page.locator("#title")).toHaveClass(/show/u);
  await expect(page.locator("#cv")).toBeVisible();

  await page.locator("#start").click();

  await expect(page.locator("#title")).not.toHaveClass(/show/u);
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("#scP")).toHaveText("0");
  await expect(page.locator("#scA")).toHaveText("0");
});

test("v0.2.2はdirect paddleを既定としlegacyへ一時退避できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute(
    "data-control-model",
    "direct-paddle-v1",
  );
  await page.goto("/?controlModel=legacy");
  await expect(page.locator("body")).toHaveAttribute(
    "data-control-model",
    "legacy",
  );
});

test("33ms pointer間隔で16ms予測・6% offset・passive追従を観測できる", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debugInput=1");

  const observed = await page.evaluate(async () => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");
    const rect = canvas.getBoundingClientRect();
    const dispatch = (type, init, ageMs = 0) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        pointerType: "touch",
        pointerId: 41,
        buttons: type === "pointerup" ? 0 : 1,
        ...init,
      });
      Object.defineProperty(event, "timeStamp", {
        value: performance.now() - ageMs,
      });
      canvas.dispatchEvent(event);
    };
    dispatch("pointerdown", {
      clientX: rect.left + rect.width * 0.35,
      clientY: rect.top + rect.height * 0.8,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => {
        const targetX = rect.left + rect.width * (attempt % 2 === 0 ? 0.55 : 0.45);
        dispatch("pointermove", {
          clientX: targetX - rect.width * 0.08,
          clientY: rect.top + rect.height * 0.8,
        }, 33);
        dispatch("pointermove", {
          clientX: targetX,
          clientY: rect.top + rect.height * 0.8,
        });
        resolve();
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (Number(document.body.dataset.predictionMs) > 0) break;
    }
    const tracking = {
      height: rect.height,
      paddleY: Number(document.body.dataset.paddleScreenY),
      predictionMs: Number(document.body.dataset.predictionMs),
      predictionDistance: Number(document.body.dataset.predictionDistancePx),
      strikeActive: document.body.dataset.strikeActive,
      assistScale: document.body.dataset.contactAssistScale,
    };
    dispatch("pointerup", {
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.8,
    });
    await new Promise((resolve) => setTimeout(resolve, 180));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterRelease = {
      phase: document.body.dataset.paddlePhase,
      predictionMs: Number(document.body.dataset.predictionMs),
    };
    let verticalStrikeActive = "false";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => {
        dispatch("pointercancel", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.8,
          buttons: 0,
        });
        dispatch("pointerdown", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.8,
        }, 33);
        dispatch("pointermove", {
          pointerId: 42,
          clientX: rect.left + rect.width * 0.55,
          clientY: rect.top + rect.height * 0.64,
        });
        resolve();
      }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      verticalStrikeActive = document.body.dataset.strikeActive ?? "false";
      if (verticalStrikeActive === "true") break;
    }
    dispatch("pointercancel", {
      pointerId: 42,
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.64,
      buttons: 0,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterCancel = {
      phase: document.body.dataset.paddlePhase,
      predictionMs: Number(document.body.dataset.predictionMs),
      assistScale: document.body.dataset.contactAssistScale,
    };
    return { ...tracking, afterRelease, verticalStrikeActive, afterCancel };
  });

  expect(observed.predictionMs).toBeGreaterThan(0);
  expect(observed.predictionMs).toBeLessThanOrEqual(16);
  expect(observed.predictionDistance).toBeGreaterThan(0);
  expect(observed.predictionDistance).toBeLessThanOrEqual(observed.height * 0.05 + 0.1);
  expect(Math.abs(observed.paddleY - observed.height * 0.74)).toBeLessThanOrEqual(0.5);
  expect(observed.strikeActive).toBe("false");
  expect(observed.assistScale).toBe("1.30");
  expect(["recover", "idle"]).toContain(observed.afterRelease.phase);
  expect(observed.afterRelease.predictionMs).toBe(0);
  // Linux WebKitはworker 1でもrAFが80msを越えることがあるため、瞬間値の
  // active断面はChromiumで固定する。WebKitは本suiteの実衝突とresetを検証する。
  if (browserName !== "webkit") {
    expect(observed.verticalStrikeActive).toBe("true");
  }
  expect(["recover", "idle"]).toContain(observed.afterCancel.phase);
  expect(observed.afterCancel.predictionMs).toBe(0);
  expect(observed.afterCancel.assistScale).toBeUndefined();
});

test("難易度を変更して一時停止できる", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-lv="hard"]').click();
  await expect(page.locator('[data-lv="hard"]')).toHaveClass(/sel/u);

  await page.locator("#start").click();
  await expect(page.locator("#lvName")).toHaveText("上級");

  await page.locator("#gear").click();
  await expect(page.locator("#pause")).toHaveClass(/show/u);
  await expect(page.locator("#pScore")).toContainText("上級");

  await page.locator("#resume").click();
  await expect(page.locator("#pause")).not.toHaveClass(/show/u);
});

test("844×390では得点をstage両上隅へ分離する", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();

  const boxes = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`${selector} が見つかりません。`);
      }
      const value = element.getBoundingClientRect();
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        right: value.right,
        bottom: value.bottom,
      };
    };
    return {
      stage: rect("#stage"),
      opponent: rect("#opponentScoreCard"),
      meta: rect("#matchMeta"),
      player: rect("#playerScoreCard"),
      gear: rect("#gear"),
      rightRail: rect("#rightRail"),
    };
  });

  expect(boxes.opponent.height).toBeLessThanOrEqual(48);
  expect(boxes.player.height).toBeLessThanOrEqual(48);
  expect(boxes.meta.height).toBeLessThanOrEqual(28);
  expect(boxes.opponent.x).toBeGreaterThanOrEqual(boxes.stage.x);
  expect(boxes.player.right).toBeLessThanOrEqual(boxes.stage.right);
  expect(boxes.opponent.right).toBeLessThan(boxes.meta.x);
  expect(boxes.meta.right).toBeLessThan(boxes.player.x);
  expect(boxes.opponent.right).toBeLessThan(
    boxes.stage.x + boxes.stage.width / 2,
  );
  expect(boxes.player.x).toBeGreaterThan(
    boxes.stage.x + boxes.stage.width / 2,
  );
  expect(boxes.gear.x).toBeGreaterThanOrEqual(boxes.rightRail.x);
  expect(boxes.gear.right).toBeLessThanOrEqual(boxes.rightRail.right);

  await expect(page.locator("#leftRail")).toBeVisible();
  await expect(page.locator("[data-match-server]")).toHaveText("あなた");
});

test("568×320でも両得点とサーブ操作を画面内に保つ", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("#leftRail")).toBeHidden();
  await expect(page.locator("#opponentScoreCard")).toBeVisible();
  await expect(page.locator("#playerScoreCard")).toBeVisible();
  await expect(page.locator("#matchMeta")).toBeVisible();
  await expect(page.locator("#tgSHud")).toBeHidden();
  await expect(page.locator("#tgVHud")).toBeHidden();

  const boxes = await page.evaluate(() => {
    const selectors = [
      "#stage",
      "#opponentScoreCard",
      "#matchMeta",
      "#playerScoreCard",
      "#rightRail",
      "#gear",
      "#serveControls",
    ];
    return Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`${selector} が見つかりません。`);
        }
        const rect = element.getBoundingClientRect();
        return [selector, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        }];
      }),
    );
  });

  expect(boxes["#opponentScoreCard"].height).toBeLessThanOrEqual(44);
  expect(boxes["#playerScoreCard"].height).toBeLessThanOrEqual(44);
  expect(boxes["#matchMeta"].height).toBeLessThanOrEqual(24);
  for (const selector of [
    "#opponentScoreCard",
    "#matchMeta",
    "#playerScoreCard",
  ]) {
    expect(boxes[selector].x).toBeGreaterThanOrEqual(boxes["#stage"].x);
    expect(boxes[selector].right).toBeLessThanOrEqual(
      boxes["#stage"].right,
    );
  }
  expect(boxes["#gear"].width).toBeGreaterThanOrEqual(44);
  expect(boxes["#gear"].height).toBeGreaterThanOrEqual(44);
  await expectServeControlsWithinRightRail(page);
});

test("759×360ではcompact配置を維持し、760×360でleft railへ切り替える", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });

  for (const [width, leftRailVisible] of [[759, false], [760, true]]) {
    await page.setViewportSize({ width, height: 360 });
    await page.goto("/");
    await page.locator("#start").click();
    if (leftRailVisible) {
      await expect(page.locator("#leftRail")).toBeVisible();
    } else {
      await expect(page.locator("#leftRail")).toBeHidden();
    }
    await expectServeControlsWithinRightRail(page);
  }
});

test("HUDから音と振動を切り替え一時停止表示と同期する", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.locator("#start").click();
  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");

  await expect(page.locator("#tgSHud")).toBeVisible();
  await expect(page.locator("#tgVHud")).toBeVisible();
  await page.locator("#tgSHud").click();
  await page.locator("#tgVHud").click();
  await expect(page.locator("#tgSHud")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#tgVHud")).toHaveAttribute("aria-pressed", "false");

  await page.locator("#gear").click();
  await expect(page.locator("#tgS2")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#tgV2")).toHaveAttribute("aria-pressed", "false");
});

test("PWA登録とオフライン用キャッシュを確認できる", async ({
  browserName,
  context,
  page,
}) => {
  const consoleFailures = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleFailures.push(message.text());
    }
  });
  await page.goto("/");

  const scriptUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });

  expect(scriptUrl).toMatch(/\/sw\.js$/u);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 10_000 },
  );
  await page.reload();
  await expect(page.locator("#openStats")).toBeEnabled();

  if (browserName === "webkit") {
    const cachedPaths = await page.evaluate(async () => {
      const cacheName = (await caches.keys()).find((key) =>
        key.startsWith("table-tennis2-"),
      );
      if (!cacheName) {
        return [];
      }
      return (await (await caches.open(cacheName)).keys()).map(
        (request) => new URL(request.url).pathname,
      );
    });
    expect(cachedPaths).toEqual(
      expect.arrayContaining([
        "/",
        "/index.html",
        "/assets/app.js",
        "/assets/app.css",
      ]),
    );
    return;
  }

  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveTitle("卓球 横画面");
  await expect(page.locator("#playerName")).toHaveText("ゲスト");
  await expect(page.locator("#openStats")).toBeEnabled();
  expect(consoleFailures).toEqual([]);
});

test("Service Worker登録失敗を警告しゲームを継続する", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.addInitScript(() => {
    const originalWarn = console.warn.bind(console);
    window.__serviceWorkerWarningArgs = [];
    window.__unhandledRejections = [];
    console.warn = (...args) => {
      window.__serviceWorkerWarningArgs.push(
        args.map((argument) => argument instanceof Error
          ? { name: argument.name, message: argument.message }
          : argument),
      );
      originalWarn(...args);
    };
    window.addEventListener("unhandledrejection", (event) => {
      window.__unhandledRejections.push(
        event.reason instanceof Error ? event.reason.message : String(event.reason),
      );
    });
    Object.defineProperty(ServiceWorkerContainer.prototype, "register", {
      configurable: true,
      writable: true,
      value: () => Promise.reject(new Error("TEST_SW_REGISTER_FAILED")),
    });
  });

  await page.goto("/");
  await expect.poll(() => page.evaluate(
    () => window.__serviceWorkerWarningArgs.length,
  )).toBe(1);
  await expect(page.locator("#title")).toHaveClass(/show/u);
  await page.locator("#start").click();
  await expect(page.locator("#board")).toBeVisible();

  expect(await page.evaluate(() => window.__serviceWorkerWarningArgs)).toEqual([
    ["Service Worker の登録に失敗しました。", {
      name: "Error",
      message: "TEST_SW_REGISTER_FAILED",
    }],
  ]);
  expect(await page.evaluate(() => window.__unhandledRejections)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("9種類のサーブを3×3で選択して実行できる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  const serveTypes = [
    "topspin-left",
    "topspin",
    "topspin-right",
    "side-left",
    "knuckle",
    "side-right",
    "backspin-left",
    "backspin",
    "backspin-right",
  ];
  await expect(page.locator("[data-serve-type]")).toHaveCount(9);
  expect(
    await page
      .locator("[data-serve-type]")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.serveType),
      ),
  ).toEqual(serveTypes);
  for (const serveType of serveTypes) {
    const button = page.locator(`[data-serve-type="${serveType}"]`);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator('[data-serve-type="knuckle"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-serve-type="knuckle"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("#flash")).toHaveText("ナックルサーブ（中）");
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-type",
    "knuckle",
  );
  await expect(controls).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-phase", "rally");
});

test("Service Workerは他世代キャッシュの同一URLを参照しない", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 10_000 },
  );
  await page.reload();

  const result = await page.evaluate(async () => {
    const currentName = (await caches.keys()).find(
      (key) => key === "table-tennis2-v0.2.2",
    );
    if (!currentName) throw new Error("現行キャッシュがありません。");
    const current = await caches.open(currentName);
    const appUrl = new URL("./assets/app.js", location.href).href;
    await current.delete(appUrl);
    const staleName = "table-tennis2-stale-e22";
    const stale = await caches.open(staleName);
    const poison = "SECRET-POISON-E22";
    await stale.put(
      appUrl,
      new Response(poison, {
        headers: { "content-type": "text/javascript" },
      }),
    );
    try {
      const response = await fetch(appUrl, { cache: "reload" });
      const body = await response.text();
      const refilled = await current.match(appUrl);
      return {
        poisoned: body.includes(poison),
        refilled: Boolean(refilled),
      };
    } finally {
      await caches.delete(staleName);
    }
  });

  expect(result).toEqual({ poisoned: false, refilled: true });
});

test("サーブ長3種を選択できポイントと再試合をまたいで保持する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/");
  await page.locator("#start").click();

  const serveLengths = ["short", "middle", "long"];
  for (const serveLength of serveLengths) {
    const button = page.locator(
      `[data-serve-length="${serveLength}"]`,
    );
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator('[data-serve-length="short"]').click();
  await page.locator("#cv").click({ position: { x: 100, y: 250 } });
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-length",
    "short",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-selected-serve-length",
    "short",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "serve",
    { timeout: 10_000 },
  );
  await expect(page.locator('[data-serve-length="short"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("#gear").click();
  await page.locator("#quit").click();
  await page.locator("#start").click();
  await expect(page.locator('[data-serve-length="short"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("AIサーブから自動でラリーが始まる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("#serveControls")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "rally",
    { timeout: 3000 },
  );
});

test("合成pointer入力でdirect paddleが実衝突して返球する", async ({ page }) => {
  await page.addInitScript(() => {
    const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let index = 0;
    Math.random = () => values[index++] ?? 0.5;
  });
  await page.goto("/?debugInput=1");
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).toHaveAttribute(
    "data-served-serve-length",
    "short",
    { timeout: 3000 },
  );

  await page.evaluate(async () => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("E14に必要なDOMが見つかりません。");
    }
    const dispatch = (type, init) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          isPrimary: true,
          pointerType: "touch",
          ...init,
        }),
      );
    };
    const pointerId = 1;
    const firstRect = canvas.getBoundingClientRect();
    dispatch("pointerdown", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 1,
    });
    for (let frame = 0; frame < 360 && !document.body.dataset.directShot; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = canvas.getBoundingClientRect();
      const ballX = Number(document.body.dataset.ballScreenX);
      const ballY = Number(document.body.dataset.ballScreenY);
      if (!Number.isFinite(ballX) || !Number.isFinite(ballY)) continue;
      dispatch("pointermove", {
        pointerId,
        clientX: rect.left + Math.max(1, Math.min(rect.width - 1, ballX)),
        clientY:
          rect.top +
          Math.max(1, Math.min(rect.height - 1, ballY + rect.height * 0.06)),
        buttons: 1,
      });
    }
    dispatch("pointerup", {
      pointerId,
      clientX: firstRect.left + firstRect.width / 2,
      clientY: firstRect.top + firstRect.height * 0.72,
      buttons: 0,
    });
  });

  await expect(page.locator("body")).toHaveAttribute(
    "data-direct-shot",
    /DRIVE|SMASH|PUSH|CHOP|LOB|STOP|FLICK/u,
  );
});

test("pagehideからpageshowへ復帰してもAIサーブは一度だけ始まる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.6;
  });
  await page.goto("/");
  await page.evaluate(() => {
    window.__aiServeExecutions = 0;
    new MutationObserver((records) => {
      window.__aiServeExecutions += records.filter(
        (record) => record.attributeName === "data-served-serve-type",
      ).length;
    }).observe(document.body, { attributes: true });
  });
  await page.locator("#start").click();

  await expect(page.locator("body")).toHaveAttribute("data-server", "A");
  await expect(page.locator("body")).toHaveAttribute("data-phase", "serve");
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });

  await expect(page.locator("body")).toHaveAttribute(
    "data-phase",
    "rally",
    { timeout: 3000 },
  );
  await expect
    .poll(() => page.evaluate(() => window.__aiServeExecutions))
    .toBe(1);
  await page.waitForTimeout(100);
  await expect
    .poll(() => page.evaluate(() => window.__aiServeExecutions))
    .toBe(1);
});

test("縦画面を停止し横画面へ戻すと操作できる", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#viewportGate")).toBeVisible();
  await expect(page.locator("#viewportGateMessage")).toHaveText(
    "端末を横向きにしてください",
  );

  await page.setViewportSize({ width: 568, height: 320 });
  await expect(page.locator("#viewportGate")).toBeHidden();
  await page.locator("#start").click();

  const controls = page.locator("#serveControls");
  await expect(controls).toBeVisible();
  await expectServeControlsWithinRightRail(page);
});
