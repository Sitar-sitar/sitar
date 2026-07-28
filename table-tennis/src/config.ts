import type {
  LevelConfig,
  LevelId,
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
    pw: 1,
  },
  SMASH: {
    sp: [1360, 1520],
    spin: 0.42,
    dep: 108,
    err: 0.012,
    lab: "スマッシュ！",
    pw: 1.6,
  },
  PUSH: {
    sp: [430, 510],
    spin: -0.2,
    dep: 88,
    err: 0.015,
    lab: "押し出し",
    pw: 0.6,
  },
  CHOP: {
    sp: [395, 470],
    spin: -0.92,
    dep: 96,
    err: 0.017,
    lab: "ツッツキ",
    pw: 0.6,
  },
  LOB: {
    sp: [0, 0],
    spin: 0.35,
    dep: 118,
    err: 0.03,
    lab: "ロブ",
    pw: 0.8,
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
};

export const AI_SERVE_WEIGHTS: Record<
  LevelId,
  Readonly<Record<ServeType, number>>
> = {
  easy: {
    topspin: 45,
    backspin: 0,
    "side-left": 10,
    "side-right": 10,
    knuckle: 35,
  },
  mid: {
    topspin: 25,
    backspin: 30,
    "side-left": 15,
    "side-right": 15,
    knuckle: 15,
  },
  hard: {
    topspin: 20,
    backspin: 25,
    "side-left": 20,
    "side-right": 20,
    knuckle: 15,
  },
};

export const PADDLE_LIMIT = 104;
export const PLAYER_AIM_SPAN = 210;

export const FIXED_STEP = 1 / 240;
