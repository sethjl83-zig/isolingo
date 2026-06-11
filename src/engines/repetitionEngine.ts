import type { VocabItem } from '../types/vocab';
import type { WordStats, WordFrequencySetting } from '../types/state';
import { FREQUENCY_MULTIPLIER } from '../types/state';

export const INITIAL_WEIGHT = 10;
export const CORRECT_WEIGHT_FACTOR = 0.75;
export const INCORRECT_WEIGHT_FACTOR = 1.5;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 20;
export const REINFORCEMENT_EXPOSURE_THRESHOLD = 5;

// ── Spacing rule ──────────────────────────────────────────────────────────────

/**
 * Minimum number of OTHER unique words that must appear before a word can
 * repeat. Scales with bank size: 10→4, 15→5, 20→6, 25→7.
 */
export function getMinSpacing(bankSize: number): number {
  return Math.max(1, Math.min(bankSize - 1, Math.floor(bankSize / 5) + 2));
}

/**
 * Returns true if enough unique other words have appeared since `wordId` was
 * last seen in `recentWordIds` (most-recent entry first).
 */
export function isWordEligibleBySpacing(
  wordId: string,
  recentWordIds: string[],
  minSpacing: number,
): boolean {
  const lastIdx = recentWordIds.indexOf(wordId);
  if (lastIdx === -1) return true; // never seen this session
  const seenSince = recentWordIds.slice(0, lastIdx);
  const uniqueOthers = new Set(seenSince.filter(id => id !== wordId));
  return uniqueOthers.size >= minSpacing;
}

// ── Cycle deck ────────────────────────────────────────────────────────────────

/**
 * Builds a shuffled cycle deck: each word appears N times per cycle based on
 * its frequency setting (low=1, normal/medium=2, high=3).
 * Words with zero-multiplier (excluded) are omitted.
 */
export function buildDeck(
  bank: VocabItem[],
  frequencySettings: Record<string, WordFrequencySetting>,
): string[] {
  const entries: string[] = [];
  for (const item of bank) {
    const setting = frequencySettings[item.id] ?? 'normal';
    if (FREQUENCY_MULTIPLIER[setting] === 0) continue;
    const count = setting === 'high' ? 3 : setting === 'low' ? 1 : 2;
    for (let i = 0; i < count; i++) entries.push(item.id);
  }
  // Fisher-Yates shuffle
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return entries;
}

/**
 * Picks the first word in the deck that satisfies the spacing rule.
 * Scans forward through the deck (not just the head) to find an eligible
 * word. Falls back to the deck head if nothing qualifies.
 * Returns the selected item and the deck with that entry removed.
 */
export function selectFromDeck(
  deck: string[],
  bankById: Map<string, VocabItem>,
  recentWordIds: string[],
  minSpacing: number,
): { item: VocabItem; remainingDeck: string[] } | null {
  if (deck.length === 0) return null;

  // Try to find the first eligible entry respecting spacing
  for (let i = 0; i < deck.length; i++) {
    const id = deck[i];
    const item = bankById.get(id);
    if (!item) continue;
    if (isWordEligibleBySpacing(id, recentWordIds, minSpacing)) {
      const remainingDeck = [...deck.slice(0, i), ...deck.slice(i + 1)];
      return { item, remainingDeck };
    }
  }

  // Spacing cannot be satisfied (bank too small relative to spacing requirement)
  // — fall back to the first valid entry in the deck regardless
  for (let i = 0; i < deck.length; i++) {
    const item = bankById.get(deck[i]);
    if (item) {
      const remainingDeck = [...deck.slice(0, i), ...deck.slice(i + 1)];
      return { item, remainingDeck };
    }
  }

  return null;
}

// ── Per-word stats lifecycle ──────────────────────────────────────────────────

export function initWordStats(vocabId: string): WordStats {
  return {
    vocabId,
    exposureCount: 0,
    errorCount: 0,
    frequencyWeight: INITIAL_WEIGHT,
    lastSeenIndex: -999,
    status: 'NEW',
  };
}

export function getOrInitStats(
  stats: Record<string, WordStats>,
  vocabId: string,
): WordStats {
  return stats[vocabId] ?? initWordStats(vocabId);
}

export function updateStatsAfterCard(
  stats: WordStats,
  correct: boolean,
  sessionCardIndex: number,
): WordStats {
  const newExposure = stats.exposureCount + 1;
  const newErrors = correct ? stats.errorCount : stats.errorCount + 1;

  let newWeight = correct
    ? Math.max(MIN_WEIGHT, stats.frequencyWeight * CORRECT_WEIGHT_FACTOR)
    : Math.min(MAX_WEIGHT, stats.frequencyWeight * INCORRECT_WEIGHT_FACTOR);

  let newStatus: WordStats['status'] = stats.status;
  if (correct && newExposure >= REINFORCEMENT_EXPOSURE_THRESHOLD) {
    newStatus = 'REINFORCEMENT';
    newWeight = Math.max(MIN_WEIGHT, newWeight * 0.5);
  } else if (stats.status === 'NEW') {
    newStatus = 'ACTIVE';
  }

  return {
    ...stats,
    exposureCount: newExposure,
    errorCount: newErrors,
    frequencyWeight: newWeight,
    lastSeenIndex: sessionCardIndex,
    status: newStatus,
  };
}

// ── Fallback word selection (Card1001 / Card1002 multi-word paths) ─────────────

/**
 * Weighted random selection with spacing rule applied.
 * Used for Card1001/Card1002 where multi-word selection is handled externally.
 * Pass `recentWordIds` (most-recent first) for spacing enforcement.
 */
export function selectWord(
  eligible: VocabItem[],
  stats: Record<string, WordStats>,
  sessionCardIndex: number,
  frequencySettings: Record<string, WordFrequencySetting> = {},
  recentWordIds?: string[],
): VocabItem | null {
  if (eligible.length === 0) return null;

  const studyEligible = eligible.filter(item => {
    const setting = frequencySettings[item.id] ?? 'normal';
    return FREQUENCY_MULTIPLIER[setting] > 0;
  });

  const pool = studyEligible.length > 0 ? studyEligible : eligible;
  const minSpacing = getMinSpacing(pool.length);

  let candidates: VocabItem[];
  if (recentWordIds && recentWordIds.length > 0) {
    const spacingEligible = pool.filter(item =>
      isWordEligibleBySpacing(item.id, recentWordIds, minSpacing),
    );
    candidates = spacingEligible.length > 0 ? spacingEligible : pool;
  } else {
    const notRecent = pool.filter(item => {
      const s = stats[item.id];
      if (!s) return true;
      return sessionCardIndex - s.lastSeenIndex >= Math.min(minSpacing, pool.length - 1);
    });
    candidates = notRecent.length > 0 ? notRecent : pool;
  }

  // Accuracy-adaptive weighting
  const weights = candidates.map(item => {
    const s = stats[item.id];
    return s ? s.frequencyWeight : INITIAL_WEIGHT;
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  let rand = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
