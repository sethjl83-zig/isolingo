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
  formal_second: { masculine: 'votre', feminine: 'votre', neuter: 'votre' },
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
  formal_second: 'su', // unused — formal second is French-only
  third: 'su',
};

const POSSESSIVE_PERSONS_FR: PossessivePerson[] = ['first', 'second', 'formal_second', 'third'];
const POSSESSIVE_PERSONS_ES: PossessivePerson[] = ['first', 'second', 'third'];

/** Randomly pick a possessive person with equal weight (FR: four options; ES: three). */
export function pickRandomPossessivePerson(language: Language): PossessivePerson {
  const persons = language === 'fr' ? POSSESSIVE_PERSONS_FR : POSSESSIVE_PERSONS_ES;
  return persons[Math.floor(Math.random() * persons.length)];
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

/**
 * Card 1001 display form: the bare lemma only — never an article, determiner,
 * or possessive. German nouns are capitalized; FR/ES lemmas are left as stored.
 */
export function getBareLemmaDisplayForm(language: Language, lemma: string): string {
  const trimmed = lemma.trim();
  if (!trimmed) return trimmed;
  if (language === 'de') {
    return trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
  }
  return trimmed;
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
        case 'formal_second':
          return `your (formal) ${englishNoun}`;
        case 'third':
          return `his/her ${englishNoun}`;
      }
  }
}
