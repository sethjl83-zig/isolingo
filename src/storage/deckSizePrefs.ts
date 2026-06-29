/**
 * Persistence for the per-pool-combination deck size preference.
 *
 * Key  = sorted pool IDs joined with '|'
 * Value = last-chosen PoolDeckSize for that exact combination
 *
 * This is intentionally a flat AsyncStorage record — no migration needed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PoolDeckSize } from '../types/pool';

const STORAGE_KEY = '@isolingo_deck_size_prefs';

type DeckSizePrefs = Record<string, PoolDeckSize>;

/** Stable, order-independent key for a set of pool IDs. */
export function poolComboKey(poolIds: string[]): string {
  return [...poolIds].sort().join('|');
}

async function loadAll(): Promise<DeckSizePrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeckSizePrefs) : {};
  } catch {
    return {};
  }
}

/** Returns the saved deck size for this pool combination, or null if never set. */
export async function getDeckSizePref(poolIds: string[]): Promise<PoolDeckSize | null> {
  const prefs = await loadAll();
  return prefs[poolComboKey(poolIds)] ?? null;
}

/** Persist the chosen deck size for this pool combination. */
export async function saveDeckSizePref(
  poolIds: string[],
  deckSize: PoolDeckSize,
): Promise<void> {
  try {
    const prefs = await loadAll();
    prefs[poolComboKey(poolIds)] = deckSize;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Best-effort — silently ignore storage errors
  }
}
