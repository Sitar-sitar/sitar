// v0.3.0 §5.4.2 / §5.8.1 / §5.8.2 / §5.8.4: HUD文言と色分けの純粋関数。
// DOM にも Canvas にも触れない（単体テスト対象）。
import {
  CONTACT_QUALITY_LABEL_THRESHOLDS,
  RALLY_PULSE_EVERY,
  SPIN_TINT_THRESHOLD,
} from "../config.ts";
import type { HudPulse, HudSnapshot, Side } from "../types.ts";

/**
 * §5.8.1: 接触品質ラベル。ラベルは文字のみで、部分的な色分けはしない。
 * 難易度別の品質下限は 0.55 / 0.47 / 0.40 のため「ギリギリ」は初級でも出る
 * （発生範囲が [0.55, 0.60) と最も狭いだけ）。
 */
export function contactQualityLabel(contactQuality: number): string {
  const [just, nice, ok] = CONTACT_QUALITY_LABEL_THRESHOLDS;
  if (contactQuality >= just) return "ジャスト";
  if (contactQuality >= nice) return "ナイス";
  if (contactQuality >= ok) return "OK";
  return "ギリギリ";
}

export type SpinTintKind = "top" | "back" | "neutral";

export interface SpinTint {
  kind: SpinTintKind;
  rgb: readonly [number, number, number];
}

/** §5.4.2: 軌跡・回転線の色。球本体の色は変えない。 */
export function spinTint(spin: number): SpinTint {
  if (spin >= SPIN_TINT_THRESHOLD) {
    return { kind: "top", rgb: [255, 154, 60] };
  }
  if (spin <= -SPIN_TINT_THRESHOLD) {
    return { kind: "back", rgb: [126, 215, 255] };
  }
  return { kind: "neutral", rgb: [242, 113, 28] };
}

export function spinTintCss(tint: SpinTint, alpha: number): string {
  const [r, g, b] = tint.rgb;
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface PointBannerText {
  title: string;
  detail: string;
}

/**
 * §5.8.2: 得点バナーの文言。得点者を「文字で」示すため色だけに依存しない。
 * reason は game.ts / rules.ts が渡す現行の5種をそのまま受ける。
 */
export function pointBannerText(
  winner: Side,
  reason: string,
): PointBannerText {
  const title = winner === "P" ? "あなたの得点" : "あいての得点";
  const detail = detailFor(winner, reason);
  return { title, detail };
}

function detailFor(winner: Side, reason: string): string {
  if (winner === "P") {
    switch (reason) {
      case "ネット":
        return "あいてがネット";
      case "アウト":
        return "あいてがアウト";
      case "返せず":
        return "あいてが返せず";
      case "サーブフォルト":
        return "あいてがサーブフォルト";
      case "自陣に落下":
        return "あいてが自陣に落とした";
      default:
        return reason;
    }
  }
  switch (reason) {
    case "ネット":
      return "ネットにかけた";
    case "アウト":
      return "台を外した";
    case "返せず":
      return "返せなかった";
    case "サーブフォルト":
      return "サーブフォルト";
    case "自陣に落下":
      return "自陣に落とした";
    default:
      return reason;
  }
}

/**
 * §5.8.4: HUD演出のエッジ検出。tick() はラリー中 240Hz で updateHud() を呼ぶため、
 * 同じスナップショットを何度与えてもパルスは出さない。
 */
export function hudPulseEvents(
  previous: HudSnapshot,
  next: HudSnapshot,
): HudPulse[] {
  const pulses: HudPulse[] = [];
  if (next.scP > previous.scP) pulses.push("score-P");
  if (next.scA > previous.scA) pulses.push("score-A");
  if (
    next.rally !== previous.rally &&
    next.rally > 0 &&
    next.rally % RALLY_PULSE_EVERY === 0
  ) {
    pulses.push("rally");
  }
  return pulses;
}
