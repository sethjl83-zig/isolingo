/**
 * CARD_1006 — Noun / Vocab Production
 * Direction-sensitive translation card. German uses gender tiles; FR/ES uses determiner+noun input.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
import type { Card1006Data } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import GenderTile from '../ui/GenderTile';
import StudyButton from '../ui/StudyButton';
import { validateAnswer, validateGermanNoun } from '@/src/engines/validationEngine';

const GENDERS: Gender[] = ['masculine', 'feminine', 'neuter'];

interface Props {
  card: Card1006Data;
  language: Language;
  onNext: () => void;
  onFlip: () => void;
  onExit: () => void;
  onHome: () => void;
  /** `isFirstAttempt` is true when the user answered correctly on their very first submit. */
  onSubmit: (correct: boolean, isFirstAttempt: boolean) => void;
}

type CardState =
  | 'typing'          // user is entering input
  | 'incorrect_1'     // first wrong attempt
  | 'incorrect_final' // second wrong attempt — show answer
  | 'correct'
  | 'flipped';

export default function Card1006({
  card,
  language,
  onNext,
  onFlip,
  onExit,
  onHome,
  onSubmit,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [inputText, setInputText] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [cardState, setCardState] = useState<CardState>('typing');
  const [alsoCorrect, setAlsoCorrect] = useState<string[]>([]);
  const attemptRef = useRef(0);

  const isGerman = language === 'de';
  const isNativeToTarget = card.direction === 'native_to_target';
  const showGenderTiles = isGerman && isNativeToTarget;
  const resolved = cardState !== 'typing' && cardState !== 'incorrect_1';
  const canSubmit = showGenderTiles
    ? inputText.trim().length > 0 && selectedGender !== null
    : inputText.trim().length > 0;

  const tileColor =
    selectedGender && cardState === 'typing'
      ? GenderColors[selectedGender]
      : undefined;

  // Colour of the typed noun in the input (German only, after tile selected)
  const inputTextColor =
    showGenderTiles && selectedGender && cardState === 'typing'
      ? GenderColors[selectedGender]
      : palette.text;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    Keyboard.dismiss();

    let result: { correct: boolean; alsoCorrect: string[] };

    if (showGenderTiles) {
      result = validateGermanNoun(
        inputText,
        selectedGender,
        card.canonicalAnswer,
        card.item.gender ?? '',
      );
    } else {
      result = validateAnswer(
        inputText,
        card.canonicalAnswer,
        card.acceptedAnswers,
        card.direction,
      );
    }

    attemptRef.current += 1;

    if (result.correct) {
      setCardState('correct');
      setAlsoCorrect(result.alsoCorrect);
      onSubmit(true, attemptRef.current === 1);
    } else {
      if (attemptRef.current >= 2) {
        setCardState('incorrect_final');
        onSubmit(false, false);
      } else {
        setCardState('incorrect_1');
      }
    }
  }, [canSubmit, showGenderTiles, inputText, selectedGender, card, onSubmit]);

  const handleFlip = useCallback(() => {
    Keyboard.dismiss();
    setCardState('flipped');
    onFlip();
  }, [onFlip]);

  const handleTryAgain = useCallback(() => {
    setCardState('typing');
  }, []);

  // ── Correct answer display form ──────────────────────────────────────────────
  const correctDisplayNoun = card.item.lemma;
  const correctDisplayGender = card.item.gender as Gender | undefined;

  // ── Feedback text ─────────────────────────────────────────────────────────────
  let feedbackText = '';
  let feedbackColor = palette.text;
  if (cardState === 'correct') {
    feedbackText = 'Correct!';
    feedbackColor = palette.correct;
  } else if (cardState === 'incorrect_1') {
    feedbackText = 'Not quite — try again';
    feedbackColor = palette.incorrect;
  } else if (cardState === 'incorrect_final') {
    feedbackText = `Correct answer: ${card.canonicalAnswer}`;
    feedbackColor = palette.incorrect;
  } else if (cardState === 'flipped') {
    feedbackText = 'Answer shown';
    feedbackColor = palette.subtext;
  }

  // ── Placeholder text ─────────────────────────────────────────────────────────
  const placeholder =
    isGerman && isNativeToTarget
      ? 'Type the German noun'
      : !isNativeToTarget
      ? 'Type the English translation'
      : 'Type the full phrase';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onExit}>
              <Text style={[styles.topBarBtn, { color: palette.tint }]}>Exit Study</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onHome}>
              <Text style={[styles.topBarBtn, { color: palette.tint }]}>Home</Text>
            </TouchableOpacity>
          </View>

          {/* Prompt */}
          <View style={styles.promptArea}>
            <Text style={[styles.prompt, { color: palette.text }]}>{card.prompt}</Text>
          </View>

          {/* Input */}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: inputTextColor,
              },
              resolved && styles.inputResolved,
            ]}
            value={inputText}
            onChangeText={text => {
              if (!resolved) setInputText(text);
            }}
            placeholder={placeholder}
            placeholderTextColor={palette.subtext}
            editable={!resolved}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            blurOnSubmit
          />

          {/* Gender tiles — German native_to_target only */}
          {showGenderTiles && (
            <View style={styles.tilesRow}>
              {GENDERS.map(g => (
                <GenderTile
                  key={g}
                  gender={g}
                  selected={selectedGender === g}
                  onPress={() => {
                    if (!resolved) setSelectedGender(g);
                  }}
                  disabled={resolved}
                />
              ))}
            </View>
          )}

          {/* Correct answer reveal */}
          {(cardState === 'incorrect_final' || cardState === 'flipped') && (
            <View style={styles.answerReveal}>
              {correctDisplayGender ? (
                <Text
                  style={[
                    styles.answerText,
                    { color: GenderColors[correctDisplayGender] },
                  ]}
                >
                  {card.canonicalAnswer}
                </Text>
              ) : (
                <Text style={[styles.answerText, { color: palette.text }]}>
                  {card.canonicalAnswer}
                </Text>
              )}
            </View>
          )}

          {/* Feedback */}
          {feedbackText !== '' && (
            <View style={styles.feedbackArea}>
              <Text style={[styles.feedback, { color: feedbackColor }]}>{feedbackText}</Text>
              {alsoCorrect.length > 0 && (
                <Text style={[styles.alsoCorrect, { color: palette.subtext }]}>
                  Also correct: {alsoCorrect.join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Bottom actions */}
          <View style={styles.bottomBar}>
            <StudyButton
              label="Flip"
              variant="secondary"
              size="small"
              onPress={handleFlip}
              disabled={resolved}
            />

            {cardState === 'typing' && (
              <StudyButton
                label="Submit"
                variant={canSubmit ? 'primary' : 'inactive'}
                size="medium"
                onPress={handleSubmit}
                disabled={!canSubmit}
              />
            )}

            {cardState === 'incorrect_1' && (
              <StudyButton
                label="Submit"
                variant="primary"
                size="medium"
                onPress={handleSubmit}
              />
            )}

            {(cardState === 'correct' ||
              cardState === 'incorrect_final' ||
              cardState === 'flipped') && (
              <StudyButton label="Next" variant="primary" size="medium" onPress={onNext} />
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  topBarBtn: { fontSize: 15, fontWeight: '500' },
  promptArea: { alignItems: 'center', marginBottom: 28 },
  prompt: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputResolved: { opacity: 0.7 },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  answerReveal: { alignItems: 'center', marginBottom: 8 },
  answerText: { fontSize: 20, fontWeight: '700' },
  feedbackArea: { alignItems: 'center', marginTop: 8, gap: 4 },
  feedback: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  alsoCorrect: { fontSize: 13, textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    gap: 12,
  },
});
