import type { Pool } from '../types/pool';
import type { WordStatsEntry } from '../types/stats';
import { getCompetencyLevel } from '../types/stats';
import type { DailyCardCounts, LangStats } from '../storage/statsStorage';
import { formatDateKey, lastNDayKeys } from '../storage/statsStorage';

export interface PoolWordRef {
  id: string;
  lemma: string;
}

/** All unique words across every pool for a language. */
export function getPoolWords(pools: Pool[]): PoolWordRef[] {
  const seen = new Set<string>();
  const result: PoolWordRef[] = [];
  for (const pool of pools) {
    for (const pw of pool.words) {
      if (!seen.has(pw.item.id)) {
        seen.add(pw.item.id);
        result.push({ id: pw.item.id, lemma: pw.item.lemma });
      }
    }
  }
  return result;
}

export function getPoolWordIds(pools: Pool[]): Set<string> {
  return new Set(getPoolWords(pools).map(w => w.id));
}

export function countMasteredInPools(
  pools: Pool[],
  stats: LangStats,
): number {
  const ids = getPoolWordIds(pools);
  let count = 0;
  for (const id of ids) {
    const entry = stats[id];
    if (entry && entry.currentStreak >= 10) count++;
  }
  return count;
}

export function computeLanguageAccuracy(stats: LangStats): number {
  let attempts = 0;
  let firstCorrect = 0;
  for (const entry of Object.values(stats)) {
    attempts += entry.lifetimeAttempts;
    firstCorrect += entry.lifetimeFirstAttemptCorrect;
  }
  if (attempts === 0) return -1;
  return Math.round((firstCorrect / attempts) * 100);
}

export function getTodayCardCount(dailyCounts: DailyCardCounts): number {
  return dailyCounts[formatDateKey()] ?? 0;
}

export interface CompetencyCounts {
  mastered: number;
  strong: number;
  weak: number;
}

export function competencyCountsForWords(
  wordIds: Iterable<string>,
  stats: LangStats,
  emptyWhenMissing = false,
): CompetencyCounts {
  const counts: CompetencyCounts = { mastered: 0, strong: 0, weak: 0 };
  for (const id of wordIds) {
    const entry = stats[id];
    if (!entry) {
      if (emptyWhenMissing) counts.weak++;
      continue;
    }
    const level = getCompetencyLevel(entry);
    counts[level]++;
  }
  return counts;
}

export function getCurrentPoolEntries(
  poolWords: PoolWordRef[],
  stats: LangStats,
): Array<{ word: PoolWordRef; entry: WordStatsEntry | null }> {
  return poolWords
    .map(word => ({
      word,
      entry: stats[word.id] ?? null,
    }))
    .sort((a, b) => {
      const streakA = a.entry?.currentStreak ?? 0;
      const streakB = b.entry?.currentStreak ?? 0;
      if (streakB !== streakA) return streakB - streakA;
      return a.word.lemma.localeCompare(b.word.lemma);
    });
}

export interface DayBarDatum {
  dateKey: string;
  label: string;
  count: number;
}

export function last7DayBarData(dailyCounts: DailyCardCounts): DayBarDatum[] {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return lastNDayKeys(7).map(dateKey => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return {
      dateKey,
      label: dayLabels[date.getDay()],
      count: dailyCounts[dateKey] ?? 0,
    };
  });
}

export function topWordsByPersonalBest(
  stats: LangStats,
  limit: number,
): WordStatsEntry[] {
  return Object.values(stats)
    .filter(e => e.personalBestStreak > 0)
    .sort((a, b) => b.personalBestStreak - a.personalBestStreak)
    .slice(0, limit);
}

export function buildLemmaLookup(pools: Pool[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pool of pools) {
    for (const pw of pool.words) {
      map.set(pw.item.id, pw.item.lemma);
    }
  }
  return map;
}

export function formatLemma(wordId: string, lemmaLookup: Map<string, string>): string {
  return lemmaLookup.get(wordId) ?? wordId;
}
