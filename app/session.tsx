/**
 * SCREEN 0104 — STUDY SESSION ENGINE
 * Infinite study loop: generates cards, delivers them, updates repetition state.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { WordFrequencySetting } from '@/src/types/state';
import type { VocabItem } from '@/src/types/vocab';
import { generateNextCard, makeSessionState, advanceSession, type SessionVocabContext } from '@/src/engines/sessionEngine';
import { getCard1002PairKey } from '@/src/engines/card1002Engine';
import { selectSessionSubset } from '@/src/engines/repetitionEngine';
import type { CardData } from '@/src/types/cards';
import type { SessionState } from '@/src/engines/sessionEngine';
import Card1001 from '@/src/components/cards/Card1001';
import Card1002 from '@/src/components/cards/Card1002';
import Card1006 from '@/src/components/cards/Card1006';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import StudyButton from '@/src/components/ui/StudyButton';
import { SessionWordMgmtProvider } from '@/src/context/SessionWordMgmtContext';
import {
  ensureLanguageStatsLoaded,
  saveWordStats,
  incrementDailyCardCountInMemory,
  type LangStats,
  type DailyCardCounts,
} from '@/src/storage/statsStorage';
import { enrichVocabItemsFromMaster } from '@/src/data';
import { parsePoolIdsParam } from '@/src/utils/studyLaunch';
import { updateWordStats } from '@/src/types/stats';

const SCREEN_WIDTH = Dimensions.get('window').width;

function getCardKey(card: CardData, index: number): string {
  switch (card.type) {
    case 'CARD_1001':
      return `${index}-1001-${card.nouns.map(n => n.item.id).sort().join('|')}`;
    case 'CARD_1002':
      return `${index}-1002-${card.itemA.id}-${card.itemB.id}`;
    case 'CARD_1006':
      return `${index}-1006-${card.item.id}-${card.direction}`;
  }
}

export default function SessionScreen() {
  const router = useRouter();
  const { state, recordCardResult, incrementCardIndex } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const sessionRef = useRef<SessionState>(makeSessionState());
  const sessionRemovedIdsRef = useRef<Set<string>>(new Set());
  const sessionAddedWordsRef = useRef<
    Map<string, { item: VocabItem; frequency: WordFrequencySetting }>
  >(new Map());
  const statsRef = useRef<LangStats>({});
  const dailyCountsRef = useRef<DailyCardCounts>({});
  const statsSaveChainRef = useRef(Promise.resolve());
  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const language = state.languageSelected;

  // ── Pool-derived session vocab ─────────────────────────────────────────────
  // Pool IDs are passed via navigation params from select-study-list / deck-size.

  const { poolIds: poolIdsParam, deckSize: deckSizeParam } =
    useLocalSearchParams<{ poolIds?: string; deckSize?: string }>();

  const poolIds = useMemo<string[]>(
    () => parsePoolIdsParam(poolIdsParam),
    [poolIdsParam],
  );

  const baseSessionVocab = useMemo<SessionVocabContext | null>(() => {
    if (!language || poolIds.length === 0) return null;

    const selectedPools = (state.languagePools[language] ?? []).filter(p =>
      poolIds.includes(p.id),
    );

    const seenIds = new Set<string>();
    const fullBank: VocabItem[] = [];
    const settings: Record<string, WordFrequencySetting> = {};

    for (const pool of selectedPools) {
      const pausedIds = new Set(pool.pausedWordIds ?? []);
      for (const pw of pool.words) {
        if (pausedIds.has(pw.item.id)) continue;
        if (!seenIds.has(pw.item.id)) {
          seenIds.add(pw.item.id);
          fullBank.push(pw.item);
          settings[pw.item.id] = pw.frequency;
        }
      }
    }

    if (fullBank.length === 0) return null;

    const enrichedBank = enrichVocabItemsFromMaster(fullBank, language);
    const deckSize = deckSizeParam ? parseInt(deckSizeParam, 10) : NaN;
    const vocabBank =
      !isNaN(deckSize) && deckSize > 0 && deckSize < enrichedBank.length
        ? selectSessionSubset(enrichedBank, deckSize, settings)
        : enrichedBank;

    return { vocabBank, wordFrequencySettings: settings };
  }, [language, poolIds, state.languagePools, deckSizeParam]);

  const getSessionVocab = useCallback((): SessionVocabContext | null => {
    if (!baseSessionVocab) return null;

    let vocabBank = baseSessionVocab.vocabBank.filter(
      w => !sessionRemovedIdsRef.current.has(w.id),
    );
    let wordFrequencySettings = Object.fromEntries(
      Object.entries(baseSessionVocab.wordFrequencySettings).filter(
        ([id]) => !sessionRemovedIdsRef.current.has(id),
      ),
    ) as Record<string, WordFrequencySetting>;

    for (const { item, frequency } of sessionAddedWordsRef.current.values()) {
      if (
        !sessionRemovedIdsRef.current.has(item.id) &&
        !vocabBank.some(w => w.id === item.id)
      ) {
        vocabBank = [...vocabBank, item];
        wordFrequencySettings[item.id] = frequency;
      }
    }

    return { vocabBank, wordFrequencySettings };
  }, [baseSessionVocab]);

  const getSessionDeckIds = useCallback((): ReadonlySet<string> => {
    const vocab = getSessionVocab();
    const ids = new Set<string>();
    if (!vocab) return ids;

    for (const w of vocab.vocabBank) {
      if (!sessionRemovedIdsRef.current.has(w.id)) ids.add(w.id);
    }
    for (const { item } of sessionAddedWordsRef.current.values()) {
      if (!sessionRemovedIdsRef.current.has(item.id)) ids.add(item.id);
    }

    return ids;
  }, [getSessionVocab]);

  const loadCard = useCallback(
    (stateOverride?: typeof state) => {
      try {
        setLoadError(null);
        const vocab = getSessionVocab();
        if (!vocab) {
          setLoadError('No vocabulary is available for this session.');
          setCurrentCard(null);
          return;
        }
        const { card, updatedSession } = generateNextCard(
          stateOverride ?? state,
          sessionRef.current,
          vocab,
        );
        // Persist deck advancement even when no card is returned
        sessionRef.current = updatedSession;
        if (!card) {
          setLoadError(
            'No card could be generated. Your vocab bank may be empty or incompatible with this study mode.',
          );
          setCurrentCard(null);
          return;
        }
        setCurrentCard(card);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load the next card.';
        setLoadError(message);
        setCurrentCard(null);
        console.error('[SessionScreen] loadCard', err);
      } finally {
        setHasAttemptedLoad(true);
      }
    },
    [state, getSessionVocab],
  );

  useEffect(() => {
    loadCard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextCard = useCallback(() => {
    incrementCardIndex();
    const updatedState = {
      ...state,
      sessionCardIndex: state.sessionCardIndex + 1,
    };
    loadCard(updatedState);
  }, [state, incrementCardIndex, loadCard]);

  // ── Card sweep transition ─────────────────────────────────────────────────
  // Phase 1 (140 ms): current card sweeps out to the left.
  // Phase 2 (150 ms): new card snaps in from the right and sweeps to centre.
  const sweepX = useSharedValue(0);

  const cardSlideStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: sweepX.value }],
  }));

  const handleNext = useCallback(() => {
    sweepX.value = withTiming(-SCREEN_WIDTH, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });
    setTimeout(() => {
      sweepX.value = SCREEN_WIDTH;   // instant snap: new card starts off-screen right
      loadNextCard();                 // React re-renders new card at SCREEN_WIDTH
      sweepX.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.quad),
      });
    }, 145);
  }, [loadNextCard]);

  const handleWordRemoved = useCallback(
    (vocabId: string) => {
      sessionRemovedIdsRef.current.add(vocabId);
      sessionRef.current = {
        ...sessionRef.current,
        deck: sessionRef.current.deck.filter(id => id !== vocabId),
        deckBankHash: '',
      };
      handleNext();
    },
    [handleNext],
  );

  const handleWordReplaced = useCallback(
    (oldVocabId: string, newItem: VocabItem, frequency: WordFrequencySetting) => {
      sessionRemovedIdsRef.current.add(oldVocabId);
      sessionAddedWordsRef.current.set(newItem.id, { item: newItem, frequency });
      sessionRef.current = {
        ...sessionRef.current,
        deck: [
          ...sessionRef.current.deck.filter(id => id !== oldVocabId),
          newItem.id,
        ],
        deckBankHash: '',
      };
      handleNext();
    },
    [handleNext],
  );

  const handleSubmit = useCallback(
    (
      vocabId: string | null,
      correct: boolean,
      cardType: CardData['type'],
      direction: string,
      isFirstAttempt?: boolean,
      wordIds?: string[],
      card1002PairKey?: string,
    ) => {
      if (vocabId) recordCardResult(vocabId, correct);

      // Resolve the word IDs to track for spacing / session history
      const ids: string[] = wordIds ?? (vocabId ? [vocabId] : []);
      sessionRef.current = advanceSession(
        sessionRef.current,
        cardType,
        direction,
        ids,
        cardType === 'CARD_1001',
        card1002PairKey,
      );

      // Record detailed stats for every resolved Card 1006 result
      if (cardType === 'CARD_1006' && vocabId && language) {
        statsSaveChainRef.current = statsSaveChainRef.current
          .then(async () => {
            const { wordStats, dailyCounts } = await ensureLanguageStatsLoaded(language);
            statsRef.current = { ...wordStats, ...statsRef.current };
            dailyCountsRef.current = { ...dailyCounts, ...dailyCountsRef.current };

            const updated = updateWordStats(
              statsRef.current[vocabId],
              vocabId,
              language,
              correct,
              isFirstAttempt ?? false,
            );
            statsRef.current = { ...statsRef.current, [vocabId]: updated };
            dailyCountsRef.current = incrementDailyCardCountInMemory(dailyCountsRef.current);
            await saveWordStats(language, statsRef.current, dailyCountsRef.current);
          })
          .catch(err => {
            console.error('[SessionScreen] stats save failed', err);
          });
      }
    },
    [recordCardResult, language],
  );

  const handleExit = useCallback(() => {
    router.replace('/select-study-list');
  }, [router]);

  const handleHome = useCallback(() => {
    router.replace('/dashboard');
  }, [router]);

  if (!language) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.messageBox}>
          <Text style={[styles.messageTitle, { color: palette.text }]}>Session unavailable</Text>
          <Text style={[styles.messageBody, { color: palette.subtext }]}>
            No language is selected.
          </Text>
          <StudyButton label="Back to study menu" variant="primary" size="medium" onPress={handleExit} />
        </View>
      </SafeAreaView>
    );
  }

  const sessionVocab = getSessionVocab();
  if (!state.studyTypeSelected || !sessionVocab || sessionVocab.vocabBank.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.messageBox}>
          <Text style={[styles.messageTitle, { color: palette.text }]}>Session unavailable</Text>
          <Text style={[styles.messageBody, { color: palette.subtext }]}>
            No vocabulary bank is set up for this study mode.
          </Text>
          <StudyButton label="Back to study menu" variant="primary" size="medium" onPress={handleExit} />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasAttemptedLoad) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.messageBox}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.messageBody, { color: palette.subtext }]}>Loading card…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.messageBox}>
          <Text style={[styles.messageTitle, { color: palette.incorrect }]}>
            Could not load card
          </Text>
          <Text style={[styles.messageBody, { color: palette.text }]}>
            {loadError ?? 'The next study card could not be loaded.'}
          </Text>
          <StudyButton label="Try again" variant="primary" size="medium" onPress={() => loadCard()} />
          <StudyButton label="Exit study" variant="secondary" size="medium" onPress={handleExit} />
        </View>
      </SafeAreaView>
    );
  }

  const cardKey = getCardKey(currentCard, state.sessionCardIndex);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <SessionWordMgmtProvider
        language={language}
        poolIds={poolIds}
        getSessionDeckIds={getSessionDeckIds}
        onWordRemoved={handleWordRemoved}
        onWordReplaced={handleWordReplaced}
      >
        <Animated.View style={cardSlideStyle}>
        <ErrorBoundary
          key={cardKey}
          resetKeys={[cardKey]}
          title="Card error"
          onReset={loadNextCard}
          onExit={handleExit}
          exitLabel="Exit study"
        >
          {currentCard.type === 'CARD_1001' && (
            <Card1001
              key={cardKey}
              card={currentCard}
              language={language}
              onNext={handleNext}
              onFlip={() => {}}
              onExit={handleExit}
              onHome={handleHome}
              onSubmit={correct =>
                handleSubmit(
                  null,
                  correct,
                  'CARD_1001',
                  'neutral',
                  undefined,
                  currentCard.nouns.map(n => n.item.id),
                )
              }
            />
          )}

          {currentCard.type === 'CARD_1002' && (
            <Card1002
              key={cardKey}
              card={currentCard}
              language={language}
              onNext={handleNext}
              onFlip={() => {}}
              onExit={handleExit}
              onHome={handleHome}
              onSubmit={correct =>
                handleSubmit(
                  null,
                  correct,
                  'CARD_1002',
                  'neutral',
                  undefined,
                  [currentCard.itemA.id, currentCard.itemB.id],
                  getCard1002PairKey(currentCard.itemA, currentCard.itemB),
                )
              }
            />
          )}

          {currentCard.type === 'CARD_1006' && (
            <Card1006
              key={cardKey}
              card={currentCard}
              language={language}
              onNext={handleNext}
              onFlip={() => {}}
              onExit={handleExit}
              onHome={handleHome}
              onSubmit={(correct, isFirstAttempt) =>
                handleSubmit(
                  currentCard.item.id,
                  correct,
                  'CARD_1006',
                  currentCard.direction,
                  isFirstAttempt,
                )
              }
            />
          )}
        </ErrorBoundary>
        </Animated.View>
      </SessionWordMgmtProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  messageTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  messageBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
