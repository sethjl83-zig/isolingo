import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedAppData, StudyType, WordFrequencySetting } from '../types/state';
import type { Language, VocabItem } from '../types/vocab';
import type { DirectionMode } from '../types/state';
import { normalizeFrequencySetting } from '../types/state';
import type { Pool, PoolWord, DefaultPoolIds } from '../types/pool';
import { EMPTY_DEFAULT_POOL_IDS, generatePoolId, snapToDeckSize } from '../types/pool';

const STORAGE_KEY = '@isolingo/persisted_state';

export interface StoredState {
  selectedLanguage: Language;
  directionMode: DirectionMode;
  languagePools: Partial<Record<Language, Pool[]>>;
  defaultPoolIds: DefaultPoolIds;
}

/** Legacy on-disk shapes — read once and converted to pools; never written back. */
interface LegacyModeBankData {
  activeVocabBank: VocabItem[];
  wordFrequencySettings?: Record<string, WordFrequencySetting>;
}

type LegacyLanguageBanks = Partial<
  Record<Language, Partial<Record<StudyType, LegacyModeBankData | null>>>
>;

interface LegacyModeBanksStoredState {
  selectedLanguage: Language;
  modeBanks: Partial<Record<StudyType, LegacyModeBankData | null>>;
  directionMode?: DirectionMode;
}

interface LegacySingleBankStoredState {
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

function normalizeLegacyModeBank(
  bank: LegacyModeBankData | null | undefined,
): LegacyModeBankData | null {
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

function legacyBankToPool(
  bank: LegacyModeBankData,
  name: string,
  language: Language,
  createdVia: Pool['createdVia'],
): Pool {
  const words: PoolWord[] = bank.activeVocabBank.map(vocabItem => {
    const normalized = normalizeVocabItem(vocabItem);
    const rawFreq = bank.wordFrequencySettings?.[normalized.id];
    const frequency = normalizeFrequencySetting(rawFreq) as PoolWord['frequency'];
    return { item: normalized, frequency };
  });

  return {
    id: generatePoolId(),
    name,
    language,
    words,
    deckSize: snapToDeckSize(words.length),
    createdVia,
    pausedWordIds: [],
  };
}

/** One-time read of legacy modeBanks / languageBanks into the pool format. */
function poolsFromLegacyLanguageBanks(languageBanks: LegacyLanguageBanks): {
  languagePools: Partial<Record<Language, Pool[]>>;
  defaultPoolIds: DefaultPoolIds;
} {
  const languagePools: Partial<Record<Language, Pool[]>> = {};
  const defaultPoolIds: DefaultPoolIds = {
    general_vocab: {},
    gender: {},
  };

  for (const [lang, banks] of Object.entries(languageBanks)) {
    const language = lang as Language;
    const pools: Pool[] = [];

    const generalBank = normalizeLegacyModeBank(banks?.general_vocab ?? null);
    if (generalBank) {
      const pool = legacyBankToPool(generalBank, 'List 1', language, 'custom');
      pools.push(pool);
      defaultPoolIds.general_vocab[language] = [pool.id];
    }

    const genderBank = normalizeLegacyModeBank(banks?.gender ?? null);
    if (genderBank) {
      const pool = legacyBankToPool(genderBank, 'List 1 (Gender)', language, 'custom');
      pools.push(pool);
      defaultPoolIds.gender[language] = [pool.id];
    }

    if (pools.length > 0) {
      languagePools[language] = pools;
    }
  }

  return { languagePools, defaultPoolIds };
}

function normalizeLanguageBanks(languageBanks: LegacyLanguageBanks | undefined): LegacyLanguageBanks {
  const result: LegacyLanguageBanks = {};
  if (!languageBanks) return result;
  for (const [lang, banks] of Object.entries(languageBanks)) {
    result[lang as Language] = {
      general_vocab: normalizeLegacyModeBank(banks?.general_vocab ?? null),
      gender: normalizeLegacyModeBank(banks?.gender ?? null),
    };
  }
  return result;
}

function legacySingleBankToLanguageBanks(parsed: LegacySingleBankStoredState): LegacyLanguageBanks | null {
  if (!parsed.selectedLanguage || !Array.isArray(parsed.activeVocabBank)) {
    return null;
  }

  const rawSettings = parsed.wordFrequencySettings ?? {};
  const wordFrequencySettings: Record<string, WordFrequencySetting> = {};
  for (const [id, value] of Object.entries(rawSettings)) {
    wordFrequencySettings[id] = normalizeFrequencySetting(value);
  }

  const generalBank: LegacyModeBankData | null =
    parsed.activeVocabBank.length > 0
      ? { activeVocabBank: parsed.activeVocabBank.map(normalizeVocabItem), wordFrequencySettings }
      : null;

  return {
    [parsed.selectedLanguage]: { general_vocab: generalBank, gender: null },
  };
}

export async function loadPersistedState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedAppData &
      LegacyModeBanksStoredState &
      LegacySingleBankStoredState & { languageBanks?: LegacyLanguageBanks };

    if (!parsed.selectedLanguage) return null;
    if (!parsed.onboardingComplete) return null;

    const directionMode = parsed.directionMode ?? 'mixed';

    // Current format — pools are already the source of truth.
    if (parsed.languagePools && Object.keys(parsed.languagePools).length > 0) {
      return {
        selectedLanguage: parsed.selectedLanguage,
        directionMode,
        languagePools: parsed.languagePools as Partial<Record<Language, Pool[]>>,
        defaultPoolIds: parsed.defaultPoolIds ?? { ...EMPTY_DEFAULT_POOL_IDS },
      };
    }

    // Legacy read: convert old bank storage to pools (one-time, in memory).
    let languageBanks: LegacyLanguageBanks | null = null;

    if (parsed.languageBanks) {
      languageBanks = normalizeLanguageBanks(parsed.languageBanks);
    } else if (parsed.modeBanks) {
      languageBanks = {
        [parsed.selectedLanguage]: {
          general_vocab: normalizeLegacyModeBank(parsed.modeBanks.general_vocab ?? null),
          gender: normalizeLegacyModeBank(parsed.modeBanks.gender ?? null),
        },
      };
    } else if (Array.isArray(parsed.activeVocabBank)) {
      languageBanks = legacySingleBankToLanguageBanks(parsed);
    }

    if (!languageBanks) return null;

    const { languagePools, defaultPoolIds } = poolsFromLegacyLanguageBanks(languageBanks);
    if (Object.keys(languagePools).length === 0) return null;

    return {
      selectedLanguage: parsed.selectedLanguage,
      directionMode,
      languagePools,
      defaultPoolIds,
    };
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
