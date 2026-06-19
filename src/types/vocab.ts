export type Language = 'de' | 'fr' | 'es';
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb';
export type Gender = 'masculine' | 'feminine' | 'neuter';
export type Competency = 'vocab' | 'gender';

export interface VocabItem {
  id: string;
  targetLanguage: Language;
  english: string;
  senseLabel: string | null;
  lemma: string;
  partOfSpeech: PartOfSpeech;
  gender: Gender | null;
  plural: string | null;
  category: string[];
  competencies: Competency[];
  user_added?: 'y';
}
