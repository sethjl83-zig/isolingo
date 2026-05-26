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
 * Validates a Card 1006 German native_to_target submission.
 * Both the typed noun AND the selected gender tile must be correct.
 */
export function validateGermanNoun(
  typedNoun: string,
  selectedGender: string | null,
  correctNoun: string,
  correctGender: string,
): ValidationResult {
  const nounOk = normalizeInput(typedNoun) === correctNoun;
  const genderOk = selectedGender === correctGender;
  return { correct: nounOk && genderOk, alsoCorrect: [] };
}
