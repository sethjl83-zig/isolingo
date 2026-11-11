/**
 * One-time translation of stored word ids after the vocab files were renamed
 * and merged. Runs after saved state loads and before screens read it.
 * Safe to run again: ids that are already current are left as they are.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMasterDataset } from '../data';
import { translateWordId } from '../data/idMap';
import type { Pool, PoolWord } from '../types/pool';
import type { Language, VocabItem } from '../types/vocab';
import { normalizeWordStatsEntry, type WordStatsEntry } from '../types/stats';
import { savePersistedState, type StoredState } from './persistedState';

const FLAG_KEY = '@isolingo_id_migration_v1';
const SAVED_DECKS_KEY = '@isolingo_saved_decks';
const LIST_DECKS_KEY = '@isolingo_list_decks';
const LANGUAGES: readonly Language[] = ['de', 'fr', 'es'];

function wordStatsKey(language: Language): string {
  return `@isolingo/stats_${language}`;
}

function translateDeckIds(ids: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    try {
      if (typeof id !== 'string' || id.length === 0) continue;
      const next = translateWordId(id);
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    } catch {
      // One bad id is skipped. The rest of the deck is kept.
    }
  }
  return out;
}

function refreshedItem(item: VocabItem, language: Language, newId: string): VocabItem {
  const fresh = getMasterDataset(language).find(word => word.id === newId);
  if (fresh) {
    return item.user_added === 'y' ? { ...fresh, user_added: 'y' } : fresh;
  }
  const copy: VocabItem = { ...item, id: newId };
  if (typeof copy.genderedCounterpart === 'string') {
    copy.genderedCounterpart = translateWordId(copy.genderedCounterpart);
  }
  return copy;
}

/**
 * Translate a list's words. A merge that lands on a word already in the list
 * keeps that surviving word's frequency. Otherwise the old word's frequency stays.
 */
function collapsePoolWords(pool: Pool): PoolWord[] {
  const language = pool.language;
  const words: PoolWord[] = [];
  const keptIndex = new Map<string, number>();
  const survivorFrequency = new Map<string, boolean>();

  for (const word of pool.words ?? []) {
    try {
      const oldId = word?.item?.id;
      if (!word?.item || typeof oldId !== 'string' || oldId.length === 0) {
        words.push(word);
        continue;
      }
      const newId = translateWordId(oldId);
      const nextWord: PoolWord = {
        item: refreshedItem(word.item, language, newId),
        frequency: word.frequency,
      };
      const existing = keptIndex.get(newId);
      if (existing === undefined) {
        keptIndex.set(newId, words.length);
        survivorFrequency.set(newId, oldId === newId);
        words.push(nextWord);
        continue;
      }
      if (oldId === newId && !survivorFrequency.get(newId)) {
        words[existing] = nextWord;
        survivorFrequency.set(newId, true);
      }
    } catch {
      try {
        words.push(word);
      } catch {
        // Ignore a word that cannot be kept or translated.
      }
    }
  }

  return words;
}

function migratePool(pool: Pool): Pool {
  if (!pool || !Array.isArray(pool.words)) return pool;
  return {
    ...pool,
    words: collapsePoolWords(pool),
    pausedWordIds: Array.isArray(pool.pausedWordIds)
      ? translateDeckIds(pool.pausedWordIds)
      : pool.pausedWordIds,
  };
}

function migratePools(stored: StoredState): StoredState {
  const languagePools: StoredState['languagePools'] = { ...stored.languagePools };
  for (const language of LANGUAGES) {
    const pools = stored.languagePools?.[language];
    if (!Array.isArray(pools)) continue;
    const next: Pool[] = [];
    for (const pool of pools) {
      try {
        next.push(migratePool(pool));
      } catch {
        next.push(pool);
      }
    }
    languagePools[language] = next;
  }
  return { ...stored, languagePools };
}

function mergeStats(
  kept: WordStatsEntry,
  incoming: WordStatsEntry,
  newId: string,
  incomingIsSurvivor: boolean,
): WordStatsEntry {
  const later = incoming.lastStudied > kept.lastStudied
    ? incoming
    : kept.lastStudied > incoming.lastStudied
      ? kept
      : incomingIsSurvivor
        ? incoming
        : kept;
  return {
    wordId: newId,
    language: later.language,
    currentStreak: later.currentStreak,
    last10Results: later.last10Results,
    lifetimeAttempts: (kept.lifetimeAttempts || 0) + (incoming.lifetimeAttempts || 0),
    lifetimeFirstAttemptCorrect:
      (kept.lifetimeFirstAttemptCorrect || 0) + (incoming.lifetimeFirstAttemptCorrect || 0),
    personalBestStreak: Math.max(kept.personalBestStreak || 0, incoming.personalBestStreak || 0),
    lastStudied: Math.max(kept.lastStudied || 0, incoming.lastStudied || 0),
  };
}

async function migrateStats(): Promise<boolean> {
  let ok = true;
  for (const language of LANGUAGES) {
    try {
      const raw = await AsyncStorage.getItem(wordStatsKey(language));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const next: Record<string, WordStatsEntry> = {};
      for (const [key, value] of Object.entries(parsed)) {
        try {
          const entry = normalizeWordStatsEntry(value as WordStatsEntry);
          const fromKey = translateWordId(key);
          const fromField = typeof entry.wordId === 'string' ? translateWordId(entry.wordId) : fromKey;
          const newId = fromKey !== key ? fromKey : fromField;
          const incoming: WordStatsEntry = { ...entry, wordId: newId };
          const incomingIsSurvivor = key === newId || entry.wordId === newId;
          const existing = next[newId];
          next[newId] = existing
            ? mergeStats(existing, incoming, newId, incomingIsSurvivor)
            : incoming;
        } catch {
          try {
            const keptKey = translateWordId(key);
            if (!(keptKey in next)) next[keptKey] = value as WordStatsEntry;
          } catch {
            // One unreadable entry is skipped. The rest of the language continues.
          }
        }
      }
      await AsyncStorage.setItem(wordStatsKey(language), JSON.stringify(next));
    } catch {
      ok = false;
    }
  }
  return ok;
}

async function migrateDeckStore(storageKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return true;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      try {
        next[key] = Array.isArray(value) ? translateDeckIds(value) : value;
      } catch {
        next[key] = value;
      }
    }
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * Translate stored word ids once. Returns the state screens should hydrate.
 * The flag is written only after the pass finishes.
 */
export async function runIdMigration(stored: StoredState | null): Promise<StoredState | null> {
  try {
    const flag = await AsyncStorage.getItem(FLAG_KEY);
    if (flag === '1') return stored;
  } catch {
    return stored;
  }

  let next = stored;
  let finished = true;

  if (stored) {
    try {
      next = migratePools(stored);
      await savePersistedState({
        selectedLanguage: next.selectedLanguage,
        directionMode: next.directionMode,
        onboardingComplete: true,
        languagePools: next.languagePools,
        defaultPoolIds: next.defaultPoolIds,
      });
    } catch {
      finished = false;
    }
  }

  if (!(await migrateStats())) finished = false;
  if (!(await migrateDeckStore(SAVED_DECKS_KEY))) finished = false;
  if (!(await migrateDeckStore(LIST_DECKS_KEY))) finished = false;

  if (finished) {
    try {
      await AsyncStorage.setItem(FLAG_KEY, '1');
    } catch {
      // The next launch runs the same pass again. It is safe to repeat.
    }
  }

  return next;
}
