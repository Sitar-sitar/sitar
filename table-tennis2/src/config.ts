import type {
  LevelConfig,
  LevelId,
  LevelPlayProfile,
  ServeLength,
  ServeLengthProfile,
  ServeProfile,
  ServeType,
  ShotConfig,
  ShotId,
} from "./types.ts";

export const G = 980;
export const DRAG = 0.11;
export const MAG = 0.9;
export const MAGS = 0.55;
export const HW = 76.25;
export const HL = 137;
export const NET_H = 15.25;
export const NET_HW = 84;
export const FLOOR = -76;
export const E_TABLE = 0.8;

export const PZ = -152;
export const AZ = 152;
export const P_REACH = 31;
export const P_SPEED = 385;
export const BALL_R = 2;

export const SHOTS: Record<ShotId, ShotConfig> = {
  DRIVE: {
    speed: { model: "absolute", sp: [810, 950] },
    spin: 0.95,
    dep: 100,
    err: 0.017,
    lab: "ドライブ",
  },
  SMASH: {
    speed: { model: "absolute", sp: [1360, 1520] },
    spin: 0.42,
    dep: 108,
    err: 0.012,
    lab: "スマッシュ！",
  },
  PUSH: {
    speed: { model: "absolute", sp: [430, 510] },
    spin: -0.2,
    dep: 88,
    err: 0.015,
    lab: "押し出し",
  },
  CHOP: {
    speed: { model: "absolute", sp: [395, 470] },
    spin: -0.92,
    dep: 96,
    err: 0.017,
    lab: "ツッツキ",
  },
  LOB: {
    speed: { model: "arc", elev: 1.02 },
    spin: 0.35,
    dep: 118,
    err: 0.03,
    lab: "ロブ",
  },
  STOP: {
    speed: { model: "touch", elev: 0.5, margin: [1.0, 1.08] },
    spin: -0.5,
    dep: 26,
    err: 0.02,
    lab: "ストップ",
  },
  FLICK: {
    speed: { model: "touch", elev: 0.4, margin: [1.03, 1.18] },
    spin: 0.75,
    dep: 78,
    err: 0.022,
    lab: "フリック",
  },
};

export const LEVELS: Record<LevelId, LevelConfig> = {
  easy: {
    name: "初級",
    delay: 0.3,
    speed: 108,
    perr: 17,
    refine: 0.34,
    smash: 0,
    chop: 0.05,
    miss: 0.26,
    spread: 0.32,
    reach: 30,
    depth: 84,
    serveErr: 0.045,
    lob: 0.5,
  },
  mid: {
    name: "中級",
    delay: 0.18,
    speed: 152,
    perr: 12,
    refine: 0.18,
    smash: 0.4,
    chop: 0.25,
    miss: 0.09,
    spread: 0.72,
    reach: 30,
    depth: 95,
    serveErr: 0.032,
    lob: 0.7,
  },
  hard: {
    name: "上級",
    delay: 0.07,
    speed: 222,
    perr: 4,
    refine: 0.05,
    smash: 0.85,
    chop: 0.35,
    miss: 0.01,
    spread: 1,
    reach: 33,
    depth: 100,
    serveErr: 0.016,
    lob: 0.9,
  },
};

/**
 * 難易度ごとのプレイ調整（v0.2.4）。
 * 上級は v0.2.3 の操作契約と同値（assistScale / contactQualityFloor / playerErrorScale）。
 */
export const LEVEL_PLAY: Record<LevelId, LevelPlayProfile> = {
  easy: {
    aiPace: 0.2,
    aiPrecision: 1.55,
    assistScale: 1.25,
    contactQualityFloor: 0.55,
    playerErrorScale: 0.6,
  },
  mid: {
    aiPace: 0.65,
    aiPrecision: 0.9,
    assistScale: 1.1,
    contactQualityFloor: 0.47,
    playerErrorScale: 0.85,
  },
  hard: {
    aiPace: 1,
    aiPrecision: 0.45,
    assistScale: 1,
    contactQualityFloor: 0.4,
    playerErrorScale: 1,
  },
};

/** 難易度選択UIで表示する説明文 */
export const LEVEL_DESCRIPTIONS: Record<LevelId, string> = {
  easy: "球が遅く、ラケットが当たりやすい。置くだけでも返せる",
  mid: "ふつうの球速。狙って合わせれば返せる",
  hard: "球が速く逆を突かれる。正確に合わせる必要がある",
};

