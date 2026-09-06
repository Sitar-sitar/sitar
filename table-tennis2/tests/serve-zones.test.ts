// v0.3.0 §9.2 U-V8: SERVE_ZONE_Z の一致と実入力 envelope の検査。
// 母集団・fallback 手順・誤差モデルは測定生成器 scripts/measure-serve-zones.mjs と
// **同じ関数**を共有する（テスト内で物理処理を複製しない。Obsidian注意点29）。
import assert from "node:assert/strict";
import test from "node:test";

import { HL, SERVE_LENGTHS, SERVE_ZONE_Z } from "../src/config.ts";
// @ts-expect-error 測定生成器は .mjs（型宣言を持たない）。製品コードは import しない。
import { measureServeZones } from "../scripts/measure-serve-zones.mjs";

/**
 * §5.9.2 受入条件 (b)（現実的 envelope の要求長さ成功率 ≥ 95%）の実測値。
 * middle / long は未達であり、設計書 §5.9.2 の処置「帯を目安として表示し、
 * 実装ログへ率を記録し、UI 文言は変えない」を適用している。
 * 回帰検出のため、実測値からの低下をここで固定する。
 */
const RECORDED_REALISTIC_RATE: Record<string, number> = {
  short: 1,
  middle: 0.8025,
  long: 0.7805,
};

const measurement = measureServeZones() as {
  zones: Record<string, [number, number]>;
  report: Record<
    string,
    {
      population: number;
      requestedOk: number;
      realisticRequestedOkRate: number;
      fallbackAim: number;
      fallbackLength: number;
      unresolved: number;
      errorSamples: number;
      errorInvalid: number;
      errorIncluded: number;
      errorInclusionRate: number;
      zone: [number, number];
    }
  >;
};

test("U-V8(a): 測定生成器の帯と SERVE_ZONE_Z が一致する", () => {
  for (const length of SERVE_LENGTHS) {
    assert.deepEqual(
      [...SERVE_ZONE_Z[length]],
      measurement.zones[length],
      `SERVE_ZONE_Z.${length} が測定値と一致しません。`,
    );
  }
});

test("U-V8(b): 実入力envelopeの成功率とfallback件数を固定する", (t) => {
  for (const length of SERVE_LENGTHS) {
    const row = measurement.report[length];
    assert.ok(row, `${length} の測定結果がありません。`);
    t.diagnostic(
      `${length}: 母集団=${row.population} 要求長さ成立=${row.requestedOk} ` +
        `現実的envelope成功率=${(row.realisticRequestedOkRate * 100).toFixed(2)}% ` +
        `aim fallback=${row.fallbackAim} length fallback=${row.fallbackLength} ` +
        `解なし=${row.unresolved}`,
    );
    assert.equal(row.population, 2673);
    assert.ok(
      row.realisticRequestedOkRate >= RECORDED_REALISTIC_RATE[length]! - 0.005,
      `${length} の現実的envelope成功率が記録値 ${RECORDED_REALISTIC_RATE[length]} から低下しました。`,
    );
  }
  // 受入条件 (b) の 95% を満たすのは short のみ。middle / long は §5.9.2 の処置を適用。
  assert.ok(measurement.report.short!.realisticRequestedOkRate >= 0.95);
});

test("U-V8(c): 誤差適用後の帯包含率が各長さ95%以上", (t) => {
  for (const length of SERVE_LENGTHS) {
    const row = measurement.report[length]!;
    t.diagnostic(
      `${length}: 誤差後包含=${row.errorIncluded}/${row.errorSamples - row.errorInvalid} ` +
        `(${(row.errorInclusionRate * 100).toFixed(2)}%) 誤差後不成立=${row.errorInvalid}`,
    );
    assert.ok(
      row.errorInclusionRate >= 0.95,
      `${length} の誤差適用後包含率が95%未満です（${row.errorInclusionRate}）。`,
    );
  }
});

test("U-V8(d): 帯の中央値が short < middle < long", (t) => {
  const median = (length: string): number => {
    const zone = SERVE_ZONE_Z[length as (typeof SERVE_LENGTHS)[number]];
    return (zone[0] + zone[1]) / 2;
  };
  assert.ok(median("short") < median("middle"));
  assert.ok(median("middle") < median("long"));
  // 向かい合う縁だけ pad を縮める規則により、short の上端 < long の下端が成立する。
  const shortHigh = SERVE_ZONE_Z.short[1];
  const longLow = SERVE_ZONE_Z.long[0];
  t.diagnostic(`short上端=${shortHigh} / long下端=${longLow}`);
  assert.ok(
    shortHigh < longLow,
    `short の上端 ${shortHigh} は long の下端 ${longLow} より小さくしてください。`,
  );
});

test("U-V8(e): 帯が [4, HL-3] の内側に収まる", () => {
  for (const length of SERVE_LENGTHS) {
    const [low, high] = SERVE_ZONE_Z[length];
    assert.ok(low >= 4, `${length} の下端が 4 未満です。`);
    assert.ok(high <= HL - 3, `${length} の上端が HL-3 を超えました。`);
    assert.ok(low < high, `${length} の帯が空です。`);
  }
});
