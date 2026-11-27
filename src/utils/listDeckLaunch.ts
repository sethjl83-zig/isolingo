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

/** Sizes the Direction "New Deck" sheet can offer. Empty when the list has 10 or fewer eligible words. */
export function deckSizeChoices(eligibleCount: number): number[] {
  if (eligibleCount <= 10) return [];
  return DECK_SIZE_STEPS.filter(size => size <= eligibleCount);
}

function shuffleIds(ids: readonly string[]): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A drawn deck with excluded ids swapped for other eligible words.
 * Excluded ids fill only the slots that cannot be filled any other way.
 */
export function redrawDeckAvoiding(
  drawn: readonly string[],
  eligibleIds: readonly string[],
  excluded: ReadonlySet<string>,
  size: number,
): string[] {
  if (size <= 0) return [];
  const eligibleSet = new Set(eligibleIds);
  const kept: string[] = [];
  const seen = new Set<string>();
  const held: string[] = [];
  for (const id of drawn) {
    if (!eligibleSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    if (excluded.has(id)) held.push(id);
    else kept.push(id);
  }
  for (const id of shuffleIds(eligibleIds.filter(id => !seen.has(id) && !excluded.has(id)))) {
    if (kept.length >= size) break;
    kept.push(id);
    seen.add(id);
  }
  if (kept.length < size) {
    const fillers = [
      ...held,
      ...eligibleIds.filter(id => excluded.has(id) && !seen.has(id)),
    ];
    for (const id of fillers) {
      if (kept.length >= size) break;
      kept.push(id);
      seen.add(id);
    }
  }
  return kept.slice(0, size);
}

const DECK_MODES: readonly StudyType[] = ['gender', 'general_vocab'];

/**
 * Bring both saved decks in line with the list. Does not read or write session state.
 * A missing deck is left missing. A deck longer than the list's chosen size is not cut down.
 */
export async function syncListDecks(language: Language, pool: Pool): Promise<void> {
  try {
    for (const studyType of DECK_MODES) {
      const saved = await getListDeck(language, studyType, pool.id);
      if (saved === null) continue;
      const eligible = eligibleStudyWords(pool, studyType);
      if (eligible.length <= 10) {
        await saveListDeck(
          language,
          studyType,
          pool.id,
          eligible.map(word => word.id),
        );
        continue;
      }
      const eligibleIds = new Set(eligible.map(word => word.id));
      const kept = saved.filter(id => eligibleIds.has(id));
      await saveListDeck(language, studyType, pool.id, kept);
    }
  } catch {
    // A failed read or save leaves the stored decks as they were.
  }
}

const ADDED_TO_DECK = 'Added to your list and your deck.';
const ADDED_WAITING =
  'Added to your list. It will appear in your deck the next time you tap New Deck.';

let pendingAddedNote: string | null = null;

/** Note for the screen the user returns to after adding words. */
export function queueAddedWordsNote(pools: Pool[]): void {
  const longer = pools.some(pool =>
    DECK_MODES.some(mode => eligibleStudyWords(pool, mode).length > 10),
  );
  pendingAddedNote = longer ? ADDED_WAITING : ADDED_TO_DECK;
}

export function takeAddedWordsNote(): string | null {
  const note = pendingAddedNote;
  pendingAddedNote = null;
  return note;
}

export async function resolveSingleListLaunch(
  pool: Pool,
  language: Language,
  studyType: StudyType,
): Promise<SingleListLaunch> {
  const poolIds = JSON.stringify([pool.id]);
  await syncListDecks(language, pool);
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
