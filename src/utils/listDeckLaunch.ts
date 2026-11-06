/**
 * Decides how to open one list in one study mode.
 * A saved per-list deck is reused. Otherwise a short list becomes the deck,
 * and a longer list goes to Deck Size before a deck is drawn.
 */
import type { Pool } from '../types/pool';
import type { StudyType, WordFrequencySetting } from '../types/state';
import type { Language, VocabItem } from '../types/vocab';
import { getListDeck, saveListDeck } from '../storage/listDecks';
import { selectSessionSubset } from '../engines/repetitionEngine';

export type SingleListLaunch =
  | {
      screen: 'direction';
      poolIds: string;
      deckSize: string;
      deckIds: string;
    }
  | {
      screen: 'deck-size';
      poolIds: string;
      totalCount: string;
    };

/** Words that can sit in this mode's deck: not paused, and nouns in Gender mode. */
export function eligibleStudyWords(pool: Pool, studyType: StudyType): VocabItem[] {
  const paused = new Set(pool.pausedWordIds ?? []);
  const words: VocabItem[] = [];
  for (const pw of pool.words) {
    if (!pw?.item?.id || paused.has(pw.item.id)) continue;
    if (studyType === 'gender') {
      if (pw.item.partOfSpeech !== 'noun' || pw.item.gender == null) continue;
    }
    words.push(pw.item);
  }
  return words;
}

function frequencySettings(pool: Pool): Record<string, WordFrequencySetting> {
  const settings: Record<string, WordFrequencySetting> = {};
  for (const pw of pool.words) {
    if (pw?.item?.id) settings[pw.item.id] = pw.frequency;
  }
  return settings;
}

/**
 * Ids from the per-list store that are still in the list and not paused.
 * Null means there is no saved deck. An empty list is a deck the user emptied.
 * A saved deck whose ids are all gone or paused counts as no saved deck.
 */
export async function loadContinuableDeck(
  pool: Pool,
  language: Language,
  studyType: StudyType,
): Promise<string[] | null> {
  try {
    const saved = await getListDeck(language, studyType, pool.id);
    if (saved === null) return null;
    const paused = new Set(pool.pausedWordIds ?? []);
    const inList = new Set(
      pool.words.map(pw => pw?.item?.id).filter((id): id is string => !!id),
    );
    const kept = saved.filter(id => inList.has(id) && !paused.has(id));
    if (saved.length > 0 && kept.length === 0) return null;
    return kept;
  } catch {
    return null;
  }
}

export function drawSizedListDeck(
  pool: Pool,
  studyType: StudyType,
  size: number,
): string[] {
  const words = eligibleStudyWords(pool, studyType);
  if (words.length === 0 || size <= 0) return [];
  return selectSessionSubset(words, size, frequencySettings(pool)).map(word => word.id);
}

export async function resolveSingleListLaunch(
  pool: Pool,
  language: Language,
  studyType: StudyType,
): Promise<SingleListLaunch> {
  const poolIds = JSON.stringify([pool.id]);
  const continued = await loadContinuableDeck(pool, language, studyType);
  if (continued !== null) {
    return {
      screen: 'direction',
      poolIds,
      deckSize: String(continued.length),
      deckIds: JSON.stringify(continued),
    };
  }

  const eligible = eligibleStudyWords(pool, studyType);
  if (eligible.length > 10) {
    return {
      screen: 'deck-size',
      poolIds,
      totalCount: String(eligible.length),
    };
  }

  const deckIds = eligible.map(word => word.id);
  if (deckIds.length > 0) {
    await saveListDeck(language, studyType, pool.id, deckIds);
  }
  return {
    screen: 'direction',
    poolIds,
    deckSize: String(deckIds.length),
    deckIds: JSON.stringify(deckIds),
  };
}
