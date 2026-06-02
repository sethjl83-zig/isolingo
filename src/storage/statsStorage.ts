import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '../types/vocab';
import type { WordStatsEntry } from '../types/stats';

export type LangStats = Record<string, WordStatsEntry>;

function storageKey(language: Language): string {
  return `@isolingo/stats_${language}`;
}

export async function loadStatsForLanguage(language: Language): Promise<LangStats> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(language));
    if (!raw) return {};
    return JSON.parse(raw) as LangStats;
  } catch {
    return {};
  }
}

export async function saveStatsForLanguage(language: Language, stats: LangStats): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(language), JSON.stringify(stats));
  } catch {
    // Non-fatal — in-memory state is still correct for this session
  }
}
