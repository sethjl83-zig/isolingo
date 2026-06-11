/**
 * CARD_1002 — Vocab Relationship Judgment
 * Shows an English word and a target-language word; user picks the relationship.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
import type { Card1002Data, RelationshipType } from '@/src/types/cards';
import type { Language } from '@/src/types/vocab';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import WordMgmtStrip from '../ui/WordMgmtStrip';

const CHOICES: { id: RelationshipType; label: string }[] = [
  { id: 'same_meaning', label: 'They mean the same thing' },
  { id: 'same_category', label: 'They belong to the same category' },
  { id: 'similar_form', label: 'They look or sound similar' },
  { id: 'no_clear_relationship', label: 'No clear relationship' },
];

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

  const isNoun =
    card.targetItem.partOfSpeech === 'noun' && card.targetItem.gender !== null;
  const nounColor = isNoun ? GenderColors[card.targetItem.gender!] : undefined;

  const handleSelect = useCallback(
    (id: RelationshipType) => {
      if (answerState !== 'idle') return;
      setSelected(id);
      const correct = id === card.correctRelationship;
      setAnswerState(correct ? 'correct' : 'incorrect');
      onSubmit(correct);
    },
    [answerState, card.correctRelationship, onSubmit],
  );

  const handleFlip = useCallback(() => {
    setSelected(card.correctRelationship);
    setAnswerState('flipped');
    onFlip();
  }, [card.correctRelationship, onFlip]);

  const feedbackText =
    answerState === 'correct'
      ? 'Correct'
      : answerState === 'incorrect'
      ? 'Not quite'
      : answerState === 'flipped'
      ? 'Answer shown'
      : '';

  const feedbackColor =
    answerState === 'correct' || answerState === 'flipped'
      ? palette.correct
      : palette.incorrect;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>

      {/* Card content — scrollable so feedback never pushes buttons off-screen */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentArea}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        <Text style={[styles.instruction, { color: palette.subtext }]}>
          what is the relationship between these words?
        </Text>

        {/* Word pair */}
        <View style={[styles.pairBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.pairEnglish, { color: palette.text }]}>
            {card.englishWord}
          </Text>
          <View style={styles.separator} />
          {isNoun ? (
            <Text style={[styles.pairTarget, { color: nounColor ?? palette.text }]}>
              {card.targetWord}
            </Text>
          ) : (
            <Text style={[styles.pairTarget, { color: palette.text }]}>
              {card.targetWord}
            </Text>
          )}
        </View>

        {/* Answer choices */}
        <View style={styles.choices}>
          {CHOICES.map(choice => {
            const isSelected = selected === choice.id;
            const isCorrect = choice.id === card.correctRelationship;
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
                key={choice.id}
                label={choice.label}
                variant={variant}
                size="medium"
                onPress={() => handleSelect(choice.id)}
                disabled={resolved}
                style={styles.choiceBtn}
              />
            );
          })}
        </View>

        {/* Feedback */}
        {answerState === 'correct' ? (
          <CorrectText color={palette.correct} style={styles.feedbackMargin} />
        ) : feedbackText !== '' ? (
          <Text style={[styles.feedback, { color: feedbackColor }]}>{feedbackText}</Text>
        ) : null}


      </ScrollView>

      {/* Action buttons — anchored below scroll, above management strip */}
      <View style={styles.bottomBar}>
        <StudyButton
          label="Flip"
          variant="secondary"
          size="small"
          onPress={handleFlip}
          disabled={answerState !== 'idle'}
        />
        {answerState !== 'idle' && (
          <StudyButton label="Next" variant="primary" size="medium" onPress={onNext} />
        )}
      </View>

      {/* Word management strip — fixed at the very bottom */}
      <WordMgmtStrip />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  pairEnglish: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  separator: { width: 40, height: 1.5, backgroundColor: '#ccc', marginVertical: 8 },
  pairTarget: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  choices: { gap: 10 },
  choiceBtn: { width: '100%' },
  feedbackMargin: { marginBottom: 16 },
  feedback: { textAlign: 'center', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
});
