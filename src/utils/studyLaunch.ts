import type { Pool, PoolDeckSize } from '../types/pool';
import type { StudyType } from '../types/state';
import type { Language } from '../types/vocab';
import { getDeckSizePref } from '../storage/deckSizePrefs';

/** Minimum words required before the deck-size picker is shown. */
export const MIN_DECK_SIZE_PICKER_COUNT = 10;

/** Count words available for the given study type across the selected pools. */
export function countStudyWords(pools: Pool[], studyType: StudyType): number {
  return pools.reduce((sum, pool) => {
    if (studyType === 'gender') {
      return (
        sum +
        pool.words.filter(
          pw => pw.item.partOfSpeech === 'noun' && pw.item.gender !== null,
        ).length
      );
    }
    return sum + pool.words.length;
  }, 0);
}

export interface DeckSizeLaunchDecision {
  /** When true, navigate to /deck-size before direction select. */
  showDeckSizePicker: boolean;
  /** Deck size to pass to /direction when the picker is skipped. */
  deckSize: PoolDeckSize | null;
}

/**
 * Decide whether to show the deck-size screen or reuse a saved preference.
 * Saved prefs are ignored when the pool has fewer than 10 eligible words or
 * when the saved size no longer fits the current word count.
 */
export function resolveDeckSizeForLaunch(
  saved: PoolDeckSize | null,
  totalCount: number,
): DeckSizeLaunchDecision {
  if (totalCount < MIN_DECK_SIZE_PICKER_COUNT) {
    return { showDeckSizePicker: false, deckSize: null };
  }

  if (saved !== null && saved <= totalCount) {
    return { showDeckSizePicker: false, deckSize: saved };
  }

  return { showDeckSizePicker: true, deckSize: null };
}

export async function getDeckSizeLaunchDecision(
  language: Language,
  studyType: StudyType,
  poolIds: string[],
  totalCount: number,
): Promise<DeckSizeLaunchDecision> {
  const saved = await getDeckSizePref(language, studyType, poolIds);
  return resolveDeckSizeForLaunch(saved, totalCount);
}

/** Parse poolIds navigation params from expo-router (string JSON or string[]). */
export function parsePoolIdsParam(
  poolIdsParam: string | string[] | undefined,
): string[] {
  if (!poolIdsParam) return [];
  if (Array.isArray(poolIdsParam)) {
    return poolIdsParam.filter(Boolean);
  }
  try {
    const parsed = JSON.parse(poolIdsParam) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
  } catch {
    // Fall through to single-ID handling
  }
  return poolIdsParam.length > 0 ? [poolIdsParam] : [];
}
