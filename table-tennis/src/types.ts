export type Side = "P" | "A";
export type GamePhase = "title" | "serve" | "rally" | "point" | "over";
export type LevelId = "easy" | "mid" | "hard";
export type ShotId = "DRIVE" | "SMASH" | "PUSH" | "CHOP" | "LOB";
export type ServeType =
  | "topspin"
  | "backspin"
  | "side-left"
  | "side-right"
  | "knuckle";

export interface LevelConfig {
  name: string;
  delay: number;
  speed: number;
  perr: number;
  refine: number;
  smash: number;
  chop: number;
  miss: number;
  spread: number;
  reach: number;
  depth: number;
  serveErr: number;
  lob: number;
}

export interface ShotConfig {
  sp: readonly [number, number];
  spin: number;
  dep: number;
  err: number;
  lab: string;
  pw: number;
}

export interface ServeProfile {
  id: ServeType;
  label: string;
  spin: number;
  screenCurve: number;
}

export interface BallVector {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  side: number;
}

export interface BallState extends BallVector {
  live: boolean;
  hitter: Side;
  bounces: number;
  bSide: number;
  serveStage: number;
}

export interface PaddleState {
  x: number;
  tx: number;
  z: number;
  swing: number;
  swingType: number;
}

export interface AiState extends PaddleState {
  react: number;
  nextRefine: number;
  plan: { x: number; y: number } | null;
}

export interface GameState {
  phase: GamePhase;
  paused: boolean;
  level: LevelId;
  levelConfig: LevelConfig;
  scP: number;
  scA: number;
  server: Side;
  servedCount: number;
  rally: number;
  pointTimer: number;
  sound: boolean;
  vibe: boolean;
  played: number;
  selectedServeType: ServeType;
}

export interface Flick {
  vx: number;
  vy: number;
  sp: number;
  t: number;
}

export interface LandingResult {
  net: boolean;
  x: number;
  z: number;
  t: number;
  timeout?: boolean;
}

export interface ServeSolution {
  elev: number;
  azim: number;
  speed: number;
  z2: number;
  ok: boolean;
}

export interface Mark {
  x: number;
  z: number;
  t: number;
}

export interface RenderScene {
  game: GameState;
  ball: BallState;
  player: PaddleState;
  opponent: AiState;
  trail: readonly Pick<BallVector, "x" | "y" | "z">[];
  mark: Mark | null;
  smashable: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}
