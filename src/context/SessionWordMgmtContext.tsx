import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useAppContext } from './AppContext';
import type { WordFrequencySetting } from '../types/state';
import type { Language, VocabItem } from '../types/vocab';
import type { PoolWord } from '../types/pool';
import { enrichVocabItemsFromMaster } from '../data';

export interface ActionResult {
  success: boolean;
  error?: string;
}

interface SessionWordMgmtContextValue {
  getFrequency: (vocabId: string) => WordFrequencySetting;
  setFrequency: (vocabId: string, frequency: WordFrequencySetting) => void;
  removeWord: (vocabId: string) => void;
  replaceWord: (vocabId: string) => ActionResult;
  pauseWord: (vocabId: string) => ActionResult;
}

const SessionWordMgmtContext = createContext<SessionWordMgmtContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  language: Language;
  poolIds: string[];
  /** IDs of words currently in the active session deck. */
  getSessionDeckIds: () => ReadonlySet<string>;
  onWordRemoved?: (vocabId: string) => void;
  onWordReplaced?: (
    oldVocabId: string,
    newItem: VocabItem,
    frequency: WordFrequencySetting,
  ) => void;
}

export function SessionWordMgmtProvider({
  children,
  language,
  poolIds,
  getSessionDeckIds,
  onWordRemoved,
  onWordReplaced,
}: ProviderProps) {
  const { updatePool, getLanguagePools } = useAppContext();

  const sessionPools = useMemo(
    () =>
      poolIds.length > 0
        ? getLanguagePools(language).filter(p => poolIds.includes(p.id))
        : [],
    [poolIds, language, getLanguagePools],
  );

  const getFrequency = useCallback(
    (vocabId: string): WordFrequencySetting => {
      for (const pool of sessionPools) {
        const pw = pool.words.find((w: PoolWord) => w.item.id === vocabId);
        if (pw) return pw.frequency as WordFrequencySetting;
      }
      return 'normal';
    },
    [sessionPools],
  );

  const setFrequency = useCallback(
    (vocabId: string, frequency: WordFrequencySetting) => {
      for (const pool of sessionPools) {
        if (!pool.words.some(pw => pw.item.id === vocabId)) continue;
        const updatedWords: PoolWord[] = pool.words.map(pw =>
          pw.item.id === vocabId
            ? { ...pw, frequency: frequency as PoolWord['frequency'] }
            : pw,
        );
        updatePool(pool.id, { words: updatedWords });
      }
    },
    [sessionPools, updatePool],
  );

  const removeWord = useCallback(
    (vocabId: string) => {
      onWordRemoved?.(vocabId);
    },
    [onWordRemoved],
  );

  const replaceWord = useCallback(
    (vocabId: string): ActionResult => {
      const sessionDeckIds = getSessionDeckIds();
      if (!sessionDeckIds.has(vocabId)) {
        return { success: false, error: 'This word is not in your current session deck.' };
      }

      const candidates: { item: VocabItem; frequency: WordFrequencySetting }[] = [];
      const seenCandidateIds = new Set<string>();

      for (const pool of sessionPools) {
        const pausedIds = new Set(pool.pausedWordIds ?? []);
        for (const pw of pool.words) {
          if (pausedIds.has(pw.item.id)) continue;
          if (
            !seenCandidateIds.has(pw.item.id) &&
            !sessionDeckIds.has(pw.item.id)
          ) {
            seenCandidateIds.add(pw.item.id);
            candidates.push({
              item: pw.item,
              frequency: pw.frequency as WordFrequencySetting,
            });
          }
        }
      }

      if (candidates.length === 0) {
        return {
          success: false,
          error: 'No other words in your pool are available to swap in.',
        };
      }

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const [enriched] = enrichVocabItemsFromMaster([pick.item], language);

      onWordReplaced?.(vocabId, enriched, pick.frequency);
      return { success: true };
    },
    [getSessionDeckIds, sessionPools, language, onWordReplaced],
  );

  const pauseWord = useCallback(
    (vocabId: string): ActionResult => {
      if (sessionPools.length === 0) {
        return {
          success: false,
          error: 'Pause is only available when studying from a pool.',
        };
      }

      const poolsWithWord = sessionPools.filter(pool =>
        pool.words.some(pw => pw.item.id === vocabId),
      );
      if (poolsWithWord.length === 0) {
        return { success: false, error: 'This word is not in your pool.' };
      }

      for (const pool of poolsWithWord) {
        if (!pool.pausedWordIds.includes(vocabId)) {
          updatePool(pool.id, {
            pausedWordIds: [...pool.pausedWordIds, vocabId],
          });
        }
      }

      onWordRemoved?.(vocabId);
      return { success: true };
    },
    [sessionPools, updatePool, onWordRemoved],
  );

  const value = useMemo(
    () => ({ getFrequency, setFrequency, removeWord, replaceWord, pauseWord }),
    [getFrequency, setFrequency, removeWord, replaceWord, pauseWord],
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
