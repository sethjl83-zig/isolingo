import type { VocabItem } from '../types/vocab';

import type { StudyType, WordFrequencySetting } from '../types/state';

import { getMasterDataset } from '../data';
import {
  getPrimaryEnglish,
  stripEnglishGenderPrefix,
} from '../engines/genderedCounterpartHelper';



/** Filter master vocabulary for a given study mode. */

export function filterForStudyType(words: VocabItem[], studyType: StudyType): VocabItem[] {

  if (studyType === 'gender') {

    return words.filter(w => w.partOfSpeech === 'noun');

  }

  return words;

}



/** Pick one random word from master not already in `excludeIds`. */

export function pickReplacementWord(

  language: string,

  excludeIds: Set<string>,

  studyType: StudyType,

): VocabItem | null {

  const pool = filterForStudyType(getMasterDataset(language), studyType).filter(

    w => !excludeIds.has(w.id),

  );

  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];

}



/** Build per-word frequency settings, preserving any existing values. */

export function buildFrequencySettings(

  words: VocabItem[],

  existing: Record<string, WordFrequencySetting> = {},

): Record<string, WordFrequencySetting> {

  const settings: Record<string, WordFrequencySetting> = {};

  for (const word of words) {

    settings[word.id] = existing[word.id] ?? 'normal';

  }

  return settings;

}



/** Which field the vocab search bar filters on. */
export type VocabSearchMode = 'target' | 'english';

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};

export function getLanguageDisplayName(language: string): string {
  return LANGUAGE_DISPLAY_NAMES[language] ?? 'Target';
}

/** Lowercase, trim, and collapse extra spaces so "  male   cousin " matches "cousin". */
function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Primary gloss plus every secondary gloss, with a leading "male " or "female " removed. */
function searchableGlosses(item: VocabItem): string[] {
  const primary = stripEnglishGenderPrefix(getPrimaryEnglish(item));
  const secondary = (item.secondaryGlosses ?? []).map(gloss =>
    stripEnglishGenderPrefix(gloss),
  );
  return [primary, ...secondary].map(normalizeSearchText).filter(Boolean);
}

function searchableLemma(item: VocabItem): string {
  return normalizeSearchText(item.lemma ?? '');
}

/**
 * Match the typed text anywhere in the word. Within the matches, words that
 * start with it come first. Each group keeps the order of `words`, so pass a
 * list that is already in the screen's alphabetical order.
 * Target mode uses the lemma. English mode uses the glosses. With no mode
 * (Vocab Bank), either field matches.
 * An empty query returns `words` unchanged.
 */
export function filterVocabBySearch(
  words: VocabItem[],
  query: string,
  mode?: VocabSearchMode,
): VocabItem[] {
  const q = normalizeSearchText(query);
  if (!q) return words;

  const lemmaOf = (word: VocabItem) => searchableLemma(word);
  const glossesOf = (word: VocabItem) => searchableGlosses(word);

  const starts = (word: VocabItem) =>
    mode === 'english'
      ? glossesOf(word).some(gloss => gloss.startsWith(q))
      : mode === 'target'
        ? lemmaOf(word).startsWith(q)
        : lemmaOf(word).startsWith(q) || glossesOf(word).some(gloss => gloss.startsWith(q));

  const contains = (word: VocabItem) =>
    mode === 'english'
      ? glossesOf(word).some(gloss => gloss.includes(q))
      : mode === 'target'
        ? lemmaOf(word).includes(q)
        : lemmaOf(word).includes(q) || glossesOf(word).some(gloss => gloss.includes(q));

  const leading: VocabItem[] = [];
  const rest: VocabItem[] = [];
  for (const word of words) {
    if (!contains(word)) continue;
    if (starts(word)) leading.push(word);
    else rest.push(word);
  }
  return [...leading, ...rest];
}

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  de: 'de',
  fr: 'fr',
  es: 'es',
};

/** Display-order sort by target-language lemma (does not mutate the input). */
export function sortVocabByLemma(
  words: VocabItem[],
  language?: string,
): VocabItem[] {
  const locale = language ? LOCALE_BY_LANGUAGE[language] : undefined;
  const sorted = [...words].sort((a, b) => {
    const lemmaA = (a.lemma ?? '').trim();
    const lemmaB = (b.lemma ?? '').trim();
    return lemmaA.localeCompare(lemmaB, locale, {
      sensitivity: 'base',
      numeric: true,
    });
  });

  return sorted;
}



export function getUniqueCategories(words: VocabItem[]): string[] {

  return [...new Set(words.flatMap(w => w.category))].sort((a, b) => a.localeCompare(b));

}



export function getWordLemmaColor(

  item: VocabItem,

  defaultColor: string,

  genderColors: Record<string, string>,

): string {

  if (item.partOfSpeech === 'noun' && item.gender) {

    return genderColors[item.gender] ?? defaultColor;

  }

  return defaultColor;

}

