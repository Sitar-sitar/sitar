// v0.2.4 修正設計書 §3.1 の測定生成器。
// 設計書 §3.4 / §6 の数値を第三者が再現するために使う。製品コードは変更しない。
//
//   node --experimental-strip-types scripts/measure-play-balance.mjs
//
// 生成器A: AI統計（自滅率 / 返球猶予 / 打点y / 画面速度 / 奥行き窓）
// 生成器B: プレイヤー返球の相手コート到達率
import {
  FIXED_STEP,
  FLOOR,
  LEVELS,
  LEVEL_PLAY,
  NET_H,
  SHOT_ORIGIN_Y_MIN,
} from "../src/config.ts";
import { buildShotIntent } from "../src/control/shot-intent.ts";
import { contactDepthTolerance } from "../src/control/contact.ts";
import {
  integrate,
  onTable,
  simLand,
  solveContactPlane,
  solveDirectPlayerShot,
  solveShot,
  tableBounce,
} from "../src/physics.ts";
import { OpponentAi } from "../src/ai.ts";
import {
  createProjectionCamera,
  projectWorldPoint,
} from "../src/view/projection.ts";

// --baseline: solverをv0.2.3挙動（pace=1 / precision=1）へ戻して測定する。
// §3.4の現行値は、LEVELS.missを旧値（0.11 / 0.08 / 0.02）へ戻したうえで
// 本フラグを付けて実行することで再現できる。blunderは常に製品経路
// （OpponentAi.decideShot()の抽選結果）を使い、乱数列を製品と一致させる。
const BASELINE = process.argv.includes("--baseline");
const SEED = 20260903;
const VIEWPORT = { width: 640, height: 360 };
const LEVEL_IDS = ["easy", "mid", "hard"];

/** 設計書 §3.1 が指定する乱数。mulberry32。 */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 昇順ソート後 s[floor(p * n)]。線形補間しない。 */
function percentile(values, p) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/**
 * 生成器A: 1難易度につきseedを1回だけ初期化し、母集団生成・AI判断・弾道解決で
 * 同じ乱数列を消費する。
 */
function measureAi(level, trials = 6000) {
  const random = mulberry32(SEED);
  const ai = new OpponentAi(random);
  const camera = createProjectionCamera(VIEWPORT.width, VIEWPORT.height);
  const flight = [];
  const heights = [];
  const screenSpeeds = [];
  const windows = [];
  let attempted = 0;
  let selfDestruct = 0;

  for (let index = 0; index < trials; index += 1) {
    const ball = {
      x: (random() * 2 - 1) * 45,
      y: 16 + random() * 26,
      z: 150 + random() * 28,
      vx: 0,
      vy: -120,
      vz: 300,
      spin: 0.2,
      side: 0,
      live: true,
      hitter: "P",
      bounces: 1,
      serveStage: 0,
      lastBounceZ: 40 + random() * 70,
    };
    ai.state.x = ball.x + (random() * 2 - 1) * LEVELS[level].reach * 0.7;
    const playerX = (random() * 2 - 1) * 60;
    const decision = ai.decideShot(ball, playerX, level);
    // AIが届かない試行は母集団から除外し、自滅率の分母にも入れない。
    if (!decision) continue;
    attempted += 1;

    const from = {
      x: ball.x,
      y: Math.max(ball.y, SHOT_ORIGIN_Y_MIN),
      z: ball.z,
    };
    const solution = solveShot({
      from,
      type: decision.type,
      direction: -1,
      aimX: decision.aim,
      depth: decision.depth,
      contactQuality: decision.quality,
      extraError: decision.blunder,
      ballY: ball.y,
      random,
      pace: BASELINE ? 1 : LEVEL_PLAY[level].aiPace,
      precision: BASELINE ? 1 : LEVEL_PLAY[level].aiPrecision,
    });
    const landing = simLand({ ...from, ...solution });
    if (landing.net || !onTable(landing.x, landing.z) || landing.z >= 0) {
      selfDestruct += 1;
      continue;
    }

    Object.assign(ball, from, solution);
    ball.hitter = "A";
    ball.bounces = 0;
    ball.lastBounceZ = null;
    const plane = solveContactPlane(ball, "P");

    let previousX;
    let previousY;
    let previousZ;
    let bounced = false;
    let elapsed = 0;
    let reached = false;
    for (let step = 0; step < 240 * 5; step += 1) {
      previousX = ball.x;
      previousY = ball.y;
      previousZ = ball.z;
      integrate(ball, FIXED_STEP);
      elapsed += FIXED_STEP;
      if (previousZ < 0 !== ball.z < 0) {
        const ratio = (0 - previousZ) / (ball.z - previousZ);
        if (previousY + (ball.y - previousY) * ratio < NET_H) break;
      }
      if (previousY > 0 && ball.y <= 0) {
        if (!onTable(ball.x, ball.z)) break;
        if (!bounced && ball.z < 0) {
          bounced = true;
          tableBounce(ball);
          continue;
        }
        break;
      }
      if (ball.y < FLOOR) break;
      if (bounced && previousZ > plane && ball.z <= plane) {
        reached = true;
        const now = projectWorldPoint(camera, ball.x, ball.y, ball.z);
        const before = projectWorldPoint(
          camera,
          previousX,
          previousY,
          previousZ,
        );
        flight.push(elapsed);
        heights.push(ball.y);
        screenSpeeds.push(
          Math.hypot(now.x - before.x, now.y - before.y) / FIXED_STEP,
        );
        windows.push(
          (2 * contactDepthTolerance(ball.vz)) /
            Math.max(1, Math.abs(ball.vz)) *
            1000,
        );
        break;
      }
    }
    // 接触面へ到達しない試行は統計から除外する（自滅には数えない）。
    if (!reached) continue;
  }

  return {
    selfDestruct: (selfDestruct / attempted) * 100,
    flight50: percentile(flight, 0.5),
    flight10: percentile(flight, 0.1),
    height50: percentile(heights, 0.5),
    screen50: percentile(screenSpeeds, 0.5),
    window50: percentile(windows, 0.5),
  };
}

