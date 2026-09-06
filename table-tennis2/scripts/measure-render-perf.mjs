// v0.3.0 §5.11.2 / §9.5: 描画性能の外部計測harness。
// 基準版（cf89521）と v0.3.0 を「同一の測定器」で比較するため、製品側へ計測コードを
// 追加せずに rAF 間隔だけを外から記録する。基準版のコードは一切変更しない。
//
//   node scripts/measure-render-perf.mjs --url http://127.0.0.1:4173 --label baseline-cf89521
//
// 出力: 環境 × シナリオ の rAF 間隔 p50 / p95、50ms超のlong frame数、
//       data-phase の変化回数、（存在すれば）data-particles-live の最大値。
import { chromium, devices, webkit } from "@playwright/test";

const args = process.argv.slice(2);

function option(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

const baseUrl = option("url");
if (!baseUrl) {
  console.error("使い方: node scripts/measure-render-perf.mjs --url <preview URL> [--label <名前>] [--scenarios A,B,C] [--seconds 20]");
  process.exit(1);
}
const label = option("label", "target");
const seconds = Number(option("seconds", "20"));
const scenarioIds = option("scenarios", "A,B,C")
  .split(",")
  .map((id) => id.trim().toUpperCase())
  .filter(Boolean);

const ENVIRONMENTS = [
  {
    id: "desktop-chromium",
    browser: chromium,
    contextOptions: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    },
  },
  {
    id: "mobile-chromium",
    browser: chromium,
    contextOptions: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      userAgent: devices["Pixel 7"].userAgent,
    },
  },
  {
    id: "mobile-webkit",
    browser: webkit,
    contextOptions: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: false,
      userAgent: devices["iPhone 13"].userAgent,
    },
  },
];

// rAF 間隔の記録器。製品コードには触れず、ページ生成時に注入する。
const RECORDER = () => {
  const perf = {
    intervals: [],
    phaseChanges: 0,
    maxParticles: 0,
    marks: [],
  };
  Object.defineProperty(window, "__renderPerf", { value: perf });
  let previous = 0;
  const tick = (now) => {
    if (previous > 0) perf.intervals.push(now - previous);
    previous = now;
    const live = Number(document.body?.dataset?.particlesLive ?? 0);
    if (Number.isFinite(live) && live > perf.maxParticles) {
      perf.maxParticles = live;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const observe = () => {
    if (!document.body) {
      requestAnimationFrame(observe);
      return;
    }
    let lastPhase = document.body.dataset.phase ?? "";
    new MutationObserver(() => {
      const phase = document.body.dataset.phase ?? "";
      if (phase !== lastPhase) {
        lastPhase = phase;
        perf.phaseChanges += 1;
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["data-phase"] });
  };
  observe();
};

// シナリオを決定論にするための乱数固定。既存E2Eと同じ値を使い、AIサーブから始める。
const SEED_SERVER_A = () => {
  Math.random = () => 0.6;
};
const SEED_SYNTHETIC_CONTACT = () => {
  const values = [0.6, 0, 0, 0.5, 0.5, 0.5, 0.5];
  let index = 0;
  Math.random = () => values[index++] ?? 0.5;
};

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(ratio * sorted.length) - 1),
  );
  return sorted[index];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    frames: sorted.length,
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    longFrames: sorted.filter((value) => value > 50).length,
  };
}

async function resetRecorder(page) {
  await page.evaluate(() => {
    const perf = window.__renderPerf;
    perf.intervals.length = 0;
    perf.phaseChanges = 0;
    perf.maxParticles = 0;
  });
}

async function readRecorder(page) {
  return page.evaluate(() => ({
    intervals: window.__renderPerf.intervals.slice(),
    phaseChanges: window.__renderPerf.phaseChanges,
    maxParticles: window.__renderPerf.maxParticles,
  }));
}

