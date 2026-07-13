import type { Language, Gender } from '../types/vocab';
import type { DeterminerType, PossessivePerson } from '../types/cards';

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

const FRENCH_POSSESSIVE: Record<PossessivePerson, Record<Gender, string>> = {
  first: { masculine: 'mon', feminine: 'ma', neuter: 'mon' },
  second: { masculine: 'ton', feminine: 'ta', neuter: 'ton' },
  third: { masculine: 'son', feminine: 'sa', neuter: 'son' },
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

const SPANISH_POSSESSIVE: Record<PossessivePerson, string> = {
  first: 'mi',
  second: 'tu',
  third: 'su',
};

const POSSESSIVE_PERSONS: PossessivePerson[] = ['first', 'second', 'third'];

/** Randomly pick 1st / 2nd / 3rd person when a possessive determiner is used. */
export function pickRandomPossessivePerson(): PossessivePerson {
  return POSSESSIVE_PERSONS[Math.floor(Math.random() * POSSESSIVE_PERSONS.length)];
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns the raw article string (no trailing space). */
export function getArticle(
  language: Language,
  gender: Gender,
  determinerType: DeterminerType,
  possessivePerson: PossessivePerson = 'first',
): string {
  if (language === 'fr') {
    if (determinerType === 'definite') return FRENCH_DEFINITE[gender];
    if (determinerType === 'indefinite') return FRENCH_INDEFINITE[gender];
    return FRENCH_POSSESSIVE[possessivePerson][gender];
  }
  if (language === 'es') {
    if (determinerType === 'definite') return SPANISH_DEFINITE[gender];
    if (determinerType === 'indefinite') return SPANISH_INDEFINITE[gender];
    return SPANISH_POSSESSIVE[possessivePerson];
  }
  return ''; // German: no article in display forms for study cards
}

/** Returns the full display form: article + noun, handling French elision. */
export function getDisplayForm(
  language: Language,
  gender: Gender,
  lemma: string,
  determinerType: DeterminerType = 'definite',
  possessivePerson: PossessivePerson = 'first',
): string {
  if (language === 'de') return lemma;

  const article = getArticle(language, gender, determinerType, possessivePerson);

  // French elision: le/la → l' before a vowel or silent h
  if (language === 'fr' && determinerType === 'definite') {
    const startsWithVowelOrH = /^[aeiouéèêëàâùûîïôœæh]/i.test(lemma);
    if (startsWithVowelOrH) return `l'${lemma}`;
  }

  return `${article} ${lemma}`;
}

/**
 * Splits a FR/ES display form into its article and noun parts for two-color
 * rendering (article in default color, noun in gender color).
 * Returns empty article for German.
 * For French elision ("l'hôtel") the separator is '' rather than ' '.
 */
export function splitDisplayForm(
  language: Language,
  gender: Gender,
  lemma: string,
  determinerType: DeterminerType = 'definite',
  possessivePerson: PossessivePerson = 'first',
): { article: string; separator: string; noun: string } {
  if (language === 'de') return { article: '', separator: '', noun: lemma };

  // French elision: le/la → l' before a vowel or silent h
  if (language === 'fr' && determinerType === 'definite') {
    const startsWithVowelOrH = /^[aeiouéèêëàâùûîïôœæh]/i.test(lemma);
    if (startsWithVowelOrH) return { article: "l'", separator: '', noun: lemma };
  }

  const article = getArticle(language, gender, determinerType, possessivePerson);
  return { article, separator: ' ', noun: lemma };
}

/** Returns an English determiner+noun prompt: "the dog", "a cat", "your friend". */
export function getEnglishDeterminerPrompt(
  englishNoun: string,
  determinerType: DeterminerType,
  possessivePerson: PossessivePerson = 'first',
): string {
  switch (determinerType) {
    case 'definite':
      return `the ${englishNoun}`;
    case 'indefinite': {
      const startsWithVowel = /^[aeiou]/i.test(englishNoun);
      return `${startsWithVowel ? 'an' : 'a'} ${englishNoun}`;
    }
    case 'possessive':
      switch (possessivePerson) {
        case 'first':
          return `my ${englishNoun}`;
        case 'second':
          return `your ${englishNoun}`;
        case 'third':
          return `his/her ${englishNoun}`;
      }
  }
}
