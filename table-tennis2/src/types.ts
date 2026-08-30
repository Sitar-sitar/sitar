export type Side = "P" | "A";
export type GamePhase = "title" | "serve" | "rally" | "point" | "over";
export type LevelId = "easy" | "mid" | "hard";
export type ShotId =
  | "DRIVE"
  | "SMASH"
  | "PUSH"
  | "CHOP"
  | "LOB"
  | "STOP"
  | "FLICK";
export type ServeType =
  | "topspin"
  | "backspin"
  | "side-left"
  | "side-right"
  | "knuckle"
  | "topspin-left"
  | "topspin-right"
  | "backspin-left"
  | "backspin-right";
export type ServeLength = "short" | "middle" | "long";
export type ControlModel = "legacy" | "direct-paddle-v1";
export type PointerKind = "touch" | "mouse" | "pen";
export type PaddlePhase =
  | "idle"
  | "tracking"
  | "armed"
  | "contact"
  | "follow"
  | "recover";

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

export type ShotSpeed =
  /** 絶対速度を抽選する。乱数1回。 */
  | { readonly model: "absolute"; readonly sp: readonly [number, number] }
  /** 目標へ届く必要速度をそのまま使う（高い弧）。乱数0回。 */
  | { readonly model: "arc"; readonly elev: number }
  /** 必要速度に余裕率を掛ける（台上技術）。乱数1回。 */
  | {
      readonly model: "touch";
      readonly elev: number;
      readonly margin: readonly [number, number];
    };

export interface ShotConfig {
  speed: ShotSpeed;
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

export interface ServeLengthProfile {
  id: ServeLength;
  label: string;
  targetZ: number;
  distances: readonly number[];
  speedBase: number;
  speedStep: number;
  aimScale: number;
}

export interface ResolvedServe {
  solution: ServeSolution;
  serveType: ServeType;
  serveLength: ServeLength;
  aimX: number;
  spin: number;
  side: number;
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
  lastBounceZ: number | null;
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
  selectedServeLength: ServeLength;
}

export interface Flick {
  vx: number;
  vy: number;
  sp: number;
  t: number;
}

export interface PointerSample {
  clientX: number;
  clientY: number;
  stageX: number;
  stageY: number;
  time: number;
  pointerType: PointerKind;
}

export interface StrokeMetrics {
  vx: number;
  vy: number;
  speed: number;
  acceleration: number;
  directionX: number;
  directionY: number;
  pathLength: number;
  displacement: number;
  curvature: number;
  age: number;
}

export interface StrikeMetrics {
  vx: number;
  vy: number;
  speed: number;
  displacement: number;
  directionX: number;
  directionY: number;
  verticality: number;
  curvature: number;
  age: number;
  active: boolean;
}

export interface PaddlePose {
  screenX: number;
  screenY: number;
  worldX: number;
  worldZ: number;
  velocityX: number;
  velocityY: number;
  angle: number;
  tilt: number;
  pointerDown: boolean;
  phase: PaddlePhase;
  contactFlash: number;
  pointerType: PointerKind | null;
}

export interface ContactEvent {
  screenX: number;
  screenY: number;
  contactOffsetX: number;
  contactOffsetY: number;
  screenQuality: number;
  timingQuality: number;
  contactQuality: number;
  ballHeight: number;
  ballVelocityBefore: BallVector;
  strikeMetrics: StrikeMetrics;
  time: number;
}

export interface ShotIntent {
  power: number;
  aimX: number;
  depth: number;
  lift: number;
  topSpin: number;
  sideSpin: number;
  contactQuality: number;
  timingQuality: number;
  strokeCurvature: number;
  classifiedShot: ShotId;
  passive: boolean;
  isServe: false;
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

export interface PlayerContactGuide {
  x: number;
  y: number;
  z: number;
  plannedAt: number;
  etaSec: number;
}

export interface RenderScene {
  game: GameState;
  ball: BallState;
  player: PaddleState;
  opponent: AiState;
  trail: readonly Pick<BallVector, "x" | "y" | "z">[];
  mark: Mark | null;
  simulationTime: number;
  playerContactGuide: PlayerContactGuide | null;
  smashable: boolean;
  controlModel: ControlModel;
  directPlayerPose: PaddlePose | null;
  directPaddleAssist: { visible: boolean; scale: number } | null;
  debugInput: boolean;
  debugStroke: readonly Pick<PointerSample, "stageX" | "stageY">[];
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

export type StatsUnavailableReason =
  | "unsupported"
  | "open-failed"
  | "invalid-data"
  | "version-change";
