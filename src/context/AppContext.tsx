import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { VocabItem } from '../types/vocab';
import type {
  AppState,
  DirectionMode,
  LanguageBanks,
  ModeBankData,
  StudyType,
  WordFrequencySetting,
} from '../types/state';
import type { Language } from '../types/vocab';
import type { Pool, DefaultPoolIds, PoolWord } from '../types/pool';
import { EMPTY_DEFAULT_POOL_IDS, generatePoolId, snapToDeckSize } from '../types/pool';
import { addUserWord } from '../data';
import { updateStatsAfterCard, getOrInitStats } from '../engines/repetitionEngine';
import { buildFrequencySettings } from '../utils/vocabBank';
import {
  loadPersistedState,
  savePersistedState,
  EMPTY_MODE_BANKS,
  hasModeBank,
} from '../storage/persistedState';

type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'SELECT_LANGUAGE'; language: Language }
  | { type: 'SET_VOCAB_BANK'; bank: VocabItem[]; frequencySettings?: Record<string, WordFrequencySetting>; studyType?: StudyType }
  | { type: 'SELECT_STUDY_TYPE'; studyType: StudyType }
  | { type: 'SET_DIRECTION_MODE'; mode: DirectionMode }
  | { type: 'RECORD_CARD_RESULT'; vocabId: string; correct: boolean }
  | { type: 'INCREMENT_CARD_INDEX' }
  | { type: 'REMOVE_FROM_BANK'; vocabId: string }
  | { type: 'SET_WORD_FREQUENCY'; vocabId: string; setting: WordFrequencySetting }
  | { type: 'ADD_WORD_TO_MASTER'; item: VocabItem }
  | { type: 'RESET_SESSION' }
  | { type: 'RESET_APP' }
  // ── Pool actions ───────────────────────────────────────────────────────────
  | { type: 'CREATE_POOL'; pool: Pool }
  | { type: 'UPDATE_POOL'; poolId: string; updates: Partial<Omit<Pool, 'id' | 'language'>> }
  | { type: 'DELETE_POOL'; poolId: string; language: Language }
  | { type: 'SET_DEFAULT_POOL'; studyType: StudyType; language: Language; poolIds: string[] };

const initialState: AppState = {
  languageSelected: null,
  studyTypeSelected: null,
  directionMode: 'mixed',
  languageBanks: {},
  modeBanks: { ...EMPTY_MODE_BANKS },
  activeVocabBank: [],
  wordStats: {},
  wordFrequencySettings: {},
  sessionCardIndex: 0,
  languagePools: {},
  defaultPoolIds: { ...EMPTY_DEFAULT_POOL_IDS },
};

