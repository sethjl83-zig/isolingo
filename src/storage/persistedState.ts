import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedAppData, ModeBankData, StudyType, LanguageBanks } from '../types/state';
import type { Language, VocabItem } from '../types/vocab';
import type { DirectionMode, WordFrequencySetting } from '../types/state';
import { normalizeFrequencySetting } from '../types/state';
import type { Pool, PoolWord, DefaultPoolIds } from '../types/pool';
import { EMPTY_DEFAULT_POOL_IDS, generatePoolId, snapToDeckSize } from '../types/pool';

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
  // ── Named pools (source of truth after migration) ─────────────────────────
  languagePools: Partial<Record<Language, Pool[]>>;
  defaultPoolIds: DefaultPoolIds;
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

/** Intermediate shape returned before pool migration is applied. */
type PrePoolStoredState = Omit<StoredState, 'languagePools' | 'defaultPoolIds'>;

function migrateLegacyState(parsed: LegacyStoredState): PrePoolStoredState | null {
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
      ? { activeVocabBank: parsed.activeVocabBank.map(normalizeVocabItem), wordFrequencySettings }
      : null;

  return {
    selectedLanguage: parsed.selectedLanguage,
    languageBanks: {
      [parsed.selectedLanguage]: { general_vocab: generalBank, gender: null },
    },
    directionMode: parsed.directionMode ?? 'mixed',
  };
}

// ── Pool migration helpers ────────────────────────────────────────────────────

/** Convert a ModeBankData record into a Pool. */
function modeBankToPool(
  bank: ModeBankData,
  name: string,
  language: Language,
  createdVia: Pool['createdVia'],
): Pool {
  const words: PoolWord[] = bank.activeVocabBank.map(vocabItem => {
    const normalized = normalizeVocabItem(vocabItem);
    const rawFreq = bank.wordFrequencySettings?.[normalized.id];
    const frequency = normalizeFrequencySetting(rawFreq) as Pool['words'][number]['frequency'];
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

/**
 * Convert the old per-language ModeBankData map into the new Pool format.
 * Called once on first load after the data model upgrade.
 */
function migrateToPoolFormat(languageBanks: LanguageBanks): {
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

    const generalBank = banks?.general_vocab;
    if (generalBank && generalBank.activeVocabBank.length > 0) {
      const pool = modeBankToPool(generalBank, 'List 1', language, 'custom');
      pools.push(pool);
      defaultPoolIds.general_vocab[language] = [pool.id];
    }

    const genderBank = banks?.gender;
    if (genderBank && genderBank.activeVocabBank.length > 0) {
      const pool = modeBankToPool(genderBank, 'List 1 (Gender)', language, 'custom');
      pools.push(pool);
      defaultPoolIds.gender[language] = [pool.id];
    }

    if (pools.length > 0) {
      languagePools[language] = pools;
    }
  }

  return { languagePools, defaultPoolIds };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function loadPersistedState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedAppData &
      ModeBanksStoredState &
      LegacyStoredState;
    if (!parsed.selectedLanguage) return null;
    if (!parsed.onboardingComplete) return null;

    // Current format — per-language banks (may or may not already have pools)
    if ('languageBanks' in parsed && parsed.languageBanks) {
      const languageBanks = normalizeLanguageBanks(parsed.languageBanks);

      // If pool data was already written, use it; otherwise run migration once.
      let languagePools: Partial<Record<Language, Pool[]>>;
      let defaultPoolIds: DefaultPoolIds;

      if (parsed.languagePools && Object.keys(parsed.languagePools).length > 0) {
        languagePools = parsed.languagePools as Partial<Record<Language, Pool[]>>;
        defaultPoolIds = parsed.defaultPoolIds ?? { ...EMPTY_DEFAULT_POOL_IDS };
      } else {
        ({ languagePools, defaultPoolIds } = migrateToPoolFormat(languageBanks));
      }

      return {
        selectedLanguage: parsed.selectedLanguage,
        languageBanks,
        directionMode: parsed.directionMode ?? 'mixed',
        languagePools,
        defaultPoolIds,
      };
    }

    // v2 format — one set of mode banks, owned by the selected language
    if ('modeBanks' in parsed && parsed.modeBanks) {
      const languageBanks: LanguageBanks = {
        [parsed.selectedLanguage]: normalizeModeBanks(parsed.modeBanks),
      };
      const { languagePools, defaultPoolIds } = migrateToPoolFormat(languageBanks);
      return {
        selectedLanguage: parsed.selectedLanguage,
        languageBanks,
        directionMode: parsed.directionMode ?? 'mixed',
        languagePools,
        defaultPoolIds,
      };
    }

    // Oldest format — migrate legacy, then migrate to pools
    const legacyResult = migrateLegacyState(parsed);
    if (!legacyResult) return null;
    const { languagePools, defaultPoolIds } = migrateToPoolFormat(legacyResult.languageBanks);
    return { ...legacyResult, languagePools, defaultPoolIds };
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
