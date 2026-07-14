import type { VocabItem } from '../types/vocab';
import type { DeterminerType } from '../types/cards';
import {
  findGenderedCounterpart,
  mergeCounterpartEnglishAccepted,
} from './genderedCounterpartHelper';

export {
  buildDisambiguatedEnglishPrompt,
  collectCounterpartEnglishAnswers,
  collectTargetToNativeEnglishGlosses,
  findGenderedCounterpart,
  getPrimaryEnglish,
  isAmbiguousEnglishPair,
  mergeCounterpartEnglishAccepted,
  stripEnglishGenderPrefix,
} from './genderedCounterpartHelper';

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?]+$/, '');
}

function stripToPrefix(s: string): string {
  return s.replace(/^to\s+/i, '');
}

// ── Main validation ───────────────────────────────────────────────────────────

export interface ValidationResult {
  correct: boolean;
  alsoCorrect: string[]; // other accepted answers not entered by user
}

/**
 * direction = 'target_to_native'  → English output:
 *   case-insensitive, "to" prefix on verbs optional
 *
 * direction = 'native_to_target'  → Target-language output:
 *   exact match required; diacritics and German noun capitalisation mandatory
 */
export function validateAnswer(
  userInput: string,
  canonicalAnswer: string,
  acceptedAnswers: string[],
  direction: 'native_to_target' | 'target_to_native',
): ValidationResult {
  const normalized = normalizeInput(userInput);
  const allAccepted = [canonicalAnswer, ...acceptedAnswers];

  if (direction === 'target_to_native') {
    const userKey = stripToPrefix(normalized).toLowerCase();
    const matched = allAccepted.find(
      a => stripToPrefix(normalizeInput(a)).toLowerCase() === userKey,
    );
    if (matched) {
      const others = allAccepted
        .filter(a => stripToPrefix(normalizeInput(a)).toLowerCase() !== userKey)
        .map(a => normalizeInput(a));
      return { correct: true, alsoCorrect: others };
    }
    return { correct: false, alsoCorrect: [] };
  }

  // native_to_target: exact (after whitespace/punctuation normalisation only)
  const matched = allAccepted.find(a => normalizeInput(a) === normalized);
  if (matched) {
    const others = allAccepted
      .filter(a => normalizeInput(a) !== normalized)
      .map(a => normalizeInput(a));
    return { correct: true, alsoCorrect: others };
  }
  return { correct: false, alsoCorrect: [] };
}

/**
 * Resolves the full set of accepted English answers for a target-to-native
 * Card 1006, including glosses from a gendered counterpart when present.
 */
export function resolveTargetToNativeEnglishAnswers(
  item: VocabItem,
  bankById: Map<string, VocabItem>,
  canonicalAnswer: string,
  acceptedAnswers: string[],
  usedDeterminer: DeterminerType | null,
): { canonicalAnswer: string; acceptedAnswers: string[] } {
  const counterpart = findGenderedCounterpart(item, bankById);
  if (!counterpart) {
    return { canonicalAnswer, acceptedAnswers };
  }
  return {
    canonicalAnswer,
    acceptedAnswers: mergeCounterpartEnglishAccepted(
      canonicalAnswer,
      acceptedAnswers,
      counterpart,
      usedDeterminer,
    ),
  };
}

/**
 * Validates a Card 1006 German native_to_target submission.
 * Both the typed noun AND the selected gender tile must be correct.
 *
 * @param alternateNouns - Optional alternate accepted noun spellings/forms
 *   (from VocabItem.alternateTargetAnswers). When the user types one of these
 *   and the gender is correct, the answer is marked correct and the canonical
 *   noun is returned in `alsoCorrect` so the UI can show "Also accepted: X".
 */
export function validateGermanNoun(
  typedNoun: string,
  selectedGender: string | null,
  correctNoun: string,
  correctGender: string,
  alternateNouns: string[] = [],
): ValidationResult {
  const normalizedTyped = normalizeInput(typedNoun);
  const genderOk = selectedGender === correctGender;

  if (!genderOk) return { correct: false, alsoCorrect: [] };

  // Canonical match
  if (normalizeInput(correctNoun) === normalizedTyped) {
    return { correct: true, alsoCorrect: [] };
  }

  // Alternate match — surface the canonical as "Also accepted"
  if (alternateNouns.some(n => normalizeInput(n) === normalizedTyped)) {
    return { correct: true, alsoCorrect: [correctNoun] };
  }

  return { correct: false, alsoCorrect: [] };
}

/**
 * Builds user-facing hints for a wrong German native-to-target noun submission.
 * Returns an empty array when the typed noun spelling does not match the answer.
 */
export function getGermanNounErrorHints(
  typedNoun: string,
  selectedGender: string | null,
  correctNoun: string,
  correctGender: string,
  alternateNouns: string[] = [],
): string[] {
  const normalizedTyped = normalizeInput(typedNoun);
  const allForms = [correctNoun, ...alternateNouns].map(normalizeInput);
  const spellingOk = allForms.some(
    a => a.toLowerCase() === normalizedTyped.toLowerCase(),
  );
  if (!spellingOk) return [];

  const hints: string[] = [];
  if (selectedGender !== correctGender) {
    hints.push('(wrong gender)');
  }

  const exactOk = allForms.some(a => a === normalizedTyped);
  const capitalizationIssue =
    normalizedTyped.length > 0 &&
    normalizedTyped[0] !== normalizedTyped[0].toUpperCase();
  if (!exactOk && capitalizationIssue) {
    hints.push('(check capitalization)');
  }

  return hints;
}
