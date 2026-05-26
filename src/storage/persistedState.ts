import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedAppData, ModeBankData, StudyType } from '../types/state';
import type { Language, VocabItem } from '../types/vocab';
import type { DirectionMode, WordFrequencySetting } from '../types/state';
import { normalizeFrequencySetting } from '../types/state';

const STORAGE_KEY = '@isolingo/persisted_state';

export const EMPTY_MODE_BANKS: Record<StudyType, ModeBankData | null> = {
  general_vocab: null,
  gender: null,
};

export interface StoredState {
  selectedLanguage: Language;
  modeBanks: Record<StudyType, ModeBankData | null>;
  directionMode: DirectionMode;
}

/** Legacy single-bank format before per-mode banks were introduced. */
interface LegacyStoredState {
  selectedLanguage: Language;
  activeVocabBank: VocabItem[];
  wordFrequencySettings?: Record<string, WordFrequencySetting>;
  directionMode?: DirectionMode;
}

function normalizeModeBank(bank: ModeBankData | null | undefined): ModeBankData | null {
  if (!bank || !Array.isArray(bank.activeVocabBank) || bank.activeVocabBank.length === 0) {
    return null;
  }

  const wordFrequencySettings: Record<string, WordFrequencySetting> = {};
  const rawSettings = bank.wordFrequencySettings ?? {};
  for (const [id, value] of Object.entries(rawSettings)) {
    wordFrequencySettings[id] = normalizeFrequencySetting(value);
  }

  return {
    activeVocabBank: bank.activeVocabBank,
    wordFrequencySettings,
  };
}

function normalizeModeBanks(
  modeBanks: Record<StudyType, ModeBankData | null | undefined> | undefined,
): Record<StudyType, ModeBankData | null> {
  return {
    general_vocab: normalizeModeBank(modeBanks?.general_vocab ?? null),
    gender: normalizeModeBank(modeBanks?.gender ?? null),
  };
}

function migrateLegacyState(parsed: LegacyStoredState): StoredState | null {
  if (!parsed.selectedLanguage || !Array.isArray(parsed.activeVocabBank)) {
    return null;
  }

  const rawSettings = parsed.wordFrequencySettings ?? {};
  const wordFrequencySettings: Record<string, WordFrequencySetting> = {};
  for (const [id, value] of Object.entries(rawSettings)) {
    wordFrequencySettings[id] = normalizeFrequencySetting(value);
  }

  const generalBank: ModeBankData | null =
    parsed.activeVocabBank.length > 0
      ? { activeVocabBank: parsed.activeVocabBank, wordFrequencySettings }
      : null;

  return {
    selectedLanguage: parsed.selectedLanguage,
    modeBanks: { general_vocab: generalBank, gender: null },
    directionMode: parsed.directionMode ?? 'mixed',
  };
}

export async function loadPersistedState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedAppData & LegacyStoredState;
    if (!parsed.selectedLanguage) return null;

    if ('modeBanks' in parsed && parsed.modeBanks) {
      return {
        selectedLanguage: parsed.selectedLanguage,
        modeBanks: normalizeModeBanks(parsed.modeBanks),
        directionMode: parsed.directionMode ?? 'mixed',
      };
    }

    return migrateLegacyState(parsed);
  } catch {
    return null;
  }
}

export async function savePersistedState(data: PersistedAppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal — app continues with in-memory state
  }
}

export async function clearPersistedState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasModeBank(
  modeBanks: Record<StudyType, ModeBankData | null>,
  studyType: StudyType,
): boolean {
  const bank = modeBanks[studyType];
  return bank !== null && bank.activeVocabBank.length > 0;
}
