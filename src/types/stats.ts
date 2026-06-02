import type { Language } from './vocab';

export interface WordStatsEntry {
  wordId: string;
  language: Language;
  /** Current consecutive first-attempt correct streak. Resets when word is removed+re-added or on any non-first-attempt-correct result. */
  consecutiveFirstAttemptStreak: number;
  /** Last 10 resolved card results — true = correct on any attempt. */
  last10: boolean[];
  /** Total cards resolved (each card counts once regardless of attempt count). */
  lifetimeTotalAttempts: number;
  /** Cards answered correctly on the very first attempt, lifetime. */
  lifetimeFirstAttemptCorrect: number;
  /** Cards answered correctly on any attempt, lifetime. */
  lifetimeTotalCorrect: number;
  /** All-time best consecutive first-attempt streak. */
  personalBestStreak: number;
}

export type CompetencyLevel = 'mastered' | 'strong' | 'weak';

/**
 * Mastered = 10+ consecutive first-attempt correct.
 * Strong   = 7+ correct (any attempt) in last 10.
 * Weak     = everything else.
 */
export function getCompetencyLevel(entry: WordStatsEntry): CompetencyLevel {
  if (entry.consecutiveFirstAttemptStreak >= 10) return 'mastered';
  const correctInLast10 = entry.last10.filter(Boolean).length;
  if (entry.last10.length >= 10 && correctInLast10 >= 7) return 'strong';
  return 'weak';
}

/** Return a fresh zeroed entry for a word that has never been studied. */
function emptyEntry(wordId: string, language: Language): WordStatsEntry {
  return {
    wordId,
    language,
    consecutiveFirstAttemptStreak: 0,
    last10: [],
    lifetimeTotalAttempts: 0,
    lifetimeFirstAttemptCorrect: 0,
    lifetimeTotalCorrect: 0,
    personalBestStreak: 0,
  };
}

/**
 * Compute an updated entry after one resolved card result.
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

  const newLast10 = [...base.last10.slice(-9), correct];
  const newTotalAttempts = base.lifetimeTotalAttempts + 1;
  const newTotalCorrect = base.lifetimeTotalCorrect + (correct ? 1 : 0);

  let newStreak: number;
  let newFirstAttemptCorrect: number;
  let newPersonalBest: number;

  if (isFirstAttempt && correct) {
    newStreak = base.consecutiveFirstAttemptStreak + 1;
    newFirstAttemptCorrect = base.lifetimeFirstAttemptCorrect + 1;
    newPersonalBest = Math.max(base.personalBestStreak, newStreak);
  } else {
    newStreak = 0;
    newFirstAttemptCorrect = base.lifetimeFirstAttemptCorrect;
    newPersonalBest = base.personalBestStreak;
  }

  return {
    ...base,
    consecutiveFirstAttemptStreak: newStreak,
    last10: newLast10,
    lifetimeTotalAttempts: newTotalAttempts,
    lifetimeFirstAttemptCorrect: newFirstAttemptCorrect,
    lifetimeTotalCorrect: newTotalCorrect,
    personalBestStreak: newPersonalBest,
  };
}
