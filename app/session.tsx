/**
 * SCREEN 0104 — STUDY SESSION ENGINE
 * Infinite study loop: generates cards, delivers them, updates repetition state.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
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
import { WordMgmtConfirmHost } from '@/src/components/ui/WordMgmtStrip';
import {
  ensureLanguageStatsLoaded,
  saveWordStats,
  incrementDailyCardCountInMemory,
  incrementStudyDayCount,
  type LangStats,
  type DailyCardCounts,
} from '@/src/storage/statsStorage';
import { enrichVocabItemsFromMaster } from '@/src/data';
import { parsePoolIdsParam } from '@/src/utils/studyLaunch';
import { saveSavedDeck } from '@/src/storage/savedDecks';
import { saveListDeck } from '@/src/storage/listDecks';
import { getDeckSizePref } from '@/src/storage/deckSizePrefs';
import { drawSizedListDeck, eligibleStudyWords, resolveRedrawCount } from '@/src/utils/listDeckLaunch';
import { loadCardFrequency } from '@/src/storage/cardFrequency';
import { updateWordStats } from '@/src/types/stats';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const SCREEN_WIDTH = Dimensions.get('window').width;

type DeckNotice = 'small' | 'empty' | 'no-words';

function DeckNoticeDialog({
  notice,
  wordCount,
  onKeep,
  onNewDeck,
  onExit,
}: {
  notice: DeckNotice;
  wordCount: number;
  onKeep: () => void;
  onNewDeck: () => void;
  onExit: () => void;
}) {
  const blocking = notice !== 'small';
  const wordLabel = wordCount === 1 ? 'word' : 'words';
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={blocking ? () => {} : onKeep}
    >
      <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogOverlay}>
        <Pressable
          style={styles.dialogBackdrop}
          onPress={blocking ? () => {} : onKeep}
        >
          <Pressable style={styles.dialogSheet} onPress={() => {}}>
            {notice === 'no-words' ? (
              <Text style={styles.dialogMessage}>
                This list has no words available. Add words in My Lists.
              </Text>
            ) : (
              <View style={styles.dialogCopy}>
                <Text style={styles.dialogTitle}>
                  {notice === 'small' ? 'Your Deck Is Small' : 'Your Deck Is Empty'}
                </Text>
                <Text style={styles.dialogMessage}>
                  {notice === 'small'
                    ? `Your deck has only ${wordCount} ${wordLabel}, so words will repeat often. Add words or start a new deck.`
                    : "You've removed every word from this deck. Start a new deck to keep studying."}
                </Text>
              </View>
            )}
            <View style={styles.dialogActions}>
              {notice === 'small' ? (
                <TouchableOpacity style={styles.dialogOutline} onPress={onKeep} activeOpacity={0.75}>
                  <Text style={styles.dialogOutlineLabel}>Keep Studying</Text>
                </TouchableOpacity>
              ) : null}
              {notice !== 'no-words' ? (
                <TouchableOpacity style={styles.dialogFilled} onPress={onNewDeck} activeOpacity={0.75}>
                  <Text style={styles.dialogFilledLabel}>New Deck</Text>
                </TouchableOpacity>
              ) : null}
              {notice === 'empty' ? (
                <TouchableOpacity style={styles.dialogOutline} onPress={onExit} activeOpacity={0.75}>
                  <Text style={styles.dialogOutlineLabel}>Exit Study</Text>
                </TouchableOpacity>
              ) : null}
              {notice === 'no-words' ? (
                <TouchableOpacity style={styles.dialogOutline} onPress={onExit} activeOpacity={0.75}>
                  <Text style={styles.dialogOutlineLabel}>Exit Study</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

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
  const navigation = useNavigation();
  const { state, recordCardResult, incrementCardIndex, getLanguagePools } = useAppContext();
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
  const cardKeyRef = useRef('');
  const countedCardKeyRef = useRef<string | null>(null);
  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [deckNotice, setDeckNotice] = useState<DeckNotice | null>(null);
  const [smallDeckCount, setSmallDeckCount] = useState(0);

  const language = state.languageSelected;

  // ── Pool-derived session vocab ─────────────────────────────────────────────
  // Pool IDs are passed via navigation params from select-study-list / deck-size.

  const { poolIds: poolIdsParam, deckSize: deckSizeParam, deckIds: deckIdsParam } =
    useLocalSearchParams<{ poolIds?: string; deckSize?: string; deckIds?: string }>();

  const poolIds = useMemo<string[]>(
    () => parsePoolIdsParam(poolIdsParam),
    [poolIdsParam],
  );

  const explicitDeckIds = useMemo<string[]>(
    () => parsePoolIdsParam(deckIdsParam),
    [deckIdsParam],
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
    const byId = new Map(enrichedBank.map(word => [word.id, word]));
    const resumed = explicitDeckIds.flatMap(id => {
      const word = byId.get(id);
      return word ? [word] : [];
    });
    const explicitDeckRequested =
      (typeof deckIdsParam === 'string' && deckIdsParam.trim().startsWith('[')) ||
      (Array.isArray(deckIdsParam) &&
        deckIdsParam.some(value => value.trim().startsWith('[')));
    const vocabBank = explicitDeckRequested
      ? resumed
      : !isNaN(deckSize) && deckSize > 0 && deckSize < enrichedBank.length
        ? selectSessionSubset(enrichedBank, deckSize, settings)
        : enrichedBank;

    return { vocabBank, wordFrequencySettings: settings };
  }, [language, poolIds, state.languagePools, deckSizeParam, deckIdsParam, explicitDeckIds]);

  const deckSavedRef = useRef(false);
  const replacementDeckRef = useRef<SessionVocabContext | null>(null);
  const smallWarnedRef = useRef(false);
  const blockingNoticeRef = useRef(false);
  const smallNoticeRef = useRef(false);
  useEffect(() => {
    if (!language || !baseSessionVocab || deckSavedRef.current) return;
    deckSavedRef.current = true;
    const studyType = state.studyTypeSelected ?? 'general_vocab';
    const deckWordIds = baseSessionVocab.vocabBank.map(word => word.id);
    void saveSavedDeck(language, studyType, poolIds, deckWordIds);
    if (poolIds.length === 1) {
      void saveListDeck(language, studyType, poolIds[0], deckWordIds);
    }
  }, [language, baseSessionVocab, poolIds, state.studyTypeSelected]);

  const getSessionVocab = useCallback((): SessionVocabContext | null => {
    const source = replacementDeckRef.current ?? baseSessionVocab;
    if (!source) return null;

    let vocabBank = source.vocabBank.filter(
      w => !sessionRemovedIdsRef.current.has(w.id),
    );
    let wordFrequencySettings = Object.fromEntries(
      Object.entries(source.wordFrequencySettings).filter(
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

  const persistSingleListDeck = useCallback(() => {
    if (!language || poolIds.length !== 1) return;
    const studyType = state.studyTypeSelected ?? 'general_vocab';
    void saveListDeck(language, studyType, poolIds[0], [...getSessionDeckIds()]);
  }, [language, poolIds, state.studyTypeSelected, getSessionDeckIds]);

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
    let cancelled = false;
    loadCardFrequency().finally(() => {
      if (!cancelled) loadCard();
    });
    return () => {
      cancelled = true;
    };
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
  // The view then waits off the right edge until the new card is committed.
  // Phase 2 (150 ms): that committed card sweeps to centre.
  const sweepX = useSharedValue(0);
  const transitioningRef = useRef(false);
  const awaitingFromKeyRef = useRef<string | null>(null);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionCardKey = currentCard
    ? getCardKey(currentCard, state.sessionCardIndex)
    : '';

  const cardSlideStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: sweepX.value }],
  }));

  const handleNext = useCallback(() => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    sweepX.value = withTiming(-SCREEN_WIDTH, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });
    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = setTimeout(() => {
      sweepX.value = SCREEN_WIDTH;
      awaitingFromKeyRef.current = cardKeyRef.current;
      loadNextCard();
    }, 145);
  }, [loadNextCard, sweepX]);

  useEffect(() => {
    return () => {
      if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (awaitingFromKeyRef.current === null) return;
    if (!transitionCardKey || transitionCardKey === awaitingFromKeyRef.current) {
      sweepX.value = 0;
      awaitingFromKeyRef.current = null;
      transitioningRef.current = false;
      return;
    }
    awaitingFromKeyRef.current = null;
    sweepX.value = SCREEN_WIDTH;
    sweepX.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      transitioningRef.current = false;
    }, 150);
  }, [transitionCardKey, sweepX]);

  const handleWordRemoved = useCallback(
    (vocabId: string) => {
      const before = getSessionDeckIds().size;
      sessionRemovedIdsRef.current.add(vocabId);
      sessionRef.current = {
        ...sessionRef.current,
        deck: sessionRef.current.deck.filter(id => id !== vocabId),
        deckBankHash: '',
      };
      persistSingleListDeck();
      const after = getSessionDeckIds().size;
      if (poolIds.length === 1 && after !== before) {
        if (after >= 5) {
          smallWarnedRef.current = false;
        } else if (after === 0) {
          setDeckNotice('empty');
          return;
        } else if (before >= 5 && !smallWarnedRef.current) {
          smallWarnedRef.current = true;
          setSmallDeckCount(after);
          setDeckNotice('small');
        }
      }
      handleNext();
    },
    [handleNext, persistSingleListDeck, getSessionDeckIds, poolIds.length],
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
      persistSingleListDeck();
      handleNext();
    },
    [handleNext, persistSingleListDeck],
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

      if (language) {
        const key = cardKeyRef.current;
        if (key && countedCardKeyRef.current !== key) {
          countedCardKeyRef.current = key;
          const lang = language;
          statsSaveChainRef.current = statsSaveChainRef.current
            .then(() => incrementStudyDayCount(lang))
            .catch(err => {
              console.error('[SessionScreen] study day save failed', err);
            });
        }
      }

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

  const handleRedrawDeck = useCallback(async () => {
    if (!language || poolIds.length !== 1) {
      setDeckNotice('no-words');
      return;
    }
    const studyType = state.studyTypeSelected ?? 'general_vocab';
    const pool = getLanguagePools(language).find(item => item.id === poolIds[0]);
    if (!pool) {
      setDeckNotice('no-words');
      return;
    }
    let requested = pool.deckSize;
    try {
      const saved = await getDeckSizePref(language, studyType, [pool.id]);
      if (saved !== null) requested = saved;
    } catch {
      // Keep the size stored on the list.
    }
    const eligible = eligibleStudyWords(pool, studyType);
    const count = resolveRedrawCount(requested, eligible.length);
    const ids = count > 0 ? drawSizedListDeck(pool, studyType, count) : [];
    const byId = new Map(pool.words.map(pw => [pw.item.id, pw]));
    const items = ids.flatMap(id => {
      const word = byId.get(id);
      return word ? [word.item] : [];
    });
    if (items.length === 0) {
      setDeckNotice('no-words');
      return;
    }
    const enriched = enrichVocabItemsFromMaster(items, language);
    const settings: Record<string, WordFrequencySetting> = {};
    for (const item of enriched) {
      const word = byId.get(item.id);
      if (word) settings[item.id] = word.frequency;
    }
    replacementDeckRef.current = {
      vocabBank: enriched,
      wordFrequencySettings: settings,
    };
    sessionRemovedIdsRef.current = new Set();
    sessionAddedWordsRef.current = new Map();
    sessionRef.current = makeSessionState();
    if (enriched.length >= 5) smallWarnedRef.current = false;
    void saveListDeck(language, studyType, pool.id, enriched.map(word => word.id));
    setDeckNotice(null);
    loadCard();
  }, [language, poolIds, state.studyTypeSelected, getLanguagePools, loadCard]);

  const handleExit = useCallback(() => {
    const exitTarget = {
      pathname: '/select-study-list' as const,
      params: { fromExit: '1' },
    };
    const state = navigation.getState();
    const listIndex = state?.routes.findIndex(route => route.name === 'select-study-list') ?? -1;

    if (!state || listIndex < 0 || listIndex >= state.index) {
      router.replace(exitTarget);
      return;
    }

    // Choose What to Study is already underneath. Return to that one screen
    // instead of stacking a second copy on top of the session.
    navigation.dispatch(stackState => {
      const index = stackState.routes.findIndex(route => route.name === 'select-study-list');
      const kept = index >= 0 ? stackState.routes[index] : undefined;
      const routes = kept
        ? [
            ...stackState.routes.slice(0, index),
            { ...kept, params: { ...kept.params, fromExit: '1' } },
          ]
        : [
            ...stackState.routes.slice(0, stackState.index),
            { name: 'select-study-list', params: { fromExit: '1' } },
          ];
      return CommonActions.reset({
        ...stackState,
        routes,
        index: routes.length - 1,
      });
    });
  }, [navigation, router]);

  useAndroidBackHandler(
    useCallback(() => {
      if (blockingNoticeRef.current) return true;
      if (smallNoticeRef.current) {
        setDeckNotice(null);
        return true;
      }
      handleExit();
      return true;
    }, [handleExit]),
  );

  const handleHome = useCallback(() => {
    router.replace('/dashboard');
  }, [router]);

  if (!language) {
    return (
      <SafeAreaView style={styles.messageScreen}>
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Session unavailable</Text>
          <Text style={styles.messageBody}>
            No language is selected.
          </Text>
          <StudyButton
            label="Back to Study Menu"
            variant="primary"
            size="medium"
            onPress={handleExit}
            style={styles.primaryBtn}
            textStyle={styles.primaryLabel}
          />
        </View>
      </SafeAreaView>
    );
  }

  const sessionVocab = getSessionVocab();
  const singleList = poolIds.length === 1;
  const liveCount = sessionVocab?.vocabBank.length ?? 0;
  const listPool = language && singleList
    ? (state.languagePools[language] ?? []).find(pool => pool.id === poolIds[0])
    : undefined;
  const noEligibleWords =
    !listPool ||
    !state.studyTypeSelected ||
    eligibleStudyWords(listPool, state.studyTypeSelected).length === 0;
  const showEmptyDeck = singleList && !!state.studyTypeSelected && liveCount === 0;
  blockingNoticeRef.current = showEmptyDeck || deckNotice === 'no-words';
  smallNoticeRef.current = deckNotice === 'small';

  if (showEmptyDeck) {
    return (
      <SafeAreaView style={styles.messageScreen}>
        <DeckNoticeDialog
          notice={deckNotice === 'no-words' || noEligibleWords ? 'no-words' : 'empty'}
          wordCount={0}
          onKeep={() => setDeckNotice(null)}
          onNewDeck={handleRedrawDeck}
          onExit={handleExit}
        />
      </SafeAreaView>
    );
  }

  if (!state.studyTypeSelected || !sessionVocab || liveCount === 0) {
    return (
      <SafeAreaView style={styles.messageScreen}>
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Session unavailable</Text>
          <Text style={styles.messageBody}>
            No vocabulary bank is set up for this study mode.
          </Text>
          <StudyButton
            label="Back to Study Menu"
            variant="primary"
            size="medium"
            onPress={handleExit}
            style={styles.primaryBtn}
            textStyle={styles.primaryLabel}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasAttemptedLoad) {
    return (
      <SafeAreaView style={styles.messageScreen}>
        <View style={styles.messageBox}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={styles.messageBody}>Loading card…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCard) {
    return (
      <SafeAreaView style={styles.messageScreen}>
        <View style={styles.messageBox}>
          <Text style={styles.errorTitle}>
            Could not load card
          </Text>
          <Text style={styles.messageBody}>
            {loadError ?? 'The next study card could not be loaded.'}
          </Text>
          <StudyButton
            label="Try Again"
            variant="primary"
            size="medium"
            onPress={() => loadCard()}
            style={styles.primaryBtn}
            textStyle={styles.primaryLabel}
          />
          <StudyButton
            label="Exit Study"
            variant="secondary"
            size="medium"
            onPress={handleExit}
            style={styles.outlineBtn}
            textStyle={styles.outlineLabel}
          />
        </View>
      </SafeAreaView>
    );
  }

  const cardKey = getCardKey(currentCard, state.sessionCardIndex);
  cardKeyRef.current = cardKey;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'left', 'right']}>
      <WordMgmtConfirmHost>
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
          exitLabel="Exit Study"
        >
          {currentCard.type === 'CARD_1001' && (
            <Card1001
              key={cardKey}
              card={currentCard}
              language={language}
              onNext={handleNext}
              onFlip={() => {
                sessionRef.current = advanceSession(
                  sessionRef.current,
                  'CARD_1001',
                  'neutral',
                  currentCard.nouns.map(n => n.item.id),
                  true,
                );
              }}
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
      </WordMgmtConfirmHost>
      {deckNotice === 'small' || deckNotice === 'no-words' ? (
        <DeckNoticeDialog
          notice={deckNotice}
          wordCount={smallDeckCount}
          onKeep={() => setDeckNotice(null)}
          onNewDeck={handleRedrawDeck}
          onExit={handleExit}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageScreen: { flex: 1, backgroundColor: '#F7F5FD' },
  messageBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  messageTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#F74856',
    textAlign: 'center',
  },
  messageBody: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  primaryBtn: {
    height: 48,
    minWidth: 220,
    paddingVertical: 0,
    borderRadius: 12,
  },
  primaryLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  outlineBtn: {
    width: 220,
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  outlineLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },

  dialogScroll: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  dialogOverlay: { flexGrow: 1 },
  dialogBackdrop: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: 243,
    paddingBottom: 24,
  },
  dialogSheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  dialogCopy: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  dialogTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  dialogMessage: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 14.8,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  dialogActions: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  dialogFilled: {
    width: 220,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5E51A4',
  },
  dialogFilledLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  dialogOutline: {
    width: 220,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dialogOutlineLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
});
