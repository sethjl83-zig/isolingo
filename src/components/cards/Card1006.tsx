/**
 * CARD_1006 — Noun / Vocab Production
 * Direction-sensitive translation card. German uses gender tiles; FR/ES uses determiner+noun input.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, GenderColors } from '@/constants/theme';
import type { Card1006Data } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import GenderTile from '../ui/GenderTile';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import WordMgmtStrip from '../ui/WordMgmtStrip';
import {
  validateAnswer,
  validateGermanNoun,
  getGermanNounErrorHints,
  shouldShowTypoHint,
  shouldShowTypoHintForGermanNoun,
} from '@/src/engines/validationEngine';

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
  const scheme  = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const insets  = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [cardState, setCardState] = useState<CardState>('typing');
  const [alsoCorrect, setAlsoCorrect] = useState<string[]>([]);
  const [showTypoHint, setShowTypoHint] = useState(false);
  const attemptRef = useRef(0);

  // TEMP: verify senseLabel reaches the card from vocab data / pool bank
  useEffect(() => {
    console.log('[Card1006] card loaded:', {
      id: card.item.id,
      lemma: card.item.lemma,
      senseLabel: card.item.senseLabel,
      direction: card.direction,
    });
  }, [card.item.id, card.item.lemma, card.item.senseLabel, card.direction]);

  const isGerman = language === 'de';
  const isNativeToTarget = card.direction === 'native_to_target';
  const isNoun = card.item.partOfSpeech === 'noun';
  const showGenderTiles = isGerman && isNativeToTarget && isNoun;
  const resolved = cardState !== 'typing' && cardState !== 'incorrect_1';
  const canSubmit = showGenderTiles
    ? inputText.trim().length > 0 && selectedGender !== null
    : inputText.trim().length > 0;

  const correctGender = card.item.gender as Gender | undefined;
  const revealCorrectGenderTile =
    showGenderTiles &&
    !!correctGender &&
    cardState === 'incorrect_final';

  // Colour of the typed noun in the input (German only, after tile selected).
  // Use !resolved so the colour updates in both 'typing' AND 'incorrect_1' states,
  // i.e. any time the user is still allowed to change their tile selection.
  const inputTextColor =
    showGenderTiles && selectedGender && !resolved
      ? GenderColors[selectedGender]
      : palette.text;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    let result: { correct: boolean; alsoCorrect: string[] };

    if (showGenderTiles) {
      result = validateGermanNoun(
        inputText,
        selectedGender,
        card.canonicalAnswer,
        card.item.gender ?? '',
        card.acceptedAnswers, // alternates from alternateTargetAnswers
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
      setShowTypoHint(false);
      onSubmit(true, attemptRef.current === 1);
    } else {
      if (attemptRef.current >= 2) {
        setCardState('incorrect_final');
        setShowTypoHint(false);
        onSubmit(false, false);
      } else {
        const typoHint = showGenderTiles
          ? shouldShowTypoHintForGermanNoun(
              inputText,
              selectedGender,
              card.canonicalAnswer,
              card.item.gender ?? '',
              card.acceptedAnswers,
            )
          : shouldShowTypoHint(inputText, [
              card.canonicalAnswer,
              ...card.acceptedAnswers,
            ]);
        setShowTypoHint(typoHint);
        setCardState('incorrect_1');
      }
    }
  }, [canSubmit, showGenderTiles, inputText, selectedGender, card, onSubmit]);

  const handleFlip = useCallback(() => {
    setCardState('flipped');
    onFlip();
  }, [onFlip]);

  const handleTryAgain = useCallback(() => {
    setCardState('typing');
  }, []);

  // ── Correct answer display form ──────────────────────────────────────────────
  const correctDisplayNoun = card.item.lemma;
  // Only apply gender colour to the answer when the answer IS a target-language
  // word (native_to_target). In target_to_native the canonical answer is English.
  const correctDisplayGender =
    card.direction === 'native_to_target'
      ? (card.item.gender as Gender | undefined)
      : undefined;

  // ── Prompt colour ─────────────────────────────────────────────────────────────
  // In target_to_native the prompt IS the target-language noun — colour it by gender.
  // In native_to_target the prompt is the English cue — no gender colour.
  const promptColor =
    card.direction === 'target_to_native' &&
    card.item.partOfSpeech === 'noun' &&
    card.item.gender
      ? GenderColors[card.item.gender as Gender]
      : palette.text;

  // ── Split article/noun for FR/ES — only the noun gets the gender colour ────────
  const isFrEs = language === 'fr' || language === 'es';

  const possessivePerson = card.possessivePerson ?? 'first';

  // Prompt split: target_to_native FR/ES noun with determiner
  const promptParts =
    isFrEs &&
    card.direction === 'target_to_native' &&
    isNoun &&
    card.item.gender &&
    card.determinerType
      ? splitDisplayForm(
          language,
          card.item.gender as Gender,
          card.item.lemma,
          card.determinerType,
          possessivePerson,
        )
      : null;

  // Answer reveal split: native_to_target FR/ES noun — canonical answer is "le chien" etc.
  const answerParts =
    isFrEs &&
    card.direction === 'native_to_target' &&
    isNoun &&
    card.item.gender &&
    card.determinerType
      ? splitDisplayForm(
          language,
          card.item.gender as Gender,
          card.item.lemma,
          card.determinerType,
          possessivePerson,
        )
      : null;

  // ── Sense label subtitle (shown beneath prompt when present) ─────────────────
  const senseLabel = card.item.senseLabel?.trim() || null;

  // ── Feedback text (non-German answer reveal uses plain feedback string) ─────
  let feedbackText = '';
  let feedbackColor = palette.text;
  if (cardState === 'correct') {
    feedbackText = 'Correct!';
    feedbackColor = palette.correct;
  } else if (cardState === 'incorrect_1') {
    feedbackText = showTypoHint
      ? 'Almost! Check your spelling'
      : 'Not quite — try again';
    feedbackColor = palette.incorrect;
  } else if (cardState === 'incorrect_final' && !showGenderTiles) {
    feedbackText = `Correct answer: ${card.canonicalAnswer}`;
    feedbackColor = palette.incorrect;
  } else if (cardState === 'flipped' && !showGenderTiles) {
    feedbackText = 'Answer shown';
    feedbackColor = palette.subtext;
  }

  const germanErrorHints =
    showGenderTiles &&
    (cardState === 'incorrect_final' || cardState === 'flipped') &&
    correctGender
      ? getGermanNounErrorHints(
          inputText,
          selectedGender,
          card.canonicalAnswer,
          card.item.gender ?? '',
          card.acceptedAnswers,
        )
      : [];

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
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? insets.bottom + 8   // safe-area bottom inset + 8 px breathing room
          : 0
      }
    >
      {/*
        inner wraps scroll content + bottom bar as siblings.
        KeyboardAvoidingView shrinks inner when the keyboard appears;
        the bottom bar stays pinned at the bottom of inner, never hidden.
      */}
        <View style={styles.inner}>

          {/* Scrollable content — everything except the action buttons */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
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
              {promptParts ? (
                <Text style={styles.prompt}>
                  <Text style={{ color: palette.text }}>
                    {promptParts.article}{promptParts.separator}
                  </Text>
                  <Text style={{ color: promptColor }}>
                    {promptParts.noun}
                  </Text>
                </Text>
              ) : (
                <Text style={[styles.prompt, { color: promptColor }]}>{card.prompt}</Text>
              )}
              {senseLabel && (
                <Text style={[styles.senseLabel, { color: palette.subtext }]}>
                  ({senseLabel})
                </Text>
              )}
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
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              blurOnSubmit={false}
            />

            {/* Gender tiles — German native_to_target only */}
            {showGenderTiles && (
              <View style={styles.tilesRow}>
                {GENDERS.map(g => (
                  <GenderTile
                    key={g}
                    gender={g}
                    selected={selectedGender === g}
                    showCorrect={revealCorrectGenderTile && correctGender === g}
                    onPress={() => {
                      if (!resolved) setSelectedGender(g);
                    }}
                    disabled={resolved}
                  />
                ))}
              </View>
            )}

            {/* Correct answer reveal — FR/ES and non-gender cards only */}
            {(cardState === 'incorrect_final' || cardState === 'flipped') &&
              !showGenderTiles && (
              <View style={styles.answerReveal}>
                {answerParts && correctDisplayGender ? (
                  <Text style={styles.answerText}>
                    <Text style={{ color: palette.text }}>
                      {answerParts.article}{answerParts.separator}
                    </Text>
                    <Text style={{ color: GenderColors[correctDisplayGender] }}>
                      {answerParts.noun}
                    </Text>
                  </Text>
                ) : correctDisplayGender ? (
                  <Text style={[styles.answerText, { color: GenderColors[correctDisplayGender] }]}>
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
            {cardState === 'correct' ? (
              <View style={styles.feedbackArea}>
                <CorrectText color={palette.correct} />
                {alsoCorrect.length > 0 && (
                  <Text style={[styles.alsoCorrect, { color: palette.subtext }]}>
                    Also accepted: {alsoCorrect.join(', ')}
                  </Text>
                )}
              </View>
            ) : (cardState === 'incorrect_final' || cardState === 'flipped') &&
              showGenderTiles &&
              correctDisplayGender ? (
              <View style={styles.feedbackArea}>
                <Text style={[styles.feedback, { color: palette.incorrect }]}>
                  {'Correct answer: '}
                  <Text style={{ color: GenderColors[correctDisplayGender] }}>
                    {correctDisplayNoun}
                  </Text>
                </Text>
                {germanErrorHints.length > 0 && (
                  <Text style={[styles.errorHints, { color: palette.subtext }]}>
                    {germanErrorHints.join(' ')}
                  </Text>
                )}
              </View>
            ) : feedbackText !== '' ? (
              <View style={styles.feedbackArea}>
                <Text style={[styles.feedback, { color: feedbackColor }]}>{feedbackText}</Text>
              </View>
            ) : null}

          </ScrollView>

          {/* Action buttons — anchored below scroll, above management strip */}
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

          {/* Word management strip — always visible at the very bottom */}
          <WordMgmtStrip
            words={[{ id: card.item.id, lemma: card.item.lemma }]}
          />

        </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Fills the KeyboardAvoidingView; scroll and management strip are siblings inside.
  inner: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  topBarBtn: { fontSize: 15, fontWeight: '500' },
  promptArea: { alignItems: 'center', marginBottom: 28 },
  prompt: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  senseLabel: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
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
  errorHints: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  alsoCorrect: { fontSize: 13, textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
});
