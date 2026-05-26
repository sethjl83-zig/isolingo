/**
 * SCREEN 0104 — STUDY SESSION ENGINE
 * Infinite study loop: generates cards, delivers them, updates repetition state.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import { generateNextCard, makeSessionState, advanceSession } from '@/src/engines/sessionEngine';
import type { CardData } from '@/src/types/cards';
import type { SessionState } from '@/src/engines/sessionEngine';
import Card1001 from '@/src/components/cards/Card1001';
import Card1002 from '@/src/components/cards/Card1002';
import Card1006 from '@/src/components/cards/Card1006';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import StudyButton from '@/src/components/ui/StudyButton';

function getCardKey(card: CardData, index: number): string {
  switch (card.type) {
    case 'CARD_1001':
      return `${index}-1001-${card.nouns.map(n => n.item.id).sort().join('|')}`;
    case 'CARD_1002':
      return `${index}-1002-${card.targetItem.id}`;
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
  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const language = state.languageSelected;

  const loadCard = useCallback(
    (stateOverride?: typeof state) => {
      try {
        setLoadError(null);
        const card = generateNextCard(stateOverride ?? state, sessionRef.current);
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
    [state],
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

  const handleSubmit = useCallback(
    (vocabId: string | null, correct: boolean, cardType: CardData['type'], direction: string) => {
      if (vocabId) recordCardResult(vocabId, correct);
      sessionRef.current = advanceSession(sessionRef.current, cardType, direction);
    },
    [recordCardResult],
  );

  const handleExit = useCallback(() => {
    router.replace('/study-type');
  }, [router]);

  const handleHome = useCallback(() => {
    router.replace('/');
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

  if (!state.studyTypeSelected || state.activeVocabBank.length === 0) {
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
            onNext={loadNextCard}
            onFlip={() => {}}
            onExit={handleExit}
            onHome={handleHome}
            onSubmit={correct =>
              handleSubmit(null, correct, 'CARD_1001', 'neutral')
            }
          />
        )}

        {currentCard.type === 'CARD_1002' && (
          <Card1002
            key={cardKey}
            card={currentCard}
            language={language}
            onNext={loadNextCard}
            onFlip={() => {}}
            onExit={handleExit}
            onHome={handleHome}
            onSubmit={correct =>
              handleSubmit(
                currentCard.targetItem.id,
                correct,
                'CARD_1002',
                'neutral',
              )
            }
          />
        )}

        {currentCard.type === 'CARD_1006' && (
          <Card1006
            key={cardKey}
            card={currentCard}
            language={language}
            onNext={loadNextCard}
            onFlip={() => {}}
            onExit={handleExit}
            onHome={handleHome}
            onSubmit={correct =>
              handleSubmit(
                currentCard.item.id,
                correct,
                'CARD_1006',
                currentCard.direction,
              )
            }
          />
        )}
      </ErrorBoundary>
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
