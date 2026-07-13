import type { VocabItem } from '../types/vocab';

import type { ModeBankData, StudyType, WordFrequencySetting } from '../types/state';

import { getMasterDataset } from '../data';



/** Filter master vocabulary for a given study mode. */

export function filterForStudyType(words: VocabItem[], studyType: StudyType): VocabItem[] {

  if (studyType === 'gender') {

    return words.filter(w => w.partOfSpeech === 'noun');

  }

  return words;

}



/** Randomly pick `count` words from the master dataset for a language and study mode. */

export function pickRandomWords(language: string, count: number, studyType: StudyType): VocabItem[] {

  const master = filterForStudyType([...getMasterDataset(language)], studyType);

  const shuffled = master.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count);

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



/** Extract nouns from a general vocab bank to seed a gender bank. */

export function extractNounsFromBank(bank: ModeBankData): ModeBankData {

  const nouns = bank.activeVocabBank.filter(w => w.partOfSpeech === 'noun');

  const wordFrequencySettings: Record<string, WordFrequencySetting> = {};

  for (const noun of nouns) {

    wordFrequencySettings[noun.id] = bank.wordFrequencySettings[noun.id] ?? 'normal';

  }

  return { activeVocabBank: nouns, wordFrequencySettings };

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

function englishGlosses(item: VocabItem): string[] {
  return item.english
    .split(',')
    .map(s => s.trim().replace(/^to\s+/i, ''))
    .filter(Boolean);
}

/**
 * Filter a vocab list by prefix match on lemma (target mode) or English gloss
 * (english mode). When mode is omitted, matches if either field starts with the
 * query (used by screens without a mode toggle).
 */
export function filterVocabBySearch(
  words: VocabItem[],
  query: string,
  mode?: VocabSearchMode,
): VocabItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return words;

  if (mode === 'target') {
    return words.filter(w => w.lemma.toLowerCase().startsWith(q));
  }

  if (mode === 'english') {
    return words.filter(w =>
      englishGlosses(w).some(g => g.toLowerCase().startsWith(q)),
    );
  }

  return words.filter(
    w =>
      w.lemma.toLowerCase().startsWith(q) ||
      englishGlosses(w).some(g => g.toLowerCase().startsWith(q)),
  );
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

  // TEMP: confirm sort is applied
  if (words.length > 1) {
    const orderChanged = words.some((word, index) => word.id !== sorted[index]?.id);
    console.log('[sortVocabByLemma]', {
      language,
      locale,
      count: words.length,
      orderChanged,
      before: words.map(w => w.lemma),
      after: sorted.map(w => w.lemma),
    });
  }

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

