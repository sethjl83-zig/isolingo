/**
 * Persistence for the per-pool-combination deck size preference.
 *
 * Key = `${language}:${studyType}:${sortedPoolIds joined with '|'}`
 * Value = last-chosen PoolDeckSize for that exact launch context
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PoolDeckSize } from '../types/pool';
import type { StudyType } from '../types/state';
import type { Language } from '../types/vocab';

const STORAGE_KEY = '@isolingo_deck_size_prefs';

const VALID_DECK_SIZES: PoolDeckSize[] = [10, 15, 20, 25];

type DeckSizePrefs = Record<string, PoolDeckSize>;

/** Stable, order-independent pool ID list. */
export function normalizePoolIds(poolIds: string[]): string[] {
  return [...new Set(poolIds.filter(Boolean))].sort();
}

/** Stable key scoped by language, study type, and pool combination. */
export function poolComboKey(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
): string {
  const ids = normalizePoolIds(poolIds);
  return `${language}:${studyType}:${ids.join('|')}`;
}

function isPoolDeckSize(value: unknown): value is PoolDeckSize {
  return typeof value === 'number' && VALID_DECK_SIZES.includes(value as PoolDeckSize);
}

async function loadAll(): Promise<DeckSizePrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeckSizePrefs) : {};
  } catch {
    return {};
  }
}

/** Returns the saved deck size for this launch context, or null if never set. */
export async function getDeckSizePref(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
): Promise<PoolDeckSize | null> {
  const ids = normalizePoolIds(poolIds);
  if (ids.length === 0) return null;

  const prefs = await loadAll();
  const saved = prefs[poolComboKey(language, studyType, ids)];
  return isPoolDeckSize(saved) ? saved : null;
}

export async function clearDeckSizePrefs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

/** Persist the chosen deck size for this launch context. */
export async function saveDeckSizePref(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
  deckSize: PoolDeckSize,
): Promise<void> {
  const ids = normalizePoolIds(poolIds);
  if (ids.length === 0) return;

  try {
    const prefs = await loadAll();
    prefs[poolComboKey(language, studyType, ids)] = deckSize;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort — silently ignore storage errors
  }
}
