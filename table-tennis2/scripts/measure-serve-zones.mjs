// v0.3.0 §5.9.2: サーブ着地帯（目安）の測定生成器。
// 製品の findServeSolution() と同じ fallback 手順を再現し、プレイヤーサーブの
// **実入力 envelope** を総当たりして SERVE_ZONE_Z を決める。
// 出力の帯を src/config.ts へ転記し、単体テスト U-V8 で一致を固定する。
//
//   node scripts/measure-serve-zones.mjs
import {
  HL,
  PADDLE_LIMIT,
  PZ,
  SERVE_CONTACT_Y,
  SERVE_LENGTH_PROFILES,
  SERVE_LENGTHS,
  SERVE_PROFILES,
  SERVE_TYPES,
  SERVE_ZONE_PAD,
} from "../src/config.ts";
import {
  launch,
  onTable,
  simLand,
  simState,
  solveServe,
  tableBounce,
} from "../src/physics.ts";

const SEED = 20260906;
const DIRECTION = 1;
/** `speed` は MAX_GESTURE_SPEED × 2 = 7.2 で飽和するため vx の絶対値上限も 7.2。 */
export const FLICK_VX_SAMPLES = [
  -7.2, -3.6, -2.4, -1.2, -0.6, 0, 0.6, 1.2, 2.4, 3.6, 7.2,
];
/** 現実的 envelope（受入条件 (b) の対象）。 */
export const REALISTIC_VX_LIMIT = 3.6;

export function playerXSamples() {
  const samples = [];
  for (let x = -PADDLE_LIMIT; x <= PADDLE_LIMIT; x += 8) {
    samples.push(x);
  }
  return samples;
}

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

/** 製品 findServeSolution() の who === "P" 経路と同じ順序の fallback。 */
export function resolveServe(from, aimX, serveType, serveLength) {
  const profile = SERVE_PROFILES[serveType];
  const attempt = (length, aim) => {
    const solution = solveServe(
      from,
      aim,
      profile.spin,
      profile.screenCurve,
      DIRECTION,
      SERVE_LENGTH_PROFILES[length],
    );
    return solution.ok
      ? { solution, serveLength: length, aimX: aim, spin: profile.spin, side: profile.screenCurve }
      : null;
  };
  let resolved = attempt(serveLength, aimX);
  if (resolved) return { ...resolved, fallback: "none" };
  if (aimX !== 0) {
    resolved = attempt(serveLength, 0);
    if (resolved) return { ...resolved, fallback: "aim" };
  }
  resolved = attempt("middle", aimX);
  if (resolved) return { ...resolved, fallback: "length" };
  resolved = attempt("middle", 0);
  if (resolved) return { ...resolved, fallback: "length+aim" };
  return null;
}

/** 誤差適用後の第2バウンド z。serveTry() と同じ手順で求める。 */
export function landingAfterError(from, resolved, error, random) {
  const elevation = resolved.solution.elev + (random() * 2 - 1) * error;
  const azimuth = resolved.solution.azim + (random() * 2 - 1) * error * 1.4;
  const speed = resolved.solution.speed * (1 + (random() * 2 - 1) * error * 1.2);
  const ball = {
    ...from,
    ...launch(speed, elevation, azimuth),
    spin: resolved.spin,
    side: resolved.side,
  };
  const first = simLand(ball);
  if (first.net || !onTable(first.x, first.z) || first.z * DIRECTION >= 0) {
    return null;
  }
  const afterFirst = simState(ball, first.t);
  tableBounce(afterFirst);
  const second = simLand(afterFirst);
  if (second.net || !onTable(second.x, second.z) || second.z * DIRECTION <= 0) {
    return null;
  }
  return second.z;
}

