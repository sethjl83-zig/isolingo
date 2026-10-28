/**
 * The word ids used in the last study session for a pool combination and study type.
 * Cleared only when the user chooses Start Fresh.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudyType } from '../types/state';
import type { Language } from '../types/vocab';
import { poolComboKey } from './deckSizePrefs';

const STORAGE_KEY = '@isolingo_saved_decks';

type SavedDecks = Record<string, string[]>;

async function loadAll(): Promise<SavedDecks> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as SavedDecks) : {};
  } catch {
    return {};
  }
}

export async function getSavedDeck(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
): Promise<string[]> {
  if (poolIds.length === 0) return [];
  const decks = await loadAll();
  const saved = decks[poolComboKey(language, studyType, poolIds)];
  if (!Array.isArray(saved)) return [];
  return saved.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function saveSavedDeck(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
  wordIds: string[],
): Promise<void> {
  if (poolIds.length === 0 || wordIds.length === 0) return;
  try {
    const decks = await loadAll();
    decks[poolComboKey(language, studyType, poolIds)] = wordIds;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Best-effort — the session can still run without a resume deck.
  }
}

export async function clearAllSavedDecks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

export async function clearSavedDeck(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
): Promise<void> {
  if (poolIds.length === 0) return;
  try {
    const decks = await loadAll();
    delete decks[poolComboKey(language, studyType, poolIds)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Best-effort.
  }
}
