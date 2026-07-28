import { AI_SERVE_WEIGHTS, SERVE_TYPES } from "./config.ts";
import type { LevelId, ServeType, Side } from "./types.ts";

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

export function opponentOf(side: Side): Side {
  return side === "P" ? "A" : "P";
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
