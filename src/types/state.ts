import type { Language, VocabItem } from './vocab';

export type StudyType = 'general_vocab' | 'gender';
export type DirectionMode = 'target_to_native' | 'native_to_target' | 'mixed';
export type WordStatus = 'NEW' | 'ACTIVE' | 'REINFORCEMENT';

/** User-controlled study frequency for a word in the bank. */
export type WordFrequencySetting = 'low' | 'normal' | 'high';

export interface WordStats {
  vocabId: string;
  exposureCount: number;
  errorCount: number;
  frequencyWeight: number;
  lastSeenIndex: number;
  status: WordStatus;
}

/** Saved vocabulary data for one study mode. */
export interface ModeBankData {
  activeVocabBank: VocabItem[];
  wordFrequencySettings: Record<string, WordFrequencySetting>;
}

export interface AppState {
  languageSelected: Language | null;
  studyTypeSelected: StudyType | null;
  directionMode: DirectionMode;
  modeBanks: Record<StudyType, ModeBankData | null>;
  activeVocabBank: VocabItem[];
  wordStats: Record<string, WordStats>;
  wordFrequencySettings: Record<string, WordFrequencySetting>;
  sessionCardIndex: number;
}

export interface PersistedAppData {
  selectedLanguage: Language;
  modeBanks: Record<StudyType, ModeBankData | null>;
  directionMode: DirectionMode;
  /** Written only after the user explicitly picks a language. Absent in stale/legacy data. */
  onboardingComplete?: boolean;
}

export const MIN_BANK_SIZE = 10;
export const MAX_BANK_SIZE = 25;

export const FREQUENCY_ORDER: WordFrequencySetting[] = ['low', 'normal', 'high'];

export const FREQUENCY_LABELS: Record<WordFrequencySetting, string> = {
  low: 'Low',
  normal: 'Medium',
  high: 'High',
};

export const FREQUENCY_INDICATOR_COLORS: Record<WordFrequencySetting, string> = {
  low: '#FF4444',
  normal: '#FFB300',
  high: '#44BB44',
};

export const FREQUENCY_MULTIPLIER: Record<WordFrequencySetting, number> = {
  low: 0.25,
  normal: 1,
  high: 2,
};

/** Map legacy persisted values to the current frequency model. */
export function normalizeFrequencySetting(value: string | undefined): WordFrequencySetting {
  switch (value) {
    case 'low':
    case 'reduced':
      return 'low';
    case 'high':
      return 'high';
    case 'normal':
    case 'marked_for_removal':
    default:
      return 'normal';
  }
}
