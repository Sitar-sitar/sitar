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
  serveStage: number;
}

export interface PaddleState {
  x: number;
  tx: number;
  z: number;
  /** 描画専用の奥行き追従値。打球判定には使わない（判定は常に z）。 */
  viewZ: number;
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
  maxRally: number;
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

export interface PlayerRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface MatchRecord {
  id: string;
  playerId: string;
  playedAt: string;
  level: LevelId;
  won: boolean;
  scoreP: number;
  scoreA: number;
  maxRally: number;
  durationSec: number;
}

export interface MatchResult {
  matchSeq: number;
  playerId: string | null;
  playerName: string | null;
  level: LevelId;
  won: boolean;
  scoreP: number;
  scoreA: number;
  maxRally: number;
  startedAt: string;
  playedAt: string;
  durationSec: number;
}

export type RecordStatus =
  | "unavailable"
  | "pending"
  | "saved"
  | "failed";

export interface ResultRecord {
  matchSeq: number;
  status: RecordStatus;
  label: string;
}

export interface PlayerSelection {
  players: PlayerRecord[];
  selectedPlayerId: string | null;
}

export interface LevelSummary {
  matches: number;
  wins: number;
}

export interface PlayerStats {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  maxRally: number;
  byLevel: Record<LevelId, LevelSummary>;
  recent: MatchRecord[];
}

export type StatsPhase = "loading" | "ready" | "unavailable";
