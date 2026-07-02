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

  // ── Extended schema fields (V0 update) ──────────────────────────────────
  /** Which article types are tested for this noun ('definite', 'indefinite', 'possessive'). */
  articleTypes?: string[] | null;
  /** ID of the grammatically gendered counterpart (e.g. Arzt ↔ Ärztin). */
  genderedCounterpart?: string | null;
  /** Additional accepted English glosses beyond the primary `english` field. */
  secondaryGlosses?: string[] | null;
  /** Alternate accepted spellings/forms for the target-language answer. */
  alternateTargetAnswers?: string[] | null;

  user_added?: 'y';
}