export const SERVE_TYPES: readonly ServeType[] = [
  "topspin",
  "backspin",
  "side-left",
  "side-right",
  "knuckle",
  "topspin-left",
  "topspin-right",
  "backspin-left",
  "backspin-right",
];

export const SERVE_PROFILES: Record<ServeType, ServeProfile> = {
  topspin: {
    id: "topspin",
    label: "上回転",
    spin: 0.55,
    screenCurve: 0,
  },
  backspin: {
    id: "backspin",
    label: "下回転",
    spin: -0.65,
    screenCurve: 0,
  },
  "side-left": {
    id: "side-left",
    label: "横左",
    spin: 0,
    screenCurve: -0.55,
  },
  "side-right": {
    id: "side-right",
    label: "横右",
    spin: 0,
    screenCurve: 0.55,
  },
  knuckle: {
    id: "knuckle",
    label: "ナックル",
    spin: 0,
    screenCurve: 0,
  },
  "topspin-left": {
    id: "topspin-left",
    label: "横上左",
    spin: 0.45,
    screenCurve: -0.42,
  },
  "topspin-right": {
    id: "topspin-right",
    label: "横上右",
    spin: 0.45,
    screenCurve: 0.42,
  },
  "backspin-left": {
    id: "backspin-left",
    label: "横下左",
    spin: -0.3,
    screenCurve: -0.26,
  },
  "backspin-right": {
    id: "backspin-right",
    label: "横下右",
    spin: -0.3,
    screenCurve: 0.26,
  },
};

export const SERVE_LENGTHS: readonly ServeLength[] = [
  "short",
  "middle",
  "long",
];

export const SERVE_LENGTH_PROFILES: Record<
  ServeLength,
  ServeLengthProfile
> = {
  short: {
    id: "short",
    label: "短い",
    targetZ: 34,
    distances: [124, 110],
    speedBase: 160,
    speedStep: 24,
    aimScale: 0.5,
  },
  middle: {
    id: "middle",
    label: "中",
    targetZ: 70,
    distances: [82, 60],
    speedBase: 300,
    speedStep: 66,
    aimScale: 0.35,
  },
  long: {
    id: "long",
    label: "長い",
    targetZ: 124,
    distances: [62, 50],
    speedBase: 420,
    speedStep: 70,
    aimScale: 0.16,
  },
};

export const AI_SERVE_LENGTH_WEIGHTS: Record<
  LevelId,
  Readonly<Record<ServeLength, number>>
> = {
  easy: {
    short: 5,
    middle: 80,
    long: 15,
  },
  mid: {
    short: 25,
    middle: 50,
    long: 25,
  },
  hard: {
    short: 40,
    middle: 30,
    long: 30,
  },
};

export const AI_SERVE_WEIGHTS: Record<
  LevelId,
  Readonly<Record<ServeType, number>>
> = {
  easy: {
    topspin: 40,
    backspin: 0,
    "side-left": 10,
    "side-right": 10,
    knuckle: 35,
    "topspin-left": 0,
    "topspin-right": 0,
    "backspin-left": 0,
    "backspin-right": 5,
  },
  mid: {
    topspin: 18,
    backspin: 20,
    "side-left": 12,
    "side-right": 12,
    knuckle: 12,
    "topspin-left": 8,
    "topspin-right": 8,
    "backspin-left": 5,
    "backspin-right": 5,
  },
  hard: {
    topspin: 12,
    backspin: 14,
    "side-left": 10,
    "side-right": 10,
    knuckle: 8,
    "topspin-left": 12,
    "topspin-right": 12,
    "backspin-left": 11,
    "backspin-right": 11,
  },
};

