/**
 * CARD_1006 — Noun / Vocab Production
 * Direction-sensitive translation card. German uses gender tiles; FR/ES uses determiner+noun input.
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import type { Card1006Data } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import GenderTile from '../ui/GenderTile';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import FeedbackNote from '../ui/FeedbackNote';
import StudyCardLayout from './StudyCardLayout';
import {
  studyChrome,
  actionLabelStyle,
  flipButtonStyle,
  submitButtonStyle,
} from './studyChrome';
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

  const [inputText, setInputText] = useState('');
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [cardState, setCardState] = useState<CardState>('typing');
  const [alsoCorrect, setAlsoCorrect] = useState<string[]>([]);
  const [showTypoHint, setShowTypoHint] = useState(false);
  const attemptRef = useRef(0);

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
      : 'rgba(0,0,0,0.8)';

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
      : '#000000';

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
  if (cardState === 'correct') {
    feedbackText = 'Correct!';
  } else if (cardState === 'incorrect_1') {
    feedbackText = showTypoHint
      ? 'Almost! Check your spelling'
      : 'Not quite — try again';
  } else if (cardState === 'incorrect_final' && !showGenderTiles) {
    feedbackText = `Correct Answer: ${card.canonicalAnswer}`;
  } else if (cardState === 'flipped' && !showGenderTiles) {
    feedbackText = 'Answer shown';
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
    <StudyCardLayout
      style={{ backgroundColor: palette.background }}
      words={[{ id: card.item.id, lemma: card.item.lemma }]}
      bottomBar={
        <View style={studyChrome.bottomBar}>
          <StudyButton
            label="Flip"
            variant="secondary"
            onPress={handleFlip}
            disabled={resolved}
            style={flipButtonStyle}
            textStyle={actionLabelStyle}
          />

          {cardState === 'typing' && (
            <StudyButton
              label="Submit"
              variant="primary"
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={submitButtonStyle}
              textStyle={actionLabelStyle}
            />
          )}

          {cardState === 'incorrect_1' && (
            <StudyButton
              label="Submit"
              variant="primary"
              onPress={handleSubmit}
              style={submitButtonStyle}
              textStyle={actionLabelStyle}
            />
          )}

          {(cardState === 'correct' ||
            cardState === 'incorrect_final' ||
            cardState === 'flipped') && (
            <StudyButton
              label="Next"
              variant="primary"
              onPress={onNext}
              style={submitButtonStyle}
              textStyle={actionLabelStyle}
            />
          )}
        </View>
      }
    >
      <ScrollView
        style={studyChrome.scroll}
        contentContainerStyle={studyChrome.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
            <View style={studyChrome.topBar}>
              <TouchableOpacity onPress={onExit}>
                <Text style={studyChrome.exit}>Exit Study</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onHome}>
                <Text style={studyChrome.home}>Home</Text>
              </TouchableOpacity>
            </View>

            {/* Prompt */}
            <View style={styles.promptArea}>
              {promptParts ? (
                <Text style={styles.prompt}>
                  <Text style={styles.promptArticle}>
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
                <Text style={styles.senseLabel}>
                  ({senseLabel})
                </Text>
              )}
            </View>

            {/* Input */}
            <TextInput
              style={[
                styles.input,
                cardState === 'correct' && styles.inputCorrect,
                (cardState === 'incorrect_1' || cardState === 'incorrect_final') &&
                  styles.inputIncorrect,
                { color: inputTextColor },
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
              <View style={[styles.answerReveal, styles.inputCorrect]}>
                {answerParts && correctDisplayGender ? (
                  <Text style={styles.answerText}>
                    <Text style={styles.answerArticle}>
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
                  <Text style={styles.answerText}>
                    {card.canonicalAnswer}
                  </Text>
                )}
              </View>
            )}

            {/* Feedback */}
            {cardState === 'correct' ? (
              <FeedbackNote tone="correct">
                <CorrectText color="#38A19A" style={styles.correctLabel} />
                {alsoCorrect.length > 0 && (
                  <Text style={styles.alsoCorrect}>
                    Also Accepted: {alsoCorrect.join(', ')}
                  </Text>
                )}
              </FeedbackNote>
            ) : (cardState === 'incorrect_final' || cardState === 'flipped') &&
              showGenderTiles &&
              correctDisplayGender ? (
              <FeedbackNote tone="info">
                <Text style={styles.noteText}>
                  {'Correct Answer: '}
                  <Text style={{ color: GenderColors[correctDisplayGender] }}>
                    {correctDisplayNoun}
                  </Text>
                </Text>
                {germanErrorHints.length > 0 && (
                  <Text style={styles.errorHints}>
                    {germanErrorHints.join(' ')}
                  </Text>
                )}
              </FeedbackNote>
            ) : feedbackText !== '' ? (
              <FeedbackNote tone="info">
                <Text style={styles.noteText}>{feedbackText}</Text>
              </FeedbackNote>
            ) : null}

      </ScrollView>
    </StudyCardLayout>
  );
}

const styles = StyleSheet.create({
  promptArea: { marginBottom: 12 },
  prompt: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    color: '#000000',
  },
  promptArticle: { color: '#000000' },
  senseLabel: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    minHeight: 60,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 24,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputCorrect: {
    backgroundColor: 'rgba(56,161,154,0.05)',
    borderColor: '#38A19A',
    shadowRadius: 12,
  },
  inputIncorrect: {
    backgroundColor: 'rgba(247,72,86,0.05)',
    borderColor: '#F74856',
  },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  answerReveal: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    minHeight: 60,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  answerText: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },
  answerArticle: { color: 'rgba(0,0,0,0.8)' },
  correctLabel: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: 'left',
  },
  noteText: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#5E51A4',
  },
  errorHints: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(0,0,0,0.6)',
  },
  alsoCorrect: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 18,
    color: '#38A19A',
  },
});
