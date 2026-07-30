import {
  AI_SERVE_LENGTH_WEIGHTS,
  AI_SERVE_WEIGHTS,
  LOB_MAX_Y,
  SERVE_LENGTHS,
  SERVE_TYPES,
  SHORT_BALL_MAX_Y,
  SHORT_BOUNCE_Z,
  SMASH_MIN_Y,
} from "./config.ts";
import type {
  Flick,
  LevelId,
  ServeLength,
  ServeType,
  ShotId,
  Side,
} from "./types.ts";

export function swingTypeOf(shot: ShotId): number {
  switch (shot) {
    case "DRIVE":
    case "SMASH":
    case "FLICK":
      return 1;
    case "CHOP":
    case "STOP":
      return -1;
    case "PUSH":
    case "LOB":
      return 0;
  }
}

export function isShortBall(
  lastBounceZ: number | null,
  ballY: number,
  receiver: Side,
): boolean {
  if (lastBounceZ === null) {
    return false;
  }
  const bouncedOnReceiverSide =
    receiver === "P" ? lastBounceZ < 0 : lastBounceZ > 0;
  return (
    bouncedOnReceiverSide &&
    Math.abs(lastBounceZ) <= SHORT_BOUNCE_Z &&
    ballY <= SHORT_BALL_MAX_Y
  );
}

export function classifyPlayerShot(input: {
  flick: Flick | null;
  ballY: number;
  short: boolean;
}): ShotId {
  const { flick, ballY, short } = input;
  if (!flick) {
    return "PUSH";
  }

  const upward = -flick.vy;
  const downward = flick.vy;
  if (short) {
    if (downward > 0.42 * flick.sp) {
      return "STOP";
    }
    if (upward > 0.42 * flick.sp) {
      return "FLICK";
    }
    return "PUSH";
  }

  if (upward > 0.42 * flick.sp) {
    if (ballY < LOB_MAX_Y) {
      return "LOB";
    }
    if (flick.sp > 3 && ballY > SMASH_MIN_Y) {
      return "SMASH";
    }
    return "DRIVE";
  }
  if (downward > 0.42 * flick.sp) {
    return "CHOP";
  }
  return "PUSH";
}

export function chooseWeightedServe(
  level: LevelId,
  random: () => number,
): ServeType {
  const weights = AI_SERVE_WEIGHTS[level];
  const total = SERVE_TYPES.reduce(
    (sum, serveType) => sum + weights[serveType],
    0,
  );
  let cursor = Math.min(0.999999999, Math.max(0, random())) * total;
  for (const serveType of SERVE_TYPES) {
    cursor -= weights[serveType];
    if (cursor < 0) {
      return serveType;
    }
  }
  return "knuckle";
}

export function chooseServeLength(
  level: LevelId,
  random: () => number,
): ServeLength {
  const weights = AI_SERVE_LENGTH_WEIGHTS[level];
  const total = SERVE_LENGTHS.reduce(
    (sum, serveLength) => sum + weights[serveLength],
    0,
  );
  let cursor = Math.min(0.999999999, Math.max(0, random())) * total;
  for (const serveLength of SERVE_LENGTHS) {
    cursor -= weights[serveLength];
    if (cursor < 0) {
      return serveLength;
    }
  }
  return "middle";
}

export function opponentOf(side: Side): Side {
  return side === "P" ? "A" : "P";
}

export function resolveMiss(
  bounces: number,
  hitter: Side,
): { winner: Side; reason: string } {
  return bounces >= 1
    ? { winner: hitter, reason: "返せず" }
    : { winner: opponentOf(hitter), reason: "アウト" };
}

export function rotateServerAfterPoint(
  server: Side,
  servedCount: number,
  playerScore: number,
  opponentScore: number,
): { server: Side; servedCount: number } {
  const nextCount = servedCount + 1;
  const deuce = playerScore >= 10 && opponentScore >= 10;
  const limit = deuce ? 1 : 2;
  if (nextCount < limit) {
    return { server, servedCount: nextCount };
  }
  return {
    server: opponentOf(server),
    servedCount: 0,
  };
}

export function isGameOver(
  playerScore: number,
  opponentScore: number,
): boolean {
  const high = Math.max(playerScore, opponentScore);
  const low = Math.min(playerScore, opponentScore);
  return high >= 11 && high - low >= 2;
}
