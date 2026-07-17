import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '../types/vocab';
import type { WordStatsEntry } from '../types/stats';
import { normalizeWordStatsEntry, type LegacyWordStatsEntry } from '../types/stats';

export type LangStats = Record<string, WordStatsEntry>;

export type DailyCardCounts = Record<string, number>;

function wordStatsKey(language: Language): string {
  return `@isolingo/stats_${language}`;
}

function dailyStatsKey(language: Language): string {
  return `@isolingo/stats_daily_${language}`;
}

/** Local calendar date as YYYY-MM-DD. */
export function formatDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function lastNDayKeys(days: number): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(formatDateKey(date));
  }
  return keys;
}

// ── In-memory cache (dedupes loads; kept in sync on every save) ───────────────

const wordStatsCache: Partial<Record<Language, LangStats>> = {};
const dailyCountsCache: Partial<Record<Language, DailyCardCounts>> = {};
const bundleLoadPromises: Partial<
  Record<Language, Promise<{ wordStats: LangStats; dailyCounts: DailyCardCounts }>>
> = {};

function setCache(
  language: Language,
  wordStats: LangStats,
  dailyCounts: DailyCardCounts,
): void {
  wordStatsCache[language] = wordStats;
  dailyCountsCache[language] = dailyCounts;
}

export async function loadStatsForLanguage(language: Language): Promise<LangStats> {
  try {
    const raw = await AsyncStorage.getItem(wordStatsKey(language));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LegacyWordStatsEntry>;
    const normalized: LangStats = {};
    for (const [id, entry] of Object.entries(parsed)) {
      normalized[id] = normalizeWordStatsEntry(entry);
    }
    return normalized;
  } catch (err) {
    console.warn('[statsStorage] loadStatsForLanguage failed', language, err);
    return {};
  }
}

export async function saveStatsForLanguage(language: Language, stats: LangStats): Promise<void> {
  wordStatsCache[language] = stats;
  try {
    await AsyncStorage.setItem(wordStatsKey(language), JSON.stringify(stats));
  } catch (err) {
    console.warn('[statsStorage] saveStatsForLanguage failed', language, err);
  }
}

export async function loadDailyCardCounts(language: Language): Promise<DailyCardCounts> {
  try {
    const raw = await AsyncStorage.getItem(dailyStatsKey(language));
    if (!raw) return {};
    return JSON.parse(raw) as DailyCardCounts;
  } catch (err) {
    console.warn('[statsStorage] loadDailyCardCounts failed', language, err);
    return {};
  }
}

export async function saveDailyCardCounts(
  language: Language,
  counts: DailyCardCounts,
): Promise<void> {
  dailyCountsCache[language] = counts;
  try {
    await AsyncStorage.setItem(dailyStatsKey(language), JSON.stringify(counts));
  } catch (err) {
    console.warn('[statsStorage] saveDailyCardCounts failed', language, err);
  }
}

/** Increment today's Card 1006 completion count. Returns the new today total. */
export async function incrementDailyCardCount(language: Language): Promise<number> {
  const counts = await loadDailyCardCounts(language);
  const key = formatDateKey();
  const next = (counts[key] ?? 0) + 1;
  counts[key] = next;
  await saveDailyCardCounts(language, counts);
  return next;
}

export function incrementDailyCardCountInMemory(
  counts: DailyCardCounts,
  date: Date = new Date(),
): DailyCardCounts {
  const key = formatDateKey(date);
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

export async function loadLanguageStatsBundle(language: Language): Promise<{
  wordStats: LangStats;
  dailyCounts: DailyCardCounts;
}> {
  const [wordStats, dailyCounts] = await Promise.all([
    loadStatsForLanguage(language),
    loadDailyCardCounts(language),
  ]);
  setCache(language, wordStats, dailyCounts);
  return { wordStats, dailyCounts };
}

/**
 * Load stats from AsyncStorage once per language (shared promise).
 * Safe to call from app init and session start — concurrent callers await the same load.
 */
export function ensureLanguageStatsLoaded(language: Language): Promise<{
  wordStats: LangStats;
  dailyCounts: DailyCardCounts;
}> {
  const cachedWordStats = wordStatsCache[language];
  const cachedDaily = dailyCountsCache[language];
  if (cachedWordStats !== undefined && cachedDaily !== undefined) {
    return Promise.resolve({ wordStats: cachedWordStats, dailyCounts: cachedDaily });
  }

  if (!bundleLoadPromises[language]) {
    bundleLoadPromises[language] = loadLanguageStatsBundle(language).finally(() => {
      delete bundleLoadPromises[language];
    });
  }

  return bundleLoadPromises[language]!;
}

/** Preload stats for the active language during app startup. */
export function preloadLanguageStats(language: Language | null): void {
  if (language) {
    void ensureLanguageStatsLoaded(language);
  }
}

/**
 * Persist word stats + daily counts after a Card 1006 result.
 * Always await this before starting the next save for the same language.
 */
export async function saveWordStats(
  language: Language,
  wordStats: LangStats,
  dailyCounts: DailyCardCounts,
): Promise<void> {
  setCache(language, wordStats, dailyCounts);
  await Promise.all([
    saveStatsForLanguage(language, wordStats),
    saveDailyCardCounts(language, dailyCounts),
  ]);
}

/** Dev-only: verify stats keys are not cleared by resetApp (they live separately). */
export const STATS_STORAGE_KEYS = {
  wordStats: wordStatsKey,
  dailyStats: dailyStatsKey,
} as const;
