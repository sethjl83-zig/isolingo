import type { Language, Gender } from '../types/vocab';
import type { DeterminerType } from '../types/cards';

// ── Article lookup tables ─────────────────────────────────────────────────────

const FRENCH_DEFINITE: Record<Gender, string> = {
  masculine: 'le',
  feminine: 'la',
  neuter: 'le', // fallback
};

const FRENCH_INDEFINITE: Record<Gender, string> = {
  masculine: 'un',
  feminine: 'une',
  neuter: 'un',
};

const FRENCH_POSSESSIVE: Record<Gender, string> = {
  masculine: 'mon',
  feminine: 'ma',
  neuter: 'mon',
};

const SPANISH_DEFINITE: Record<Gender, string> = {
  masculine: 'el',
  feminine: 'la',
  neuter: 'el',
};

const SPANISH_INDEFINITE: Record<Gender, string> = {
  masculine: 'un',
  feminine: 'una',
  neuter: 'un',
};

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns the raw article string (no trailing space). */
export function getArticle(
  language: Language,
  gender: Gender,
  determinerType: DeterminerType,
): string {
  if (language === 'fr') {
    if (determinerType === 'definite') return FRENCH_DEFINITE[gender];
    if (determinerType === 'indefinite') return FRENCH_INDEFINITE[gender];
    return FRENCH_POSSESSIVE[gender];
  }
  if (language === 'es') {
    if (determinerType === 'definite') return SPANISH_DEFINITE[gender];
    if (determinerType === 'indefinite') return SPANISH_INDEFINITE[gender];
    return 'mi'; // possessive is invariant in this context
  }
  return ''; // German: no article in display forms for study cards
}

/** Returns the full display form: article + noun, handling French elision. */
export function getDisplayForm(
  language: Language,
  gender: Gender,
  lemma: string,
  determinerType: DeterminerType = 'definite',
): string {
  if (language === 'de') return lemma;

  const article = getArticle(language, gender, determinerType);

  // French elision: le/la → l' before a vowel or silent h
  if (language === 'fr' && determinerType === 'definite') {
    const startsWithVowelOrH = /^[aeiouéèêëàâùûîïôœæh]/i.test(lemma);
    if (startsWithVowelOrH) return `l'${lemma}`;
  }

  return `${article} ${lemma}`;
}

/** Returns an English determiner+noun prompt: "the dog", "a cat", "my friend". */
export function getEnglishDeterminerPrompt(
  englishNoun: string,
  determinerType: DeterminerType,
): string {
  switch (determinerType) {
    case 'definite':
      return `the ${englishNoun}`;
    case 'indefinite': {
      const startsWithVowel = /^[aeiou]/i.test(englishNoun);
      return `${startsWithVowel ? 'an' : 'a'} ${englishNoun}`;
    }
    case 'possessive':
      return `my ${englishNoun}`;
  }
}
