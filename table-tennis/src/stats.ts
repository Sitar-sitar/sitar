import type {
  LevelId,
  LevelSummary,
  MatchRecord,
  PlayerRecord,
  PlayerStats,
  ResultRecord,
} from "./types.ts";

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

export function sortPlayers(
  players: readonly PlayerRecord[],
): PlayerRecord[] {
  return players.slice().sort((left, right) => {
    const createdAtOrder = compareText(left.createdAt, right.createdAt);
    return createdAtOrder || compareText(left.id, right.id);
  });
}

export function summarize(matches: readonly MatchRecord[]): PlayerStats {
  const levels: readonly LevelId[] = ["easy", "mid", "hard"];
  const byLevel = Object.fromEntries(
    levels.map((level) => [
      level,
      { matches: 0, wins: 0 } satisfies LevelSummary,
    ]),
  ) as Record<LevelId, LevelSummary>;

  let wins = 0;
  let maxRally = 0;
  for (const match of matches) {
    byLevel[match.level].matches += 1;
    if (match.won) {
      wins += 1;
      byLevel[match.level].wins += 1;
    }
    maxRally = Math.max(maxRally, match.maxRally);
  }

  const recent = matches
    .slice()
    .sort((left, right) => {
      const playedAtOrder = compareText(right.playedAt, left.playedAt);
      return playedAtOrder || compareText(left.id, right.id);
    })
    .slice(0, 10);

  return {
    matches: matches.length,
    wins,
    losses: matches.length - wins,
    winRate: matches.length === 0 ? 0 : wins / matches.length,
    maxRally,
    byLevel,
    recent,
  };
}

export function formatRecordLabel(stats: PlayerStats): string {
  return stats.matches === 0
    ? "記録なし"
    : `${stats.wins}勝${stats.losses}敗`;
}

export function resolveResultRecord(
  current: ResultRecord | null,
  incoming: ResultRecord,
): ResultRecord {
  if (current !== null && incoming.matchSeq < current.matchSeq) {
    return current;
  }
  return incoming;
}

export function formatResultRecordText(
  record: ResultRecord | null,
  matchSeq: number,
): string {
  if (record === null || record.matchSeq !== matchSeq) {
    return "";
  }
  switch (record.status) {
    case "unavailable":
      return "この端末では戦績を保存できません";
    case "pending":
      return "戦績を保存しています…";
    case "saved":
      return record.label;
    case "failed":
      return "戦績を保存できませんでした";
  }
}
