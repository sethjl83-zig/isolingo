import type { Language } from './vocab';

export interface WordStatsEntry {
  wordId: string;
  language: Language;
  /** Consecutive first-attempt correct answers. Resets on any wrong first attempt. */
  currentStreak: number;
  /** Last up to 10 results — true = first-attempt correct. */
  last10Results: boolean[];
  lifetimeAttempts: number;
  lifetimeFirstAttemptCorrect: number;
  personalBestStreak: number;
  /** Unix timestamp (ms) of the most recent Card 1006 result. */
  lastStudied: number;
}

export type CompetencyLevel = 'mastered' | 'strong' | 'weak';

/**
 * Mastered = currentStreak >= 10
 * Strong   = 7+ true values in last10Results
 * Weak     = everything else
 */
export function getCompetencyLevel(entry: WordStatsEntry): CompetencyLevel {
  if (entry.currentStreak >= 10) return 'mastered';
  if (entry.last10Results.filter(Boolean).length >= 7) return 'strong';
  return 'weak';
}

function emptyEntry(wordId: string, language: Language): WordStatsEntry {
  return {
    wordId,
    language,
    currentStreak: 0,
    last10Results: [],
    lifetimeAttempts: 0,
    lifetimeFirstAttemptCorrect: 0,
    personalBestStreak: 0,
    lastStudied: 0,
  };
}

/**
 * Compute an updated entry after one resolved Card 1006 result.
 * `isFirstAttempt` = the user answered correctly on their very first submit.
 */
export function updateWordStats(
  existing: WordStatsEntry | undefined,
  wordId: string,
  language: Language,
  correct: boolean,
  isFirstAttempt: boolean,
): WordStatsEntry {
  const base = existing ?? emptyEntry(wordId, language);
  const firstAttemptCorrect = isFirstAttempt && correct;

  const newLast10 = [...base.last10Results.slice(-9), firstAttemptCorrect];
  const newAttempts = base.lifetimeAttempts + 1;

  let newStreak: number;
  let newFirstAttemptCorrect: number;
  let newPersonalBest: number;

  if (firstAttemptCorrect) {
    newStreak = base.currentStreak + 1;
    newFirstAttemptCorrect = base.lifetimeFirstAttemptCorrect + 1;
    newPersonalBest = Math.max(base.personalBestStreak, newStreak);
  } else {
    newStreak = 0;
    newFirstAttemptCorrect = base.lifetimeFirstAttemptCorrect;
    newPersonalBest = base.personalBestStreak;
  }

  return {
    ...base,
    currentStreak: newStreak,
    last10Results: newLast10,
    lifetimeAttempts: newAttempts,
    lifetimeFirstAttemptCorrect: newFirstAttemptCorrect,
    personalBestStreak: newPersonalBest,
    lastStudied: Date.now(),
  };
}

/** @deprecated Use currentStreak — kept for migration reads only. */
export type LegacyWordStatsEntry = WordStatsEntry & {
  consecutiveFirstAttemptStreak?: number;
  last10?: boolean[];
  lifetimeTotalAttempts?: number;
  lifetimeTotalCorrect?: number;
};

export function normalizeWordStatsEntry(raw: LegacyWordStatsEntry): WordStatsEntry {
  return {
    wordId: raw.wordId,
    language: raw.language,
    currentStreak: raw.currentStreak ?? raw.consecutiveFirstAttemptStreak ?? 0,
    last10Results: raw.last10Results ?? raw.last10 ?? [],
    lifetimeAttempts: raw.lifetimeAttempts ?? raw.lifetimeTotalAttempts ?? 0,
    lifetimeFirstAttemptCorrect: raw.lifetimeFirstAttemptCorrect ?? 0,
    personalBestStreak: raw.personalBestStreak ?? 0,
    lastStudied: raw.lastStudied ?? 0,
  };
}
