import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedAppData, ModeBankData, StudyType, LanguageBanks } from '../types/state';
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
  /** Banks for every language the user has set up, keyed by language. */
  languageBanks: LanguageBanks;
  directionMode: DirectionMode;
}

/** Format v2 — single set of mode banks tied to the selected language. */
interface ModeBanksStoredState {
  selectedLanguage: Language;
  modeBanks: Record<StudyType, ModeBankData | null>;
  directionMode?: DirectionMode;
}

/** Legacy single-bank format before per-mode banks were introduced. */
interface LegacyStoredState {
  selectedLanguage: Language;
  activeVocabBank: VocabItem[];
  wordFrequencySettings?: Record<string, WordFrequencySetting>;
  directionMode?: DirectionMode;
}

/**
 * Ensure a VocabItem's `category` field is always `string[]`.
 * Words saved before the array migration have `category: string`; this shim
 * converts those values so the rest of the app never sees the old format.
 */
function normalizeVocabItem(item: VocabItem): VocabItem {
  const raw = item as VocabItem & { category: string | string[] };
  if (!Array.isArray(raw.category)) {
    return { ...raw, category: raw.category ? [raw.category] : ['general'] };
  }
  return item;
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
    activeVocabBank: bank.activeVocabBank.map(normalizeVocabItem),
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

function normalizeLanguageBanks(languageBanks: LanguageBanks | undefined): LanguageBanks {
  const result: LanguageBanks = {};
  if (!languageBanks) return result;
  for (const [lang, banks] of Object.entries(languageBanks)) {
    result[lang as Language] = normalizeModeBanks(banks ?? undefined);
  }
  return result;
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
    languageBanks: {
      [parsed.selectedLanguage]: { general_vocab: generalBank, gender: null },
    },
    directionMode: parsed.directionMode ?? 'mixed',
  };
}

export async function loadPersistedState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedAppData &
      ModeBanksStoredState &
      LegacyStoredState;
    if (!parsed.selectedLanguage) return null;
    if (!parsed.onboardingComplete) return null;

    // Current format — per-language banks
    if ('languageBanks' in parsed && parsed.languageBanks) {
      return {
        selectedLanguage: parsed.selectedLanguage,
        languageBanks: normalizeLanguageBanks(parsed.languageBanks),
        directionMode: parsed.directionMode ?? 'mixed',
      };
    }

    // v2 format — one set of mode banks, owned by the selected language
    if ('modeBanks' in parsed && parsed.modeBanks) {
      return {
        selectedLanguage: parsed.selectedLanguage,
        languageBanks: {
          [parsed.selectedLanguage]: normalizeModeBanks(parsed.modeBanks),
        },
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