function syncModeBank(
  state: AppState,
  bank: VocabItem[],
  wordFrequencySettings: Record<string, WordFrequencySetting>,
): AppState {
  if (!state.studyTypeSelected) {
    return { ...state, activeVocabBank: bank, wordFrequencySettings };
  }

  const modeBank: ModeBankData = { activeVocabBank: bank, wordFrequencySettings };
  const modeBanks = {
    ...state.modeBanks,
    [state.studyTypeSelected]: modeBank,
  };
  // Mirror the active language's banks into the per-language map so they
  // survive language switches and are persisted per language.
  const languageBanks: LanguageBanks = state.languageSelected
    ? { ...state.languageBanks, [state.languageSelected]: modeBanks }
    : state.languageBanks;

  return {
    ...state,
    activeVocabBank: bank,
    wordFrequencySettings,
    modeBanks,
    languageBanks,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };

    case 'SELECT_LANGUAGE': {
      // Fold the outgoing language's banks into the per-language map, then
      // restore whatever was previously saved for the incoming language.
      const languageBanks: LanguageBanks = state.languageSelected
        ? { ...state.languageBanks, [state.languageSelected]: state.modeBanks }
        : state.languageBanks;
      const restored = languageBanks[action.language] ?? { ...EMPTY_MODE_BANKS };

      return {
        ...initialState,
        languageSelected: action.language,
        directionMode: state.directionMode,
        languageBanks,
        modeBanks: { ...restored },
        // Preserve pool data — it is per-language and must not be wiped on switch
        languagePools: state.languagePools,
        defaultPoolIds: state.defaultPoolIds,
      };
    }

    case 'SET_VOCAB_BANK': {
      const frequencySettings =
        action.frequencySettings ?? buildFrequencySettings(action.bank);
      // Prefer the studyType carried in the action (supplied by list-setup) so that
      // syncModeBank can correctly write to modeBanks[studyType] even when the
      // SELECT_STUDY_TYPE dispatch hasn't committed to the reducer state yet.
      const effectiveStudyType = action.studyType ?? state.studyTypeSelected;
      const stateForSync: AppState = effectiveStudyType
        ? { ...state, studyTypeSelected: effectiveStudyType }
        : state;
      const synced: AppState = {
        ...syncModeBank(stateForSync, action.bank, frequencySettings),
        wordStats: {},
        sessionCardIndex: 0,
      };

      // Keep languagePools in sync so My Lists screen always reflects the
      // current banks without requiring an app restart to trigger migration.
      if (synced.languageSelected && effectiveStudyType) {
        const lang = synced.languageSelected;
        const existingPools = synced.languagePools[lang] ?? [];
        const existingDefaultIds =
          synced.defaultPoolIds[effectiveStudyType]?.[lang] ?? [];
        const existingPool = existingPools.find(p =>
          existingDefaultIds.includes(p.id),
        );

        const poolWords: PoolWord[] = action.bank.map(item => ({
          item,
          frequency:
            (frequencySettings[item.id] as PoolWord['frequency']) ?? 'normal',
        }));

        if (existingPool) {
          // Update the existing default pool's word list in-place
          const updatedPool: Pool = {
            ...existingPool,
            words: poolWords,
            deckSize: snapToDeckSize(action.bank.length),
          };
          return {
            ...synced,
            languagePools: {
              ...synced.languagePools,
              [lang]: existingPools.map(p =>
                p.id === existingPool.id ? updatedPool : p,
              ),
            },
          };
        } else {
          // No default pool yet — create one
          const poolName =
            effectiveStudyType === 'general_vocab' ? 'List 1' : 'List 1 (Gender)';
          const newPool: Pool = {
            id: generatePoolId(),
            name: poolName,
            language: lang,
            words: poolWords,
            deckSize: snapToDeckSize(action.bank.length),
            createdVia: 'custom',
            pausedWordIds: [],
          };
          return {
            ...synced,
            languagePools: {
              ...synced.languagePools,
              [lang]: [...existingPools, newPool],
            },
            defaultPoolIds: {
              ...synced.defaultPoolIds,
              [effectiveStudyType]: {
                ...(synced.defaultPoolIds[effectiveStudyType] ?? {}),
                [lang]: [newPool.id],
              },
            },
          };
        }
      }

      return synced;
    }

    case 'SELECT_STUDY_TYPE': {
      const modeBank = state.modeBanks[action.studyType];
      return {
        ...state,
        studyTypeSelected: action.studyType,
        activeVocabBank: modeBank?.activeVocabBank ?? [],
        wordFrequencySettings: modeBank?.wordFrequencySettings ?? {},
        wordStats: {},
        sessionCardIndex: 0,
      };
    }

    case 'SET_DIRECTION_MODE':
      return { ...state, directionMode: action.mode };

    case 'RECORD_CARD_RESULT': {
      const existing = getOrInitStats(state.wordStats, action.vocabId);
      const updated = updateStatsAfterCard(existing, action.correct, state.sessionCardIndex);
      return {
        ...state,
        wordStats: { ...state.wordStats, [action.vocabId]: updated },
      };
    }

    case 'INCREMENT_CARD_INDEX':
      return { ...state, sessionCardIndex: state.sessionCardIndex + 1 };

    case 'REMOVE_FROM_BANK': {
      const bank = state.activeVocabBank.filter(w => w.id !== action.vocabId);
      const { [action.vocabId]: _removed, ...remainingSettings } = state.wordFrequencySettings;
      const { [action.vocabId]: _stats, ...remainingStats } = state.wordStats;
      return {
        ...syncModeBank(state, bank, remainingSettings),
        wordStats: remainingStats,
      };
    }

    case 'SET_WORD_FREQUENCY': {
      const wordFrequencySettings = {
        ...state.wordFrequencySettings,
        [action.vocabId]: action.setting,
      };
      return syncModeBank(state, state.activeVocabBank, wordFrequencySettings);
    }

    case 'ADD_WORD_TO_MASTER': {
      const alreadyIn = state.activeVocabBank.some(
        w =>
          w.id === action.item.id ||
          w.lemma.toLowerCase() === action.item.lemma.toLowerCase(),
      );
      if (alreadyIn) return state;
      addUserWord(action.item);
      const bank = [...state.activeVocabBank, action.item];
      const wordFrequencySettings = {
        ...state.wordFrequencySettings,
        [action.item.id]: 'normal' as WordFrequencySetting,
      };
      return syncModeBank(state, bank, wordFrequencySettings);
    }

    case 'RESET_SESSION':
      return {
        ...state,
        studyTypeSelected: null,
        sessionCardIndex: 0,
      };

    case 'RESET_APP':
      // Full fresh-install state: no language, no banks anywhere.
      return {
        ...initialState,
        languageBanks: {},
        modeBanks: { ...EMPTY_MODE_BANKS },
        languagePools: {},
        defaultPoolIds: { ...EMPTY_DEFAULT_POOL_IDS },
      };

    // ── Pool actions ──────────────────────────────────────────────────────────

    case 'CREATE_POOL': {
      const lang = action.pool.language;
      const existing = state.languagePools[lang] ?? [];
      return {
        ...state,
        languagePools: {
          ...state.languagePools,
          [lang]: [...existing, action.pool],
        },
      };
    }

    case 'UPDATE_POOL': {
      const updated: Partial<Record<Language, Pool[]>> = {};
      for (const [lang, pools] of Object.entries(state.languagePools)) {
        updated[lang as Language] = (pools ?? []).map(p =>
          p.id === action.poolId ? { ...p, ...action.updates } : p,
        );
      }
      return { ...state, languagePools: { ...state.languagePools, ...updated } };
    }

    case 'DELETE_POOL': {
      const existing = state.languagePools[action.language] ?? [];
      return {
        ...state,
        languagePools: {
          ...state.languagePools,
          [action.language]: existing.filter(p => p.id !== action.poolId),
        },
      };
    }

    case 'SET_DEFAULT_POOL': {
      return {
        ...state,
        defaultPoolIds: {
          ...state.defaultPoolIds,
          [action.studyType]: {
            ...(state.defaultPoolIds[action.studyType] ?? {}),
            [action.language]: action.poolIds,
          },
        },
      };
    }

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  isReady: boolean;
  showLanguagePicker: boolean;
  requestLanguageChange: () => void;
  selectLanguage: (language: Language) => void;
  setVocabBank: (bank: VocabItem[], frequencySettings?: Record<string, WordFrequencySetting>, studyType?: StudyType) => void;
  selectStudyType: (studyType: StudyType) => void;
  setDirectionMode: (mode: DirectionMode) => void;
  recordCardResult: (vocabId: string, correct: boolean) => void;
  incrementCardIndex: () => void;
  removeFromBank: (vocabId: string) => void;
  setWordFrequency: (vocabId: string, setting: WordFrequencySetting) => void;
  addWordToMaster: (item: VocabItem) => void;
  resetSession: () => void;
  /** Dev/testing: returns the app to a pristine fresh-install state. */
  resetApp: () => void;
  hasModeBank: (studyType: StudyType) => boolean;
  getModeBank: (studyType: StudyType) => ModeBankData | null;
  // ── Pool API ───────────────────────────────────────────────────────────────
  createPool: (pool: Pool) => void;
  updatePool: (poolId: string, updates: Partial<Omit<Pool, 'id' | 'language'>>) => void;
  deletePool: (poolId: string, language: Language) => void;
  setDefaultPool: (studyType: StudyType, language: Language, poolIds: string[]) => void;
  getLanguagePools: (language: Language) => Pool[];
  getDefaultPools: (studyType: StudyType, language: Language) => Pool[];
}

