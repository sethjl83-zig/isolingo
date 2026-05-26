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



/** Filter a vocab list by lemma, English gloss, or category. */

export function filterVocabBySearch(words: VocabItem[], query: string): VocabItem[] {

  const q = query.trim().toLowerCase();

  if (!q) return words;

  return words.filter(

    w =>

      w.lemma.toLowerCase().includes(q) ||

      w.english.toLowerCase().includes(q) ||

      w.category.toLowerCase().includes(q),

  );

}



export function getUniqueCategories(words: VocabItem[]): string[] {

  return [...new Set(words.map(w => w.category))].sort((a, b) => a.localeCompare(b));

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