export function measureServeZones(pad = SERVE_ZONE_PAD) {
  const stats = {};
  for (const length of SERVE_LENGTHS) {
    stats[length] = {
      population: 0,
      realisticPopulation: 0,
      requestedOk: 0,
      realisticRequestedOk: 0,
      fallbackAim: 0,
      fallbackLength: 0,
      unresolved: 0,
      baseZ: [],
      errorSamples: 0,
      errorInvalid: 0,
      errorZ: [],
    };
  }

  for (const playerX of playerXSamples()) {
    const from = { x: playerX * 0.5, y: SERVE_CONTACT_Y, z: PZ + 6 };
    for (const vx of FLICK_VX_SAMPLES) {
      const aimX = playerX * 0.6 + vx * 40;
      const error = vx === 0 ? 0.014 : 0.012;
      const realistic = Math.abs(vx) <= REALISTIC_VX_LIMIT;
      for (const serveType of SERVE_TYPES) {
        for (const length of SERVE_LENGTHS) {
          const bucket = stats[length];
          bucket.population += 1;
          if (realistic) bucket.realisticPopulation += 1;
          const resolved = resolveServe(from, aimX, serveType, length);
          if (!resolved) {
            bucket.unresolved += 1;
            continue;
          }
          if (resolved.fallback === "aim") bucket.fallbackAim += 1;
          if (resolved.fallback.startsWith("length")) bucket.fallbackLength += 1;
          if (resolved.serveLength !== length) {
            continue;
          }
          bucket.requestedOk += 1;
          if (realistic) bucket.realisticRequestedOk += 1;
          bucket.baseZ.push(resolved.solution.z2);
          // セル（player.x × vx × 球種 × 長さ）ごとに乱数を再初期化して1標本。
          const landing = landingAfterError(
            from,
            resolved,
            error,
            mulberry32(SEED),
          );
          bucket.errorSamples += 1;
          if (landing === null) bucket.errorInvalid += 1;
          else bucket.errorZ.push(landing);
        }
      }
    }
  }

  const zones = {};
  const report = {};
  for (const length of SERVE_LENGTHS) {
    const bucket = stats[length];
    const low = Math.max(4, Math.min(...bucket.baseZ) - pad);
    const high = Math.min(HL - 3, Math.max(...bucket.baseZ) + pad);
    zones[length] = [round(low), round(high)];
    const included = bucket.errorZ.filter(
      (z) => z >= zones[length][0] && z <= zones[length][1],
    ).length;
    report[length] = {
      population: bucket.population,
      requestedOk: bucket.requestedOk,
      requestedOkRate: rate(bucket.requestedOk, bucket.population),
      realisticRequestedOkRate: rate(
        bucket.realisticRequestedOk,
        bucket.realisticPopulation,
      ),
      fallbackAim: bucket.fallbackAim,
      fallbackLength: bucket.fallbackLength,
      unresolved: bucket.unresolved,
      baseZMin: round(Math.min(...bucket.baseZ)),
      baseZMax: round(Math.max(...bucket.baseZ)),
      errorSamples: bucket.errorSamples,
      errorInvalid: bucket.errorInvalid,
      errorIncluded: included,
      errorInclusionRate: rate(included, bucket.errorZ.length),
      zone: zones[length],
    };
  }
  return { zones, report };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function rate(part, total) {
  return total === 0 ? 0 : Math.round((part / total) * 10000) / 10000;
}

if (process.argv[1] && process.argv[1].endsWith("measure-serve-zones.mjs")) {
  const { zones, report } = measureServeZones();
  for (const length of SERVE_LENGTHS) {
    const row = report[length];
    console.log(
      `${length}: 母集団=${row.population} 要求長さ成立=${row.requestedOk} (${(row.requestedOkRate * 100).toFixed(2)}%) ` +
        `現実的envelope=${(row.realisticRequestedOkRate * 100).toFixed(2)}% ` +
        `aim fallback=${row.fallbackAim} length fallback=${row.fallbackLength} 解なし=${row.unresolved} ` +
        `z2=[${row.baseZMin}, ${row.baseZMax}] 帯=[${row.zone[0]}, ${row.zone[1]}] ` +
        `誤差後包含=${row.errorIncluded}/${row.errorSamples - row.errorInvalid} (${(row.errorInclusionRate * 100).toFixed(2)}%) ` +
        `誤差後不成立=${row.errorInvalid}`,
    );
  }
  console.log(
    "SERVE_ZONE_Z = " +
      JSON.stringify(zones)
        .replace(/"/gu, "")
        .replace(/,/gu, ", "),
  );
}
