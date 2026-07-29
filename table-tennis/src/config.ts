import type {
  LevelConfig,
  LevelId,
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
    sp: [810, 950],
    spin: 0.95,
    dep: 100,
    err: 0.017,
    lab: "ドライブ",
  },
  SMASH: {
    sp: [1360, 1520],
    spin: 0.42,
    dep: 108,
    err: 0.012,
    lab: "スマッシュ！",
  },
  PUSH: {
    sp: [430, 510],
    spin: -0.2,
    dep: 88,
    err: 0.015,
    lab: "押し出し",
  },
  CHOP: {
    sp: [395, 470],
    spin: -0.92,
    dep: 96,
    err: 0.017,
    lab: "ツッツキ",
  },
  LOB: {
    sp: [0, 0],
    spin: 0.35,
    dep: 118,
    err: 0.03,
    lab: "ロブ",
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
    miss: 0.11,
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
    miss: 0.08,
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
    miss: 0.02,
    spread: 1,
    reach: 33,
    depth: 100,
    serveErr: 0.016,
    lob: 0.9,
  },
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
export const MAX_SUBSTEPS = 12;
export const SWING_DECAY = 6;
export const AI_SERVE_DELAY_MS = 700;
export const SERVE_CONTACT_Y = 24;
export const CONTACT_PLANE_NEAR = 62;
export const CONTACT_PLANE_FAR = 178;
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
