import type { VocabItem } from '../types/vocab';
import type { WordStats, WordFrequencySetting, WordStatus } from '../types/state';
import { FREQUENCY_MULTIPLIER } from '../types/state';

export const INITIAL_WEIGHT = 10;
export const CORRECT_WEIGHT_FACTOR = 0.75;
export const INCORRECT_WEIGHT_FACTOR = 1.5;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 20;
export const REINFORCEMENT_EXPOSURE_THRESHOLD = 5;
export const MIN_CARDS_BETWEEN_REPEATS = 2;

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

  let newStatus: WordStatus = stats.status;
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

// ── Word selection ────────────────────────────────────────────────────────────

/**
 * Selects the next word using weighted random sampling.
 * Avoids words seen within MIN_CARDS_BETWEEN_REPEATS.
 */
export function selectWord(
  eligible: VocabItem[],
  stats: Record<string, WordStats>,
  sessionCardIndex: number,
  frequencySettings: Record<string, WordFrequencySetting> = {},
): VocabItem | null {
  if (eligible.length === 0) return null;

  const studyEligible = eligible.filter(item => {
    const setting = frequencySettings[item.id] ?? 'normal';
    return FREQUENCY_MULTIPLIER[setting] > 0;
  });

  const pool = studyEligible.length > 0 ? studyEligible : eligible;

  const notRecent = pool.filter(item => {
    const s = stats[item.id];
    if (!s) return true;
    return sessionCardIndex - s.lastSeenIndex >= MIN_CARDS_BETWEEN_REPEATS;
  });

  const candidates = notRecent.length > 0 ? notRecent : pool;

  const weights = candidates.map(item => {
    const s = stats[item.id];
    const baseWeight = s ? s.frequencyWeight : INITIAL_WEIGHT;
    const setting = frequencySettings[item.id] ?? 'normal';
    return baseWeight * FREQUENCY_MULTIPLIER[setting];
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return candidates[0] ?? null;

  let rand = Math.random() * total;

  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}
