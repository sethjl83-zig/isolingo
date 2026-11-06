/**
 * Saved deck for one list and one study mode.
 * Launch reads this store. The older combination store is still written, not read.
 *
 * AsyncStorage key: @isolingo_list_decks
 * Entry key: `${language}:${listId}:${studyType}` — one list id, never a combination.
 * This is not the combination key (`${language}:${studyType}:${poolIds joined by |}`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pool } from '../types/pool';
import type { StudyType } from '../types/state';
import type { Language } from '../types/vocab';

const STORAGE_KEY = '@isolingo_list_decks';
const OLD_SAVED_DECKS_KEY = '@isolingo_saved_decks';

type ListDecks = Record<string, string[]>;
type LanguagePools = Partial<Record<Language, Pool[]>>;

const LANGUAGES: readonly Language[] = ['de', 'fr', 'es'];
const STUDY_TYPES: readonly StudyType[] = ['general_vocab', 'gender'];

export function listDeckKey(
  language: Language,
  studyType: StudyType,
  listId: string,
): string {
  return `${language}:${listId}:${studyType}`;
}

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

function isStudyType(value: string): value is StudyType {
  return (STUDY_TYPES as readonly string[]).includes(value);
}

/** Old combination keys look like `de:general_vocab:pool_a` or `de:gender:pool_a|pool_b`. */
function parseSingleListComboKey(
  key: string,
): { language: Language; studyType: StudyType; listId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  const [language, studyType, listId] = parts;
  if (!isLanguage(language) || !isStudyType(studyType)) return null;
  if (!listId || listId.includes('|')) return null;
  return { language, studyType, listId };
}

function wordIdsInList(
  languagePools: LanguagePools,
  language: Language,
  listId: string,
): Set<string> {
  const pool = languagePools[language]?.find(item => item?.id === listId);
  const ids = new Set<string>();
  if (!pool || !Array.isArray(pool.words)) return ids;
  for (const word of pool.words) {
    const id = word?.item?.id;
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  return ids;
}

function wordIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function loadAll(): Promise<ListDecks> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const decks: ListDecks = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      decks[key] = wordIdList(value);
    }
    return decks;
  } catch {
    return {};
  }
}

let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Saved word ids, or null when this list and mode has no saved deck. */
export async function getListDeck(
  language: Language,
  studyType: StudyType,
  listId: string,
): Promise<string[] | null> {
  if (!listId) return null;
  try {
    const decks = await loadAll();
    const key = listDeckKey(language, studyType, listId);
    return Object.prototype.hasOwnProperty.call(decks, key) ? decks[key] : null;
  } catch {
    return null;
  }
}

export async function saveListDeck(
  language: Language,
  studyType: StudyType,
  listId: string,
  wordIds: string[],
): Promise<void> {
  if (!listId) return;
  const ids = wordIds.filter(id => typeof id === 'string' && id.length > 0);
  try {
    await enqueueWrite(async () => {
      const decks = await loadAll();
      decks[listDeckKey(language, studyType, listId)] = ids;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    });
  } catch {
    // Best-effort. A failed read or save is treated as no saved deck.
  }
}

export async function clearAllListDecks(): Promise<void> {
  try {
    await enqueueWrite(() => AsyncStorage.removeItem(STORAGE_KEY));
  } catch {
    // Best-effort.
  }
}

/**
 * Copy single-list entries from @isolingo_saved_decks into this store.
 * Multi-list keys are skipped. The old store is not written.
 * An entry that already exists here is left as it is.
 * Word ids that are no longer in the list are dropped.
 */
export async function migrateSingleListDecks(
  languagePools: LanguagePools,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OLD_SAVED_DECKS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

    const existing = await loadAll();
    let changed = false;
    const next: ListDecks = { ...existing };

    for (const [key, value] of Object.entries(parsed)) {
      const single = parseSingleListComboKey(key);
      if (!single) continue;
      const destKey = listDeckKey(single.language, single.studyType, single.listId);
      if (next[destKey]) continue;
      const liveIds = wordIdsInList(languagePools, single.language, single.listId);
      const kept = wordIdList(value).filter(id => liveIds.has(id));
      if (kept.length === 0) continue;
      next[destKey] = kept;
      changed = true;
    }

    if (changed) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Best-effort. A failed copy leaves both stores as they were.
  }
}
