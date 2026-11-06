/**
 * Decides how to open one list in one study mode.
 * A saved per-list deck is reused. Otherwise a short list becomes the deck.
 * A longer list uses its chosen deck size, or Deck Size when an older list has none.
 */
import { snapToDeckSize, type Pool } from '../types/pool';
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

const DECK_SIZE_STEPS = [10, 15, 20, 25] as const;

/** Size stored on a new list. Ten or fewer words keeps the count. Larger lists use the biggest step that fits. */
export function deckSizeForNewList(wordCount: number): number {
  if (wordCount <= 10) return Math.max(0, wordCount);
  return snapToDeckSize(wordCount);
}

/**
 * How many words a new deck should draw.
 * Ten or fewer eligible words uses all of them.
 * A requested size the list can no longer hold drops to the largest step that fits.
 */
export function resolveRedrawCount(requested: number, eligibleCount: number): number {
  if (eligibleCount <= 0) return 0;
  if (eligibleCount <= 10) return eligibleCount;
  const valid = DECK_SIZE_STEPS.filter(size => size <= eligibleCount);
  if (valid.length === 0) return eligibleCount;
  if ((valid as readonly number[]).includes(requested)) return requested;
  if (requested > valid[valid.length - 1]) return valid[valid.length - 1];
  const smaller = valid.filter(size => size <= requested);
  return smaller.length > 0 ? smaller[smaller.length - 1] : valid[valid.length - 1];
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
  if (eligible.length > 10 && !(pool.deckSizeChosen && pool.deckSize > 0)) {
    return {
      screen: 'deck-size',
      poolIds,
      totalCount: String(eligible.length),
    };
  }

  if (eligible.length > 10) {
    const deckIds = drawSizedListDeck(
      pool,
      studyType,
      resolveRedrawCount(pool.deckSize, eligible.length),
    );
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
