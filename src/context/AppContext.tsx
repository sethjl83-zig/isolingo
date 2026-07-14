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
import type {
  AppState,
  DirectionMode,
  StudyType,
} from '../types/state';
import type { Language } from '../types/vocab';
import type { Pool } from '../types/pool';
import { EMPTY_DEFAULT_POOL_IDS } from '../types/pool';
import { getOrInitStats, updateStatsAfterCard } from '../engines/repetitionEngine';
import { loadPersistedState, savePersistedState } from '../storage/persistedState';

type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'SELECT_LANGUAGE'; language: Language }
  | { type: 'SELECT_STUDY_TYPE'; studyType: StudyType }
  | { type: 'SET_DIRECTION_MODE'; mode: DirectionMode }
  | { type: 'RECORD_CARD_RESULT'; vocabId: string; correct: boolean }
  | { type: 'INCREMENT_CARD_INDEX' }
  | { type: 'RESET_SESSION' }
  | { type: 'RESET_APP' }
  | { type: 'CREATE_POOL'; pool: Pool }
  | { type: 'UPDATE_POOL'; poolId: string; updates: Partial<Omit<Pool, 'id' | 'language'>> }
  | { type: 'DELETE_POOL'; poolId: string; language: Language }
  | { type: 'SET_DEFAULT_POOL'; studyType: StudyType; language: Language; poolIds: string[] };

const initialState: AppState = {
  languageSelected: null,
  studyTypeSelected: null,
  directionMode: 'mixed',
  wordStats: {},
  sessionCardIndex: 0,
  languagePools: {},
  defaultPoolIds: { ...EMPTY_DEFAULT_POOL_IDS },
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };

    case 'SELECT_LANGUAGE':
      return {
        ...initialState,
        languageSelected: action.language,
        directionMode: state.directionMode,
        languagePools: state.languagePools,
        defaultPoolIds: state.defaultPoolIds,
      };

    case 'SELECT_STUDY_TYPE':
      return {
        ...state,
        studyTypeSelected: action.studyType,
        wordStats: {},
        sessionCardIndex: 0,
      };

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

    case 'RESET_SESSION':
      return {
        ...state,
        studyTypeSelected: null,
        sessionCardIndex: 0,
      };

    case 'RESET_APP':
      return {
        ...initialState,
        languagePools: {},
        defaultPoolIds: { ...EMPTY_DEFAULT_POOL_IDS },
      };

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

    case 'SET_DEFAULT_POOL':
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
  selectStudyType: (studyType: StudyType) => void;
  setDirectionMode: (mode: DirectionMode) => void;
  recordCardResult: (vocabId: string, correct: boolean) => void;
  incrementCardIndex: () => void;
  resetSession: () => void;
  /** Dev/testing: returns the app to a pristine fresh-install state. */
  resetApp: () => void;
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
    directionMode: state.directionMode,
    onboardingComplete: true as const,
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
      if (stored) {
        dispatch({
          type: 'HYDRATE',
          payload: {
            languageSelected: stored.selectedLanguage,
            directionMode: stored.directionMode,
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
    state.directionMode,
    state.languagePools,
    state.defaultPoolIds,
  ]);

  const requestLanguageChange = useCallback(() => {
    setShowLanguagePicker(true);
  }, []);

  const selectLanguage = useCallback((language: Language) => {
    setShowLanguagePicker(false);
    dispatch({ type: 'SELECT_LANGUAGE', language });
  }, []);

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

  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);

  const resetApp = useCallback(() => dispatch({ type: 'RESET_APP' }), []);

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
        selectStudyType,
        setDirectionMode,
        recordCardResult,
        incrementCardIndex,
        resetSession,
        resetApp,
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
