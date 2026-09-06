// v0.3.0 §5.2 / §5.3 / §5.5 / §5.6: 描画に使う色の集約（palette）。
// 数値の演出定数は src/config.ts に置く。ここには色だけを置く。

export const THEME = {
  /** 会場（L0 静的レイヤ） */
  wall: {
    top: "#1c2128",
    middle: "#2b323b",
    horizon: "#3d454f",
  },
  /** 壁上部のスポット照明ハロー。静的（脈動しない）。 */
  lightHalo: "rgba(255,241,214,.16)",
  lightHaloEdge: "rgba(255,241,214,0)",
  crowd: "rgba(9,12,16,.86)",
  fence: "#17635c",
  fenceShade: "rgba(0,0,0,.18)",
  fenceEdge: "rgba(255,255,255,.22)",
  fenceTop: "rgba(255,255,255,.55)",
  fenceRib: "rgba(0,0,0,.28)",
  floor: {
    top: "#6e4d2a",
    middle: "#a67c3f",
    bottom: "#c49559",
  },
  floorPlank: "rgba(120,80,32,.20)",
  floorCross: "rgba(120,80,32,.13)",
  floorLine: "rgba(226,232,238,.34)",
  floorVignetteInner: "rgba(0,0,0,0)",
  floorVignetteOuter: "rgba(0,0,0,.38)",
  tableLight: "rgba(255,247,225,.24)",
  tableLightEdge: "rgba(0,0,0,0)",
  tableFloorShadow: ["rgba(0,0,0,.30)", "rgba(0,0,0,.16)", "rgba(0,0,0,.08)"],

  /** 卓球台（L1 静的レイヤ） */
  leg: "#1c2733",
  legHighlight: "rgba(255,255,255,.08)",
  sideNear: "#0f3a55",
  sideEdge: "#0d3149",
  sideHighlight: "rgba(255,255,255,.18)",
  top: {
    far: "#17466a",
    middle: "#1d5c86",
    near: "#236a9c",
  },
  topReflection: "rgba(255,255,255,.07)",
  topReflectionEdge: "rgba(255,255,255,0)",
  line: "#f3f6f8",
  netShadow: "rgba(0,0,0,.18)",

  /** ネット網（動的） */
  netFace: "rgba(232,238,244,.26)",
  netMesh: "rgba(255,255,255,.18)",
  netTape: "#ffffff",
  netPost: "#e8eef4",
  netPostCap: "#ffffff",

  /** ボール */
  ballCore: "#ffd9a8",
  ballMid: "#f2711c",
  ballEdge: "#c8560f",
  ballSpinLine: "rgba(255,255,255,.55)",
  smashGlow: "rgba(255,194,75,",

  /** プレイヤーラケット */
  playerBlade: "#cb4335",
  opponentBlade: "#b03a2e",
  bladeEdgeTape: "#1b1b1b",
  bladeShadeInner: "rgba(0,0,0,0)",
  bladeShadeOuter: "rgba(0,0,0,.22)",
  bladeSpecular: "rgba(255,255,255,.10)",
  handle: "#7a4a24",
  handleGrain: "rgba(0,0,0,.18)",
  handleEdge: "rgba(0,0,0,.35)",
  handleShine: "rgba(255,255,255,.12)",
  contactFlash: "rgba(255,224,117,",

  /** 相手プレイヤー */
  opponentShadow: "rgba(0,0,0,.24)",
  opponentLimb: "#1b2836",
  opponentShirt: "#e9edf1",
  opponentChestBand: "#c0392b",
  opponentHead: "#2b3a49",
  opponentHair: "#1b2836",

  /** 補助表示 */
  mark: "rgba(255,194,75,",
  contactGuide: "rgba(126,224,168,",
  assistOutline: "rgba(255,255,255,.22)",
  debugVisual: "rgba(126,224,168,.72)",
  debugAssist: "rgba(255,138,107,.72)",
  debugStroke: "rgba(126,224,168,.8)",
  serveZoneFill: "rgba(126,224,168,.10)",
  serveZoneEdge: "rgba(126,224,168,.35)",
} as const;
