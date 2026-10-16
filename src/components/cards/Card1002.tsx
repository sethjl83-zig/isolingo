/**
 * CARD_1002 — Vocab Relationship Judgment
 * Shows a word pair and asks the user to identify their relationship.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import type { Card1002Data, Card1002WordDisplay, RelationshipType } from '@/src/types/cards';
import { getRelationshipLabel, isRelationshipType } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import { getPrimaryEnglish } from '@/src/engines/genderedCounterpartHelper';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import StudyCardLayout from './StudyCardLayout';

interface Props {
  card: Card1002Data;
  language: Language;
  onNext: () => void;
  onFlip: () => void;
  onExit: () => void;
  onHome: () => void;
  onSubmit: (correct: boolean) => void;
}

type AnswerState = 'idle' | 'correct' | 'incorrect' | 'flipped';

function WordLine({
  slot,
  language,
  palette,
}: {
  slot: Card1002WordDisplay;
  language: Language;
  palette: (typeof Colors)['light'];
}) {
  const isNoun =
    slot.displayLanguage === 'target' &&
    slot.item.partOfSpeech === 'noun' &&
    slot.item.gender !== null;
  const nounColor = isNoun ? GenderColors[slot.item.gender as Gender] : palette.text;

  const targetParts =
    isNoun &&
    slot.determinerType &&
    (language === 'fr' || language === 'es')
      ? splitDisplayForm(
          language,
          slot.item.gender as Gender,
          slot.item.lemma,
          slot.determinerType,
        )
      : null;

  if (targetParts) {
    return (
      <Text style={styles.pairWord}>
        <Text style={{ color: palette.text }}>
          {targetParts.article}{targetParts.separator}
        </Text>
        <Text style={{ color: nounColor }}>{targetParts.noun}</Text>
      </Text>
    );
  }

  return (
    <Text style={[styles.pairWord, { color: isNoun ? nounColor : palette.text }]}>
      {slot.displayText}
    </Text>
  );
}

export default function Card1002({
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

  const [selected, setSelected] = useState<RelationshipType | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');

  const handleSelect = useCallback(
    (id: RelationshipType) => {
      if (answerState !== 'idle') return;
      setSelected(id);
    },
    [answerState],
  );

  const handleSubmit = useCallback(() => {
    if (answerState !== 'idle' || selected === null) return;
    const correct = selected === card.correctRelationship;
    setAnswerState(correct ? 'correct' : 'incorrect');
    onSubmit(correct);
  }, [answerState, selected, card.correctRelationship, onSubmit]);

  const handleFlip = useCallback(() => {
    setSelected(card.correctRelationship);
    setAnswerState('flipped');
    onFlip();
  }, [card.correctRelationship, onFlip]);

  const showEnglishReveal = answerState !== 'idle';
  const englishA = getPrimaryEnglish(card.itemA);
  const englishB = getPrimaryEnglish(card.itemB);
  const choiceTypes = card.choiceTypes.filter(isRelationshipType);

  return (
    <StudyCardLayout
      style={{ backgroundColor: palette.background }}
      words={[
        { id: card.itemA.id, lemma: card.itemA.lemma },
        { id: card.itemB.id, lemma: card.itemB.lemma },
      ]}
      bottomBar={
        <View style={styles.bottomBar}>
          <StudyButton
            label="Flip"
            variant="secondary"
            size="small"
            onPress={handleFlip}
            disabled={answerState !== 'idle'}
          />
          {answerState === 'idle' ? (
            <StudyButton
              label="Submit"
              variant={selected !== null ? 'primary' : 'inactive'}
              size="medium"
              onPress={handleSubmit}
              disabled={selected === null}
            />
          ) : (
            <StudyButton label="Next" variant="primary" size="medium" onPress={onNext} />
          )}
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentArea}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onExit}>
            <Text style={[styles.topBarBtn, { color: palette.tint }]}>Exit Study</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onHome}>
            <Text style={[styles.topBarBtn, { color: palette.tint }]}>Home</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.instruction, { color: palette.subtext }]}>
          What is the relationship between these words?
        </Text>

        <View style={[styles.pairBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <WordLine slot={card.wordA} language={language} palette={palette} />
          <View style={[styles.separator, { backgroundColor: palette.border }]} />
          <WordLine slot={card.wordB} language={language} palette={palette} />
        </View>

        <View style={styles.choices}>
          {choiceTypes.map(choiceId => {
            const isSelected = selected === choiceId;
            const isCorrect = choiceId === card.correctRelationship;
            const resolved = answerState !== 'idle';

            let variant: React.ComponentProps<typeof StudyButton>['variant'] = 'secondary';
            if (resolved) {
              if (isCorrect) variant = 'correct';
              else if (isSelected && !isCorrect) variant = 'incorrect';
              else variant = 'inactive';
            } else if (isSelected) {
              variant = 'primary';
            }

            return (
              <StudyButton
                key={choiceId}
                label={getRelationshipLabel(choiceId)}
                variant={variant}
                size="medium"
                onPress={() => handleSelect(choiceId)}
                disabled={resolved}
                style={styles.choiceBtn}
              />
            );
          })}
        </View>

        {showEnglishReveal && (
          <View style={styles.feedbackBlock}>
            {answerState === 'correct' ? (
              <CorrectText color={palette.correct} />
            ) : (
              <Text style={[styles.feedback, { color: palette.incorrect }]}>
                {answerState === 'incorrect' ? 'Not quite' : 'Answer shown'}
              </Text>
            )}
            <Text style={[styles.englishReveal, { color: palette.subtext }]}>
              ({englishA} / {englishB})
            </Text>
          </View>
        )}
      </ScrollView>
    </StudyCardLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentArea: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topBarBtn: { fontSize: 15, fontWeight: '500' },
  instruction: { textAlign: 'center', fontSize: 14, marginBottom: 24 },
  pairBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 28,
  },
  pairWord: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  separator: { width: 40, height: 1.5, marginVertical: 12 },
  choices: { gap: 10 },
  choiceBtn: { width: '100%' },
  feedbackBlock: { alignItems: 'center', marginTop: 16, marginBottom: 16, gap: 6 },
  feedback: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  englishReveal: { fontSize: 14, textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
});