/**
 * 生成器B: セル（接触面z × 打点y × 品質q）ごとにseedを再初期化し、各セル400試行。
 * incomingは無回転を基準とする。
 */
function measurePassivePush(quality, errorScale, trials = 400) {
  const planes = [-30, -60, -90, -120, -150, -178];
  const ballHeights = [10, 17, 26];
  let landed = 0;
  let total = 0;
  let worst = { rate: Number.POSITIVE_INFINITY, cell: "" };

  for (const z of planes) {
    for (const y of ballHeights) {
      const random = mulberry32(SEED);
      const from = { x: 0, y, z };
      const intent = buildShotIntent(
        {
          screenX: 0,
          screenY: 0,
          contactOffsetX: 0,
          contactOffsetY: 0,
          screenQuality: quality,
          timingQuality: quality,
          contactQuality: quality,
          ballHeight: y,
          ballVelocityBefore: {
            x: 0,
            y,
            z,
            vx: 0,
            vy: -100,
            vz: -500,
            spin: 0,
            side: 0,
          },
          strikeMetrics: {
            vx: 0,
            vy: 0,
            speed: 0,
            displacement: 0,
            directionX: 0,
            directionY: 0,
            verticality: 0,
            curvature: 0,
            age: 0,
            active: false,
          },
          time: 1,
        },
        -70,
      );
      let cell = 0;
      for (let index = 0; index < trials; index += 1) {
        const solution = solveDirectPlayerShot({
          from,
          incoming: { spin: 0, side: 0 },
          intent,
          random,
          errorScale,
        });
        if (!solution) continue;
        const landing = simLand({ ...from, ...solution });
        if (!landing.net && landing.z > 0 && onTable(landing.x, landing.z)) {
          cell += 1;
        }
      }
      landed += cell;
      total += trials;
      if (cell / trials < worst.rate) {
        worst = { rate: cell / trials, cell: `z=${z}, y=${y}` };
      }
    }
  }
  return { rate: landed / total, worst };
}

console.log(
  `seed=${SEED} viewport=${VIEWPORT.width}x${VIEWPORT.height} ` +
    `mode=${BASELINE ? "baseline(solver v0.2.3)" : "v0.2.4"}\n`,
);
console.log("=== 生成器A: AI統計（N=6,000）===");
for (const level of LEVEL_IDS) {
  const r = measureAi(level);
  console.log(
    `  ${LEVELS[level].name}: 自滅率=${r.selfDestruct.toFixed(2)}% ` +
      `返球猶予 p50=${r.flight50.toFixed(3)}s p10=${r.flight10.toFixed(3)}s ` +
      `打点y p50=${r.height50.toFixed(1)}cm ` +
      `画面速度 p50=${r.screen50.toFixed(0)}px/s ` +
      `奥行き窓 p50=${r.window50.toFixed(0)}ms`,
  );
}

console.log("\n=== 生成器B: 置くだけ返球の相手コート到達率（18セル×400試行）===");
for (const level of LEVEL_IDS) {
  const play = LEVEL_PLAY[level];
  const r = measurePassivePush(play.contactQualityFloor, play.playerErrorScale);
  console.log(
    `  ${LEVELS[level].name}（q=${play.contactQualityFloor} / ` +
      `errorScale=${play.playerErrorScale}）: 全体 ${(r.rate * 100).toFixed(1)}% ` +
      `最悪セル ${(r.worst.rate * 100).toFixed(1)}% @ ${r.worst.cell}`,
  );
}

console.log("\n=== 参考: 難易度スケールなし（errorScale=1）の品質別 ===");
for (const quality of [1, 0.7, 0.55, 0.47, 0.4]) {
  const r = measurePassivePush(quality, 1);
  console.log(
    `  q=${quality}: 全体 ${(r.rate * 100).toFixed(1)}% ` +
      `最悪セル ${(r.worst.rate * 100).toFixed(1)}% @ ${r.worst.cell}`,
  );
}
