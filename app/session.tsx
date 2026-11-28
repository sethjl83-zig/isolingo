/**
 * SCREEN 0104 — STUDY SESSION ENGINE
 * Infinite study loop: generates cards, delivers them, updates repetition state.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, TouchableOpacity, BackHandler, Keyboard, PixelRatio } from 'react-native';
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
import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import type { DirectionMode, WordFrequencySetting } from '@/src/types/state';
import type { VocabItem } from '@/src/types/vocab';
import { getWordLemmaColor } from '@/src/utils/vocabBank';
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
import { drawSizedListDeck, eligibleStudyWords, redrawDeckAvoiding, resolveRedrawCount } from '@/src/utils/listDeckLaunch';
import { loadCardFrequency } from '@/src/storage/cardFrequency';
import { updateWordStats } from '@/src/types/stats';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DECK_SIZE_STEPS = [10, 15, 20, 25] as const;
const checkIcon = require('@/assets/images/lists/check-white.png');

function onScreenWordIds(card: CardData): string[] {
  if (card.type === 'CARD_1001') return card.nouns.map(noun => noun.item.id);
  if (card.type === 'CARD_1002') return [card.itemA.id, card.itemB.id];
  return [card.item.id];
}

function shuffleCopy<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

function wordCountLabel(count: number, capital = false): string {
  const word = count === 1 ? 'word' : 'words';
  return capital ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function DeckOptionsSheet({
  deckLength,
  sizes,
  words,
  lockedIds,
  shrinkSize,
  onGrow,
  onOpenShrink,
  onConfirmShrink,
  onBack,
  onHardwareBack,
  onNewDeck,
  onDismiss,
}: {
  deckLength: number;
  sizes: readonly number[];
  words: VocabItem[];
  lockedIds: ReadonlySet<string>;
  shrinkSize: number | null;
  onGrow: (size: number) => void;
  onOpenShrink: (size: number) => void;
  onConfirmShrink: (ids: string[]) => void;
  onBack: () => void;
  onHardwareBack: () => void;
  onNewDeck: () => void;
  onDismiss: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingGrow, setPendingGrow] = useState<number | null>(null);
  const [discardAction, setDiscardAction] = useState<'back' | 'close' | null>(null);
  const selectedCountRef = useRef(0);
  const discardActionRef = useRef<'back' | 'close' | null>(null);
  selectedCountRef.current = selectedIds.size;
  discardActionRef.current = discardAction;

  const fontScale = PixelRatio.getFontScale();
  const shrinkRowHeight = Math.max(44, 22 * fontScale + 2 + 16 * fontScale);
  const shrinkListHeight = shrinkRowHeight * 5 + 8 * 4;

  useEffect(() => {
    setSelectedIds(new Set());
    setDiscardAction(null);
  }, [shrinkSize]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (discardActionRef.current) {
        setDiscardAction(null);
        return true;
      }
      if (shrinkSize !== null && selectedCountRef.current > 0) {
        setDiscardAction('close');
        return true;
      }
      onHardwareBack();
      return true;
    });
    return () => sub.remove();
  }, [onHardwareBack, shrinkSize]);

  const showSizes = sizes.some(size => size !== deckLength);
  const removeCount = shrinkSize === null ? 0 : deckLength - shrinkSize;
  const selectedCount = selectedIds.size;
  const shrinkReady = shrinkSize !== null && selectedCount === removeCount && removeCount > 0;

  const toggleWord = (id: string) => {
    if (lockedIds.has(id)) return;
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= removeCount) return current;
      next.add(id);
      return next;
    });
  };

  const requestLeave = (action: 'back' | 'close') => {
    if (selectedIds.size > 0) {
      setDiscardAction(action);
      return;
    }
    if (action === 'back') onBack();
    else onDismiss();
  };

  const confirmDiscard = () => {
    const action = discardAction;
    setSelectedIds(new Set());
    setDiscardAction(null);
    if (action === 'back') onBack();
    else onDismiss();
  };

  if (shrinkSize !== null) {
    return (
      <>
      <Pressable style={styles.shrinkScrim} onPress={() => requestLeave('close')}>
        <Pressable style={[styles.dialogSheet, styles.shrinkSheet]} onPress={() => {}}>
          <Text style={styles.dialogTitle}>Choose Words to Remove</Text>
          <Text style={styles.dialogMessage}>
            {`Remove ${removeCount} words to reach ${shrinkSize}.`}
          </Text>
          <ScrollView
            style={[styles.shrinkList, { height: shrinkListHeight, maxHeight: shrinkListHeight }]}
            contentContainerStyle={styles.shrinkListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {words.map(word => {
              const locked = lockedIds.has(word.id);
              const selected = selectedIds.has(word.id);
              const lemmaColor = getWordLemmaColor(word, palette.text, GenderColors);
              return (
                <TouchableOpacity
                  key={word.id}
                  style={[styles.shrinkRow, locked && styles.deckOptionsDisabled]}
                  onPress={() => toggleWord(word.id)}
                  disabled={locked}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: locked }}
                  accessibilityLabel={word.lemma}
                >
                  <View
                    style={[
                      styles.shrinkCheck,
                      selected
                        ? { backgroundColor: palette.teal, borderColor: palette.teal }
                        : { backgroundColor: 'transparent', borderColor: 'rgba(0,0,0,0.2)' },
                    ]}
                  >
                    {selected ? (
                      <Image source={checkIcon} style={styles.shrinkCheckIcon} accessibilityIgnoresInvertColors />
                    ) : null}
                  </View>
                  <View style={styles.shrinkWords}>
                    <Text style={[styles.shrinkLemma, { color: lemmaColor }]}>{word.lemma}</Text>
                    <Text style={styles.shrinkEnglish}>{word.english}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.dialogMessage}>
            {`${selectedCount} of ${removeCount} selected`}
          </Text>
          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={[styles.dialogFilled, !shrinkReady && styles.deckOptionsDisabled]}
              onPress={() => onConfirmShrink([...selectedIds])}
              disabled={!shrinkReady}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ disabled: !shrinkReady }}
            >
              <Text style={styles.dialogFilledLabel}>{`Remove ${removeCount} Words`}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dialogOutline}
              onPress={() => requestLeave('back')}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.dialogOutlineLabel}>Back</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
      {discardAction ? (
        <Pressable
          style={[styles.deckOptionsScrim, styles.discardScrim]}
          onPress={() => setDiscardAction(null)}
        >
          <Pressable style={styles.dialogSheet} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Discard your selection?</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogFilled}
                onPress={() => setDiscardAction(null)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.dialogFilledLabel}>Keep Editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogOutline}
                onPress={confirmDiscard}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.dialogOutlineLabel}>Discard</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
      </>
    );
  }

  return (
    <Pressable style={styles.deckOptionsScrim} onPress={onDismiss}>
      <Pressable style={styles.dialogSheet} onPress={() => {}}>
        <Text style={styles.dialogTitle}>Deck Options</Text>
        {showSizes ? (
          <View style={styles.deckOptionsSizes}>
            <Text style={styles.deckOptionsLabel}>Deck size</Text>
            <View style={styles.deckOptionsPills}>
              {sizes.map(size => {
                const current = size === deckLength;
                const picked = pendingGrow === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.deckSizePill,
                      current ? styles.deckSizePillOn : styles.deckSizePillOff,
                      picked && styles.deckSizePillPick,
                    ]}
                    onPress={() => {
                      if (size < deckLength) {
                        setPendingGrow(null);
                        onOpenShrink(size);
                        return;
                      }
                      if (current) {
                        setPendingGrow(null);
                        return;
                      }
                      setPendingGrow(size);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current || picked }}
                    accessibilityLabel={`${size} words`}
                  >
                    <Text style={[styles.deckSizePillText, current ? styles.deckSizePillTextOn : styles.deckSizePillTextOff]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {pendingGrow !== null ? (
              <Text style={styles.dialogMessage}>
                {`Adds ${pendingGrow - deckLength} random ${wordCountLabel(pendingGrow - deckLength)} to reach ${pendingGrow}.`}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.dialogMessage}>
          Larger sizes add random words. Smaller sizes ask which words to remove. Your progress is kept.
        </Text>
        <View style={styles.dialogActions}>
          {showSizes ? (
            <TouchableOpacity
              style={[styles.dialogFilled, pendingGrow === null && styles.deckOptionsDisabled]}
              onPress={() => {
                if (pendingGrow !== null) onGrow(pendingGrow);
              }}
              disabled={pendingGrow === null}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ disabled: pendingGrow === null }}
            >
              <Text style={styles.dialogFilledLabel}>
                {pendingGrow === null
                  ? 'Add Words'
                  : `Add ${pendingGrow - deckLength} ${wordCountLabel(pendingGrow - deckLength, true)}`}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.dialogFilled}
            onPress={onNewDeck}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={styles.dialogFilledLabel}>New Deck</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dialogOutline}
            onPress={onDismiss}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={styles.dialogOutlineLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
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
  const { state, recordCardResult, incrementCardIndex, getLanguagePools, updatePool } = useAppContext();
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
  const [deckOptionsOpen, setDeckOptionsOpen] = useState(false);
  const deckOptionsOpenRef = useRef(false);
  const [shrinkSize, setShrinkSize] = useState<number | null>(null);
  const shrinkSizeRef = useRef<number | null>(null);
  const keyboardOpenRef = useRef(false);
  const restoreKeyboardRef = useRef(false);
  const cardTypeRef = useRef<CardData['type'] | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [deckResult, setDeckResult] = useState<string | null>(null);
  const deckResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  cardTypeRef.current = currentCard?.type ?? null;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardOpenRef.current = true;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOpenRef.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
      if (deckResultTimerRef.current) clearTimeout(deckResultTimerRef.current);
    };
  }, []);

  const language = state.languageSelected;
  const sessionDirectionRef = useRef<DirectionMode>(state.directionMode);
  const [sessionDirection, setSessionDirection] = useState<DirectionMode>(state.directionMode);

  const selectSessionDirection = useCallback((mode: DirectionMode) => {
    if (mode === sessionDirectionRef.current) return;
    sessionDirectionRef.current = mode;
    setSessionDirection(mode);
  }, []);

  // ── Pool-derived session vocab ─────────────────────────────────────────────
  // Pool IDs are passed via navigation params from select-study-list / deck-size.

  const { poolIds: poolIdsParam, deckSize: deckSizeParam, deckIds: deckIdsParam } =
    useLocalSearchParams<{ poolIds?: string; deckSize?: string; deckIds?: string }>();

  const poolIds = useMemo<string[]>(
    () => parsePoolIdsParam(poolIdsParam),
    [poolIdsParam],
  );

  const sessionSenseList = useMemo(() => {
    if (!language || poolIds.length !== 1) return null;
    const pool = (state.languagePools[language] ?? []).find(item => item.id === poolIds[0]);
    if (!pool) return null;
    return {
      name: pool.name,
      createdVia: pool.createdVia,
      items: enrichVocabItemsFromMaster(
        pool.words.map(word => word.item),
        language,
      ),
    };
  }, [language, poolIds, state.languagePools]);

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

    return {
      vocabBank,
      wordFrequencySettings,
      removedWordIds: sessionRemovedIdsRef.current,
    };
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
        const baseState = stateOverride ?? state;
        const { card, updatedSession } = generateNextCard(
          { ...baseState, directionMode: sessionDirectionRef.current },
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
  const sweepOpacity = useSharedValue(1);
  const transitioningRef = useRef(false);
  const fadeSweepRef = useRef(false);
  const awaitingFromKeyRef = useRef<string | null>(null);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sweepNonce, setSweepNonce] = useState(0);
  const transitionCardKey = currentCard
    ? getCardKey(currentCard, state.sessionCardIndex)
    : '';

  const cardSlideStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: sweepOpacity.value,
    transform: [{ translateX: sweepX.value }],
  }));

  const resetSweep = useCallback(() => {
    sweepX.value = 0;
    sweepOpacity.value = 1;
    fadeSweepRef.current = false;
    awaitingFromKeyRef.current = null;
    transitioningRef.current = false;
  }, [sweepOpacity, sweepX]);

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
      sweepOpacity.value = 1;
      fadeSweepRef.current = false;
      awaitingFromKeyRef.current = null;
      transitioningRef.current = false;
      return;
    }
    const fade = fadeSweepRef.current;
    fadeSweepRef.current = false;
    awaitingFromKeyRef.current = null;
    sweepX.value = SCREEN_WIDTH;
    if (fade) sweepOpacity.value = 0;
    sweepX.value = withTiming(0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
    if (fade) {
      sweepOpacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.quad),
      });
    }
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      transitioningRef.current = false;
    }, 150);
  }, [transitionCardKey, sweepNonce, sweepOpacity, sweepX]);

  const markWordsRemoved = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    for (const id of ids) sessionRemovedIdsRef.current.add(id);
    sessionRef.current = {
      ...sessionRef.current,
      deck: sessionRef.current.deck.filter(id => !drop.has(id)),
      deckBankHash: '',
    };
  }, []);

  const handleWordRemoved = useCallback(
    (vocabId: string) => {
      const before = getSessionDeckIds().size;
      markWordsRemoved([vocabId]);
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
    [handleNext, persistSingleListDeck, getSessionDeckIds, poolIds.length, markWordsRemoved],
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

  const handleRedrawDeck = useCallback(() => {
    if (transitioningRef.current) return;
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
    const removedIds = new Set(sessionRemovedIdsRef.current);
    const onScreenIds = currentCard ? onScreenWordIds(currentCard) : [];
    transitioningRef.current = true;
    fadeSweepRef.current = true;
    setDeckNotice(null);
    sweepX.value = withTiming(-SCREEN_WIDTH, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });
    sweepOpacity.value = withTiming(0, {
      duration: 140,
      easing: Easing.in(Easing.quad),
    });
    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = setTimeout(() => {
      void (async () => {
        sweepX.value = SCREEN_WIDTH;
        sweepOpacity.value = 0;
        try {
          let requested = pool.deckSize;
          try {
            const saved = await getDeckSizePref(language, studyType, [pool.id]);
            if (saved !== null) requested = saved;
          } catch {
            // Keep the size stored on the list.
          }
          const eligible = eligibleStudyWords(pool, studyType);
          const count = resolveRedrawCount(requested, eligible.length);
          const excluded = new Set(removedIds);
          for (const id of onScreenIds) excluded.add(id);
          const drawn = count > 0 ? drawSizedListDeck(pool, studyType, count) : [];
          const ids = redrawDeckAvoiding(
            drawn,
            eligible.map(word => word.id),
            excluded,
            count,
          );
          const byId = new Map(pool.words.map(pw => [pw.item.id, pw]));
          const items = ids.flatMap(id => {
            const word = byId.get(id);
            return word ? [word.item] : [];
          });
          if (items.length === 0) {
            resetSweep();
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
          awaitingFromKeyRef.current = cardKeyRef.current;
          loadCard();
          setSweepNonce(nonce => nonce + 1);
          if (deckResultTimerRef.current) clearTimeout(deckResultTimerRef.current);
          setDeckResult(`New deck · ${enriched.length} ${wordCountLabel(enriched.length)}`);
          deckResultTimerRef.current = setTimeout(() => {
            setDeckResult(null);
            deckResultTimerRef.current = null;
          }, 3000);
        } catch {
          resetSweep();
          setDeckNotice('no-words');
        }
      })();
    }, 145);
  }, [
    language,
    poolIds,
    state.studyTypeSelected,
    getLanguagePools,
    currentCard,
    loadCard,
    resetSweep,
    sweepOpacity,
    sweepX,
  ]);

  const growDeckTo = useCallback((size: number) => {
    if (!language || poolIds.length !== 1) return;
    const studyType = state.studyTypeSelected ?? 'general_vocab';
    const pool = getLanguagePools(language).find(item => item.id === poolIds[0]);
    const current = getSessionVocab();
    if (!pool || !current) return;
    const existingIds = current.vocabBank.map(word => word.id);
    const needed = size - existingIds.length;
    if (needed <= 0) return;
    const inDeck = new Set(existingIds);
    const removed = sessionRemovedIdsRef.current;
    const candidates = eligibleStudyWords(pool, studyType).filter(
      word => !inDeck.has(word.id) && !removed.has(word.id),
    );
    const picked = shuffleCopy(candidates).slice(0, needed);
    if (picked.length === 0) return;
    const enriched = enrichVocabItemsFromMaster(picked, language);
    const frequencyById = new Map(pool.words.map(pw => [pw.item.id, pw.frequency]));
    for (const item of enriched) {
      sessionAddedWordsRef.current.set(item.id, {
        item,
        frequency: frequencyById.get(item.id) ?? 'normal',
      });
    }
    sessionRef.current = {
      ...sessionRef.current,
      deckBankHash: '',
    };
    const newIds = [...existingIds, ...enriched.map(word => word.id)];
    void saveListDeck(language, studyType, pool.id, newIds);
    updatePool(pool.id, { deckSize: newIds.length, deckSizeChosen: true });
  }, [language, poolIds, state.studyTypeSelected, getLanguagePools, getSessionVocab, updatePool]);

  const shrinkDeckTo = useCallback((ids: readonly string[]) => {
    if (!language || poolIds.length !== 1 || !currentCard) return;
    const current = getSessionVocab();
    if (!current || ids.length === 0) return;
    const locked = new Set(onScreenWordIds(currentCard));
    const removable = ids.filter(
      id => !locked.has(id) && current.vocabBank.some(word => word.id === id),
    );
    if (removable.length === 0) return;
    markWordsRemoved(removable);
    persistSingleListDeck();
    updatePool(poolIds[0], {
      deckSize: getSessionDeckIds().size,
      deckSizeChosen: true,
    });
    shrinkSizeRef.current = null;
    setShrinkSize(null);
  }, [language, poolIds, currentCard, getSessionVocab, markWordsRemoved, persistSingleListDeck, getSessionDeckIds, updatePool]);

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

  const showDeckResult = useCallback((text: string) => {
    if (deckResultTimerRef.current) clearTimeout(deckResultTimerRef.current);
    setDeckResult(text);
    deckResultTimerRef.current = setTimeout(() => {
      setDeckResult(null);
      deckResultTimerRef.current = null;
    }, 3000);
  }, []);

  const closeDeckOptions = useCallback(() => {
    deckOptionsOpenRef.current = false;
    shrinkSizeRef.current = null;
    setShrinkSize(null);
    setDeckOptionsOpen(false);
    if (restoreKeyboardRef.current && cardTypeRef.current === 'CARD_1006') {
      setFocusRequest(request => request + 1);
    }
    restoreKeyboardRef.current = false;
  }, []);

  const retreatDeckOptions = useCallback(() => {
    if (shrinkSizeRef.current !== null) {
      shrinkSizeRef.current = null;
      setShrinkSize(null);
      return;
    }
    closeDeckOptions();
  }, [closeDeckOptions]);

  useAndroidBackHandler(
    useCallback(() => {
      if (deckOptionsOpenRef.current) return false;
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

  const openDeckOptions = useCallback(() => {
    restoreKeyboardRef.current = keyboardOpenRef.current || Keyboard.isVisible();
    deckOptionsOpenRef.current = true;
    setDeckOptionsOpen(true);
    Keyboard.dismiss();
  }, []);

  const applyGrow = useCallback((size: number) => {
    const before = getSessionDeckIds().size;
    growDeckTo(size);
    const after = getSessionDeckIds().size;
    const added = after - before;
    if (added <= 0) return;
    closeDeckOptions();
    showDeckResult(`Added ${added} ${wordCountLabel(added)} · deck now ${after}`);
  }, [getSessionDeckIds, growDeckTo, closeDeckOptions, showDeckResult]);

  const applyShrink = useCallback((ids: readonly string[]) => {
    const before = getSessionDeckIds().size;
    shrinkDeckTo(ids);
    const after = getSessionDeckIds().size;
    const removed = before - after;
    if (removed <= 0) return;
    closeDeckOptions();
    showDeckResult(`Removed ${removed} ${wordCountLabel(removed)} · deck now ${after}`);
  }, [getSessionDeckIds, shrinkDeckTo, closeDeckOptions, showDeckResult]);

  const openShrink = useCallback((size: number) => {
    shrinkSizeRef.current = size;
    setShrinkSize(size);
  }, []);

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
  const liveDeckLength = getSessionDeckIds().size;
  const eligibleCount = listPool && state.studyTypeSelected
    ? eligibleStudyWords(listPool, state.studyTypeSelected).length
    : 0;
  const deckSizeOptions = DECK_SIZE_STEPS.filter(size => {
    if (size <= liveDeckLength) return true;
    return size <= eligibleCount;
  });
  const deckWords = [...(getSessionVocab()?.vocabBank ?? [])].sort((a, b) =>
    a.lemma.localeCompare(b.lemma, language, { sensitivity: 'base' }),
  );
  const lockedIds = new Set(onScreenWordIds(currentCard));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'left', 'right']}>
      <SessionWordMgmtProvider
        language={language}
        poolIds={poolIds}
        getSessionDeckIds={getSessionDeckIds}
        onWordRemoved={handleWordRemoved}
        onWordReplaced={handleWordReplaced}
      >
      <WordMgmtConfirmHost>
        <Animated.View style={cardSlideStyle}>
        <ErrorBoundary
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
              direction={sessionDirection}
              onSelectDirection={selectSessionDirection}
              showDeckOptions={singleList}
              onOpenDeckOptions={openDeckOptions}
              headerNotice={deckResult}
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
              direction={sessionDirection}
              onSelectDirection={selectSessionDirection}
              showDeckOptions={singleList}
              onOpenDeckOptions={openDeckOptions}
              headerNotice={deckResult}
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
              card={currentCard}
              cardId={cardKey}
              language={language}
              onNext={handleNext}
              onFlip={() => {}}
              onExit={handleExit}
              onHome={handleHome}
              direction={sessionDirection}
              onSelectDirection={selectSessionDirection}
              showDeckOptions={singleList}
              onOpenDeckOptions={openDeckOptions}
              headerNotice={deckResult}
              focusRequest={focusRequest}
              sessionList={sessionSenseList}
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
      </WordMgmtConfirmHost>
      </SessionWordMgmtProvider>
      {deckNotice === 'small' || deckNotice === 'no-words' ? (
        <DeckNoticeDialog
          notice={deckNotice}
          wordCount={smallDeckCount}
          onKeep={() => setDeckNotice(null)}
          onNewDeck={handleRedrawDeck}
          onExit={handleExit}
        />
      ) : null}
      {deckOptionsOpen ? (
        <DeckOptionsSheet
          deckLength={liveDeckLength}
          sizes={deckSizeOptions}
          words={deckWords}
          lockedIds={lockedIds}
          shrinkSize={shrinkSize}
          onGrow={applyGrow}
          onOpenShrink={openShrink}
          onConfirmShrink={applyShrink}
          onBack={retreatDeckOptions}
          onHardwareBack={retreatDeckOptions}
          onNewDeck={() => {
            closeDeckOptions();
            void handleRedrawDeck();
          }}
          onDismiss={closeDeckOptions}
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
  deckOptionsScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  deckOptionsSizes: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  deckOptionsLabel: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    lineHeight: 20,
    color: '#25262B',
    textAlign: 'center',
  },
  deckOptionsPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deckSizePill: {
    minWidth: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckSizePillOn: { backgroundColor: '#5E51A4' },
  deckSizePillOff: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5E51A4',
  },
  deckSizePillPick: { borderWidth: 2 },
  deckSizePillText: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 15,
    lineHeight: 20,
  },
  deckSizePillTextOn: { color: '#FFFFFF' },
  deckSizePillTextOff: { color: '#5E51A4' },
  deckOptionsDisabled: { opacity: 0.4 },
  discardScrim: { zIndex: 21, elevation: 21 },
  shrinkScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  shrinkSheet: {
    alignItems: 'stretch',
    gap: 12,
    maxHeight: SCREEN_HEIGHT - 44,
  },
  shrinkList: {
    alignSelf: 'stretch',
  },
  shrinkListContent: { gap: 8 },
  shrinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 44,
  },
  shrinkCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shrinkCheckIcon: { width: 18, height: 18 },
  shrinkWords: { flex: 1, gap: 2 },
  shrinkLemma: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 18,
    lineHeight: 22,
    includeFontPadding: false,
  },
  shrinkEnglish: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 13.5,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.6)',
    includeFontPadding: false,
  },
});