// シナリオA: 中級で試合開始しAIサーブを放置する。serve → bounce → point が繰り返される。
async function scenarioA(page) {
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  await page.waitForTimeout(1_000);
  await resetRecorder(page);
  await page.waitForTimeout(seconds * 1_000);
  return readRecorder(page);
}

// シナリオB: 既存E2Eと同じ合成pointer入力を繰り返し、接触・バウンド・ネットを起こす。
async function scenarioB(page) {
  await page.goto(`${baseUrl}/?debugInput=1`);
  await page.locator("#start").click();
  await page.waitForTimeout(1_000);
  await resetRecorder(page);
  await page.evaluate(async (durationMs) => {
    const canvas = document.querySelector("#cv");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("#cv が見つかりません。");
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
    const started = performance.now();
    const rect0 = canvas.getBoundingClientRect();
    dispatch("pointerdown", {
      pointerId,
      clientX: rect0.left + rect0.width / 2,
      clientY: rect0.top + rect0.height * 0.72,
      buttons: 1,
    });
    while (performance.now() - started < durationMs) {
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
      clientX: rect0.left + rect0.width / 2,
      clientY: rect0.top + rect0.height * 0.72,
      buttons: 0,
    });
  }, seconds * 1_000);
  return readRecorder(page);
}

// シナリオC: 844×390 ↔ 568×320 の resize を3往復し、直後3フレームの最大間隔を記録する。
async function scenarioC(page) {
  await page.goto(`${baseUrl}/`);
  await page.locator("#start").click();
  await page.waitForTimeout(1_000);
  const peaks = [];
  for (let round = 0; round < 3; round += 1) {
    for (const size of [
      { width: 568, height: 320 },
      { width: 844, height: 390 },
    ]) {
      await resetRecorder(page);
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      const observed = await readRecorder(page);
      peaks.push(Math.max(0, ...observed.intervals.slice(0, 3)));
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  return {
    intervals: peaks,
    phaseChanges: 0,
    maxParticles: 0,
    coldPeaks: peaks.map((value) => Number(value.toFixed(2))),
  };
}

const SCENARIOS = {
  A: { run: scenarioA, seed: SEED_SERVER_A },
  B: { run: scenarioB, seed: SEED_SYNTHETIC_CONTACT },
  C: { run: scenarioC, seed: SEED_SERVER_A },
};

const report = { label, url: baseUrl, seconds, measuredAt: new Date().toISOString(), results: [] };

for (const environment of ENVIRONMENTS) {
  const browser = await environment.browser.launch();
  try {
    for (const id of scenarioIds) {
      const scenario = SCENARIOS[id];
      if (!scenario) continue;
      const context = await browser.newContext(environment.contextOptions);
      await context.addInitScript(scenario.seed);
      await context.addInitScript(RECORDER);
      const page = await context.newPage();
      try {
        const observed = await scenario.run(page);
        report.results.push({
          environment: environment.id,
          scenario: id,
          ...summarize(observed.intervals),
          phaseChanges: observed.phaseChanges,
          maxParticles: observed.maxParticles,
          ...(observed.coldPeaks ? { coldPeaks: observed.coldPeaks } : {}),
          renderMsP50: await page.evaluate(
            () => document.body.dataset.renderMsP50 ?? null,
          ),
          renderMsP95: await page.evaluate(
            () => document.body.dataset.renderMsP95 ?? null,
          ),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

for (const row of report.results) {
  console.log(
    `${report.label} ${row.environment} ${row.scenario}: ` +
      `frames=${row.frames} p50=${row.p50}ms p95=${row.p95}ms max=${row.max}ms ` +
      `long(>50ms)=${row.longFrames} phaseChanges=${row.phaseChanges} ` +
      `maxParticles=${row.maxParticles}` +
      (row.coldPeaks ? ` coldPeaks=[${row.coldPeaks.join(", ")}]` : "") +
      (row.renderMsP95 ? ` renderMsP95=${row.renderMsP95}` : ""),
  );
}
console.log(JSON.stringify(report));
