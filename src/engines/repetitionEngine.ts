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
 * Picks the best word from the deck using a three-pass priority system:
 *
 * Pass 1 — Prefer words NEVER seen this session.
 *   This guarantees all bank words are introduced before any word repeats,
 *   eliminating the "cycling same few words before incorporating others" bug.
 *
 * Pass 2 — Words that satisfy the spacing rule (seen before, but enough
 *   unique other words have appeared in between).
 *
 * Pass 3 — Fallback when spacing cannot be satisfied (tiny bank). Picks
 *   the first valid entry regardless of recency.
 *
 * Returns the selected item and the deck with that entry removed.
 */
export function selectFromDeck(
  deck: string[],
  bankById: Map<string, VocabItem>,
  recentWordIds: string[],
  minSpacing: number,
): { item: VocabItem; remainingDeck: string[] } | null {
  if (deck.length === 0) return null;

  const seenIds = new Set(recentWordIds);

  function pick(i: number) {
    return {
      item: bankById.get(deck[i])!,
      remainingDeck: [...deck.slice(0, i), ...deck.slice(i + 1)],
    };
  }

  // Pass 1: words not yet seen this session
  for (let i = 0; i < deck.length; i++) {
    if (!seenIds.has(deck[i]) && bankById.has(deck[i])) return pick(i);
  }

  // Pass 2: spacing-eligible repeats
  for (let i = 0; i < deck.length; i++) {
    if (!bankById.has(deck[i])) continue;
    if (isWordEligibleBySpacing(deck[i], recentWordIds, minSpacing)) return pick(i);
  }

  // Pass 3: forced fallback — pick the least-recently-seen eligible word so the
  // user sees the word they practised longest ago rather than the first arbitrary
  // entry in the shuffled deck order.
  let lruIdx = -1;
  let lruScore = -1; // higher = seen longer ago = better candidate
  for (let i = 0; i < deck.length; i++) {
    if (!bankById.has(deck[i])) continue;
    const pos = recentWordIds.indexOf(deck[i]);
    // pos === -1 means beyond the tracked window — treat as maximally old
    const score = pos === -1 ? Number.MAX_SAFE_INTEGER : pos;
    if (score > lruScore) {
      lruScore = score;
      lruIdx = i;
    }
  }
  if (lruIdx >= 0) return pick(lruIdx);

  return null;
}

// ── Session word subset selection ────────────────────────────────────────────

/**
 * Select a frequency-weighted random subset of `count` words from `bank`.
 *
 * Uses the same multiplier logic as buildDeck (low=1x, normal=2x, high=3x) so
 * higher-priority words are more likely to land in the session deck. Because
 * buildDeck Fisher-Yates-shuffles before returning, each call produces a
 * different but frequency-biased ordering; the first `count` unique IDs are
 * the selected words.
 *
 * When bank.length ≤ count, the full bank is returned in shuffled order.
 * Call this exactly once at session start to produce the fixed active bank.
 */
export function selectSessionSubset(
  bank: VocabItem[],
  count: number,
  frequencySettings: Record<string, WordFrequencySetting>,
): VocabItem[] {
  if (bank.length <= count) {
    const shuffled = [...bank];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // buildDeck produces a frequency-weighted, shuffled list of IDs where
  // high-freq words appear 3×, normal 2×, low 1×. Deduplicating by taking
  // the first occurrence of each ID gives a biased random subset.
  const weightedPool = buildDeck(bank, frequencySettings);
  const bankById = new Map(bank.map(w => [w.id, w]));
  const selected = new Set<string>();
  const result: VocabItem[] = [];

  for (const id of weightedPool) {
    if (!selected.has(id) && bankById.has(id)) {
      selected.add(id);
      result.push(bankById.get(id)!);
      if (result.length >= count) break;
    }
  }

  // Safety fallback: if buildDeck's pool didn't yield enough unique IDs
  // (possible when many words are set to 'low' and the pool is sparse),
  // fill remaining slots from the un-selected words in random order.
  if (result.length < count) {
    const remaining = bank.filter(w => !selected.has(w.id));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    for (const w of remaining) {
      result.push(w);
      if (result.length >= count) break;
    }
  }

  return result;
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
    const seenIds = new Set(recentWordIds);

    // Pass 1: words not yet seen this session (mirror selectFromDeck priority)
    const unseen = pool.filter(item => !seenIds.has(item.id));
    if (unseen.length > 0) {
      candidates = unseen;
    } else {
      // Pass 2: spacing-eligible words
      const spacingEligible = pool.filter(item =>
        isWordEligibleBySpacing(item.id, recentWordIds, minSpacing),
      );
      candidates = spacingEligible.length > 0 ? spacingEligible : pool;
    }
  } else {
    // No history yet — exclude words seen very recently by session index
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