const AppContext = createContext<AppContextValue | null>(null);

function toPersistedPayload(state: AppState) {
  if (!state.languageSelected) return null;
  return {
    selectedLanguage: state.languageSelected,
    languageBanks: {
      ...state.languageBanks,
      // Always include the active language's latest banks
      [state.languageSelected]: state.modeBanks,
    },
    directionMode: state.directionMode,
    onboardingComplete: true as const,
    // ── Pools (new source of truth) ──────────────────────────────────────────
    languagePools: state.languagePools,
    defaultPoolIds: state.defaultPoolIds,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isReady, setIsReady] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    loadPersistedState().then(stored => {
      console.log('[AppContext] loadPersistedState result:', JSON.stringify(stored, null, 2));
      if (stored) {
        dispatch({
          type: 'HYDRATE',
          payload: {
            languageSelected: stored.selectedLanguage,
            languageBanks: stored.languageBanks,
            modeBanks:
              stored.languageBanks[stored.selectedLanguage] ?? { ...EMPTY_MODE_BANKS },
            directionMode: stored.directionMode,
            activeVocabBank: [],
            wordFrequencySettings: {},
            languagePools: stored.languagePools,
            defaultPoolIds: stored.defaultPoolIds,
          },
        });
      }
      hasHydrated.current = true;
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated.current || !isReady) return;
    const payload = toPersistedPayload(state);
    if (payload) savePersistedState(payload);
  }, [
    isReady,
    state.languageSelected,
    state.languageBanks,
    state.modeBanks,
    state.directionMode,
    state.languagePools,
    state.defaultPoolIds,
  ]);

  const requestLanguageChange = useCallback(() => {
    setShowLanguagePicker(true);
  }, []);

  const selectLanguage = useCallback((language: Language) => {
    // Do NOT clear persisted state here — each language's banks are kept in
    // the per-language map and restored when the user switches back.
    setShowLanguagePicker(false);
    dispatch({ type: 'SELECT_LANGUAGE', language });
  }, []);

  const setVocabBank = useCallback(
    (bank: VocabItem[], frequencySettings?: Record<string, WordFrequencySetting>, studyType?: StudyType) =>
      dispatch({ type: 'SET_VOCAB_BANK', bank, frequencySettings, studyType }),
    [],
  );

  const selectStudyType = useCallback(
    (studyType: StudyType) => dispatch({ type: 'SELECT_STUDY_TYPE', studyType }),
    [],
  );

  const setDirectionMode = useCallback(
    (mode: DirectionMode) => dispatch({ type: 'SET_DIRECTION_MODE', mode }),
    [],
  );

  const recordCardResult = useCallback(
    (vocabId: string, correct: boolean) =>
      dispatch({ type: 'RECORD_CARD_RESULT', vocabId, correct }),
    [],
  );

  const incrementCardIndex = useCallback(
    () => dispatch({ type: 'INCREMENT_CARD_INDEX' }),
    [],
  );

  const removeFromBank = useCallback(
    (vocabId: string) => dispatch({ type: 'REMOVE_FROM_BANK', vocabId }),
    [],
  );

  const setWordFrequency = useCallback(
    (vocabId: string, setting: WordFrequencySetting) =>
      dispatch({ type: 'SET_WORD_FREQUENCY', vocabId, setting }),
    [],
  );

  const addWordToMaster = useCallback(
    (item: VocabItem) => dispatch({ type: 'ADD_WORD_TO_MASTER', item }),
    [],
  );

  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);

  const resetApp = useCallback(() => dispatch({ type: 'RESET_APP' }), []);

  const checkHasModeBank = useCallback(
    (studyType: StudyType) => hasModeBank(state.modeBanks, studyType),
    [state.modeBanks],
  );

  const getModeBank = useCallback(
    (studyType: StudyType) => state.modeBanks[studyType],
    [state.modeBanks],
  );

  // ── Pool callbacks ─────────────────────────────────────────────────────────

  const createPool = useCallback(
    (pool: Pool) => dispatch({ type: 'CREATE_POOL', pool }),
    [],
  );

  const updatePool = useCallback(
    (poolId: string, updates: Partial<Omit<Pool, 'id' | 'language'>>) =>
      dispatch({ type: 'UPDATE_POOL', poolId, updates }),
    [],
  );

  const deletePool = useCallback(
    (poolId: string, language: Language) =>
      dispatch({ type: 'DELETE_POOL', poolId, language }),
    [],
  );

  const setDefaultPool = useCallback(
    (studyType: StudyType, language: Language, poolIds: string[]) =>
      dispatch({ type: 'SET_DEFAULT_POOL', studyType, language, poolIds }),
    [],
  );

  const getLanguagePools = useCallback(
    (language: Language): Pool[] => state.languagePools[language] ?? [],
    [state.languagePools],
  );

  const getDefaultPools = useCallback(
    (studyType: StudyType, language: Language): Pool[] => {
      const ids = state.defaultPoolIds[studyType]?.[language] ?? [];
      const pools = state.languagePools[language] ?? [];
      return ids.flatMap(id => pools.filter(p => p.id === id));
    },
    [state.languagePools, state.defaultPoolIds],
  );

  return (
    <AppContext.Provider
      value={{
        state,
        isReady,
        showLanguagePicker,
        requestLanguageChange,
        selectLanguage,
        setVocabBank,
        selectStudyType,
        setDirectionMode,
        recordCardResult,
        incrementCardIndex,
        removeFromBank,
        setWordFrequency,
        addWordToMaster,
        resetSession,
        resetApp,
        hasModeBank: checkHasModeBank,
        getModeBank,
        createPool,
        updatePool,
        deletePool,
        setDefaultPool,
        getLanguagePools,
        getDefaultPools,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
