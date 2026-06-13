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
  | { type: 'RESET_APP' };

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
      return {
        ...syncModeBank(stateForSync, action.bank, frequencySettings),
        wordStats: {},
        sessionCardIndex: 0,
      };
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
      };

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
  }, [isReady, state.languageSelected, state.languageBanks, state.modeBanks, state.directionMode]);

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