export const PADDLE_LIMIT = 104;
export const PLAYER_AIM_SPAN = 210;
export const PADDLE_SCREEN_Y = 0.86;
export const PADDLE_SWING_LIFT = 0.1;
export const PADDLE_SWING_DROP = 0.045;
export const PADDLE_SWING_PUSH = 0.03;
export const PADDLE_SCREEN_SIZE = 0.055;
export const PADDLE_SIZE_MIN = 18;
export const PADDLE_SIZE_MAX = 46;
export const PADDLE_BLADE_SCALE = 1.25;
export const PADDLE_HANDLE_LENGTH = 1.15;
export const PADDLE_HANDLE_WIDTH = 0.42;
export const PADDLE_HANDLE_INSET = 0.55;
export const PADDLE_HANDLE_TILT = 0.5;
export const PADDLE_EDGE_MARGIN = 4;
export const PADDLE_DEPTH_RISE = 0.12;
export const PADDLE_DEPTH_SHRINK = 0.3;
export const PADDLE_SHADOW_GAP = 0.095;
export const P_DEPTH_SPEED = 380;
export const STROKE_HISTORY_SEC = 0.15;
export const CONTACT_WEIGHT_SEC = 0.1;
export const STROKE_SNAPSHOT_TTL_SEC = 0.1;
export const MAX_POINTER_SAMPLES = 32;
export const GESTURE_MIN_SPEED = 0.55;
export const STRIKE_ACTIVE_MAX_AGE_SEC = 0.16;
export const CONTACT_RELEASE_GRACE_TOUCH_SEC = 0.35;
export const CONTACT_RELEASE_GRACE_FINE_SEC = 0.22;
export const STRIKE_WINDOW_SEC = 0.08;
export const STRIKE_MIN_SPEED = 1.1;
export const STRIKE_MIN_DISPLACEMENT = 0.04;
export const STRIKE_MIN_VERTICALITY = 0.55;
export const SMASH_GESTURE_SPEED = 2.9;
export const MAX_GESTURE_SPEED = 3.6;
export const CURVE_MIN_SEGMENT = 0.008;
export const CURVE_MIN_DISPLACEMENT = 0.03;
export const CURVE_SPIN_THRESHOLD = 0.3;
export const POINTER_OFFSET_TOUCH = 0.06;
export const POINTER_OFFSET_FINE = 0.01;
export const POINTER_PREDICTION_MAX_SEC = 0.016;
export const POINTER_PREDICTION_MAX_DISTANCE_RATIO = 0.05;
export const PADDLE_SCREEN_Y_MIN = 0.35;
export const PADDLE_SCREEN_Y_MAX = 0.9;
export const CONTACT_DEPTH_BASE = 14;
export const CONTACT_DEPTH_MAX = 24;
export const CONTACT_ASSIST_TOUCH = 1.4;
export const CONTACT_ASSIST_FINE = 1.2;
export const ASSIST_CONTACT_QUALITY_FLOOR = 0.4;
/** 必要速度を逆算するときの参照仰角（rad）。この付近で必要速度が最小になる */
export const SHOT_MIN_SPEED_ELEV = 0.55;
/** プレイヤー返球の必要速度フロアに掛ける余裕率 */
export const PLAYER_SHOT_SPEED_MARGIN = 1.16;
/** AI 返球の最低成立速度に掛ける余裕率 */
export const AI_SHOT_SPEED_MARGIN = 1.05;
export const MAX_TOP_SPIN = 1.25;
export const MAX_SIDE_SPIN = 1;
export const ACTIVE_SPIN_CARRY = 0.18;
export const ACTIVE_SIDE_CARRY = 0.25;
export const PASSIVE_SPIN_CARRY = 0.55;
export const PASSIVE_SIDE_CARRY = 0.6;
export const MAX_SUBSTEPS = 12;
export const MAX_FRAME_DELTA = 0.05;
export const SWING_DECAY = 6;
export const AI_SERVE_DELAY_MS = 700;
export const SERVE_CONTACT_Y = 24;
export const CONTACT_PLANE_NEAR = 30;
export const CONTACT_PLANE_FAR = 178;
export const SHORT_BOUNCE_Z = 48;
export const SHORT_BALL_MAX_Y = 22;
export const SHOT_ORIGIN_Y_MIN = -46;
export const AI_CONTACT_Y_MIN = -42;
export const AI_CONTACT_Y_MAX = 105;
export const TRAIL_LENGTH = 9;
export const SMASH_CHECK_INTERVAL = 0.08;
export const SMASH_MIN_Y = 26;
export const SMASH_REACH_MARGIN = 8;
export const PLAYER_CONTACT_Y_MIN = -46;
export const PLAYER_CONTACT_Y_MAX = 108;
export const LOB_MAX_Y = -8;
export const POINT_INTERVAL = 1.25;
export const RESULT_DELAY_MS = 1000;
export const AI_LOB_MAX_Y = -12;
export const AI_SMASH_MIN_Y = 24;
export const AI_CHOP_SPIN_MAX = -0.35;
export const AI_CHOP_MAX_Y = 14;

export const FIXED_STEP = 1 / 240;

// ---------------------------------------------------------------------------
// v0.3.0 §5.12: グラフィック強化と演出の定数。既存の物理・操作定数は変更しない。
// 色は src/render/theme.ts、純粋ロジックは src/view/effects.ts / hud-text.ts。
// ---------------------------------------------------------------------------

