import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useAppContext } from './AppContext';
import { normalizeFrequencySetting, type WordFrequencySetting } from '../types/state';
import type { Language } from '../types/vocab';
import type { PoolWord } from '../types/pool';

interface SessionWordMgmtContextValue {
  getFrequency: (vocabId: string) => WordFrequencySetting;
  setFrequency: (vocabId: string, frequency: WordFrequencySetting) => void;
}

const SessionWordMgmtContext = createContext<SessionWordMgmtContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  language: Language;
  poolIds: string[];
}

export function SessionWordMgmtProvider({
  children,
  language,
  poolIds,
}: ProviderProps) {
  const { state, updatePool, setWordFrequency, getLanguagePools } = useAppContext();

  const sessionPools = useMemo(
    () =>
      poolIds.length > 0
        ? getLanguagePools(language).filter(p => poolIds.includes(p.id))
        : [],
    [poolIds, language, getLanguagePools, state.languagePools],
  );

  const getFrequency = useCallback(
    (vocabId: string): WordFrequencySetting => {
      if (sessionPools.length > 0) {
        for (const pool of sessionPools) {
          const pw = pool.words.find((w: PoolWord) => w.item.id === vocabId);
          if (pw) return pw.frequency as WordFrequencySetting;
        }
      }
      return normalizeFrequencySetting(state.wordFrequencySettings[vocabId]);
    },
    [sessionPools, state.wordFrequencySettings],
  );

  const setFrequency = useCallback(
    (vocabId: string, frequency: WordFrequencySetting) => {
      if (sessionPools.length > 0) {
        for (const pool of sessionPools) {
          if (!pool.words.some(pw => pw.item.id === vocabId)) continue;
          const updatedWords: PoolWord[] = pool.words.map(pw =>
            pw.item.id === vocabId
              ? { ...pw, frequency: frequency as PoolWord['frequency'] }
              : pw,
          );
          updatePool(pool.id, { words: updatedWords });
        }
        return;
      }
      setWordFrequency(vocabId, frequency);
    },
    [sessionPools, updatePool, setWordFrequency],
  );

  const value = useMemo(
    () => ({ getFrequency, setFrequency }),
    [getFrequency, setFrequency],
  );

  return (
    <SessionWordMgmtContext.Provider value={value}>
      {children}
    </SessionWordMgmtContext.Provider>
  );
}

export function useSessionWordMgmt(): SessionWordMgmtContextValue {
  const ctx = useContext(SessionWordMgmtContext);
  if (!ctx) {
    throw new Error('useSessionWordMgmt must be used inside SessionWordMgmtProvider');
  }
  return ctx;
}