/** VisualEvent バッファの上限。超過時は最古を捨てる。 */
export const VISUAL_EVENT_BUFFER = 16;
/** 生存粒子の上限。超過時は最古を捨てる。 */
export const EFFECT_MAX_PARTICLES = 48;
/** 接触スパークの個数（passive PUSH / それ以外 / SMASH）。 */
export const CONTACT_SPARK_COUNT = {
  passive: 6,
  active: 10,
  smash: 16,
} as const;
/** 接触スパークの初速レンジ cm/s。 */
export const CONTACT_SPARK_SPEED: readonly [number, number] = [120, 260];
export const CONTACT_SPARK_TTL_SEC = 0.28;
/** 粒子に掛かる重力 cm/s^2。 */
export const EFFECT_GRAVITY = 600;
export const BOUNCE_RING_TTL_SEC = 0.32;
/** バウンドリングの半径 cm（開始 → 終了）。 */
export const BOUNCE_RING_RADIUS: readonly [number, number] = [4, 18];
export const NET_WOBBLE_SEC = 0.36;
export const NET_WOBBLE_AMP = 1.5;
export const NET_WOBBLE_HZ = 14;
export const NET_WOBBLE_DECAY_SEC = 0.12;
export const SMASH_STREAK_SEC = 0.18;
/** 死球の保持時間と減衰時間（合計 1.25s。POINT_INTERVAL は参照しない）。 */
export const DEAD_BALL_HOLD_SEC = 0.5;
export const DEAD_BALL_FADE_SEC = 0.75;
/** 打球トーストの表示時間。 */
export const SHOT_TOAST_SEC = 0.9;
export const SHOT_TOAST_SMASH_SEC = 1.1;
/** 得点バナーの表示時間。最終得点は RESULT_DELAY_MS より前に消す。 */
export const POINT_BANNER_SEC = 1.1;
export const POINT_BANNER_FINAL_SEC = 0.95;
/** 得点・ラリーのパルス継続時間 ms。 */
export const SCORE_PULSE_MS = 420;
/** ラリー節目のパルス間隔。 */
export const RALLY_PULSE_EVERY = 5;
/** 回転色分けのしきい値。 */
export const SPIN_TINT_THRESHOLD = 0.25;
/** 接触品質ラベルの境界（ジャスト / ナイス / OK）。 */
export const CONTACT_QUALITY_LABEL_THRESHOLDS: readonly [
  number,
  number,
  number,
] = [0.9, 0.75, 0.6];
/**
 * サーブ着地帯（目安）の余白 cm。
 * short の上端と long の下端が向かい合う縁だけは、受入条件 (d) 後段
 * 「short の上端 < long の下端」を満たすため測定側で縮められる（§5.9.2）。
 */
export const SERVE_ZONE_PAD = 6;
/**
 * §5.9.2: サーブ着地帯（目安）の z 範囲。`scripts/measure-serve-zones.mjs` の
 * 実入力 envelope（player.x ±104 を8刻み × flick.vx ±7.2 の11点 × 9球種 × 3長さ）
 * 測定値を転記した確定値。単体テスト U-V8 が一致を固定する。
 * `findServeSolution()` は解けない入力で aim → 0、length → middle へ fallback するため、
 * 表示した長さと実際のサーブ長は一致しないことがある（帯は**目安**）。
 */
export const SERVE_ZONE_Z: Record<
  ServeLength,
  readonly [number, number]
> = {
  short: [10.58, 46.85],
  middle: [14.1, 108.66],
  long: [47.85, 134],
};
/** 相手の構えの傾き。描画のみで判定には影響しない。 */
export const OPPONENT_LEAN_GAIN = 0.08;
export const OPPONENT_LEAN_MAX = 6;
/**
 * 相手を描く奥行き cm。**描画専用**であり、打球判定に使う `OpponentAi.state.z`
 * （接触面 30〜178）には一切触れない。判定面をそのまま描くと、天板奥端の投影
 * （844×390 で y ≈ 107px）より下に胴・脚・サーブ待ちの球が来て天板に覆われ、
 * 頭部しか見えない。天板奥端 `HL = 137` より奥へ固定して上半身が覗くようにする。
 */
export const OPPONENT_DRAW_Z = 240;
/** 停止からの復帰直後に丸める dt の上限 s。 */
export const EFFECT_DT_MAX_SEC = 0.25;
