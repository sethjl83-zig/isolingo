/**
 * CARD_1002 — Vocab Relationship Judgment
 * Shows a word pair and asks the user to identify their relationship.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import type { Card1002Data, Card1002WordDisplay, RelationshipType } from '@/src/types/cards';
import { getRelationshipLabel, isRelationshipType } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import { getPrimaryEnglish } from '@/src/engines/genderedCounterpartHelper';
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

const checkIcon = require('@/assets/images/gameplay/check.png');
const closeIcon = require('@/assets/images/gameplay/close.png');
const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
        <Text style={{ color: 'rgba(0,0,0,0.8)' }}>
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
        <View style={studyChrome.bottomBar}>
          <StudyButton
            label="Flip"
            variant="secondary"
            onPress={handleFlip}
            disabled={answerState !== 'idle'}
            style={flipButtonStyle}
            textStyle={actionLabelStyle}
          />
          {answerState === 'idle' ? (
            <StudyButton
              label="Submit"
              variant="primary"
              onPress={handleSubmit}
              disabled={selected === null}
              style={submitButtonStyle}
              textStyle={actionLabelStyle}
            />
          ) : (
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={studyChrome.topBar}>
          <TouchableOpacity onPress={onExit}>
            <Text style={studyChrome.exit}>Exit Study</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onHome}>
            <Text style={studyChrome.home}>Home</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>
          What is the relationship between these words?
        </Text>

        <View style={styles.pairBox}>
          <WordLine slot={card.wordA} language={language} palette={palette} />
          <View style={styles.separator} />
          <WordLine slot={card.wordB} language={language} palette={palette} />
        </View>

        <View style={styles.choices}>
          {choiceTypes.map((choiceId, index) => {
            const isSelected = selected === choiceId;
            const isCorrect = choiceId === card.correctRelationship;
            const resolved = answerState !== 'idle';
            const showCheck = resolved && isCorrect;
            const showWrong = resolved && isSelected && !isCorrect;
            const picked = !resolved && isSelected;

            return (
              <TouchableOpacity
                key={choiceId}
                style={[
                  styles.choice,
                  picked && styles.choicePicked,
                  showCheck && styles.choiceCorrect,
                  showWrong && styles.choiceWrong,
                ]}
                onPress={() => handleSelect(choiceId)}
                disabled={resolved}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.badge,
                    showCheck && styles.badgeCorrect,
                    showWrong && styles.badgeWrong,
                  ]}
                >
                  {showCheck ? (
                    <Image source={checkIcon} style={styles.checkIcon} />
                  ) : showWrong ? (
                    <Image source={closeIcon} style={styles.closeIcon} />
                  ) : (
                    <Text style={styles.letter}>{CHOICE_LETTERS[index] ?? ''}</Text>
                  )}
                </View>
                <Text style={styles.choiceLabel}>{getRelationshipLabel(choiceId)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showEnglishReveal && (
          <FeedbackNote tone={answerState === 'correct' ? 'correct' : 'info'}>
            {answerState === 'correct' ? (
              <CorrectText color="#38A19A" style={styles.correctLabel} />
            ) : (
              <Text style={styles.noteLine}>
                <Text style={styles.noteStrong}>
                  {answerState === 'incorrect' ? 'Not quite' : 'Answer shown'}
                </Text>
                <Text style={styles.noteRest}>
                  {' '}({englishA} / {englishB})
                </Text>
              </Text>
            )}
            {answerState === 'correct' && (
              <Text style={styles.correctRest}>
                ({englishA} / {englishB})
              </Text>
            )}
          </FeedbackNote>
        )}
      </ScrollView>
    </StudyCardLayout>
  );
}

const styles = StyleSheet.create({
  instruction: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    color: '#000000',
    marginBottom: 12,
  },
  pairBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DAECDF',
    paddingVertical: 20,
    paddingHorizontal: 15,
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pairWord: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  separator: {
    width: 150,
    height: 1,
    backgroundColor: 'rgba(210,232,215,0.8)',
  },
  choices: { gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 60,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  choicePicked: {
    borderColor: '#5E51A4',
    borderWidth: 2,
  },
  choiceCorrect: {
    backgroundColor: 'rgba(56,161,154,0.05)',
    borderColor: '#38A19A',
    shadowRadius: 12,
  },
  choiceWrong: {
    backgroundColor: 'rgba(247,72,86,0.05)',
    borderColor: '#F74856',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCorrect: { backgroundColor: '#38A19A' },
  badgeWrong: { backgroundColor: '#F74856' },
  letter: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    color: 'rgba(0,0,0,0.8)',
  },
  checkIcon: { width: 16, height: 11 },
  closeIcon: { width: 14, height: 14 },
  choiceLabel: {
    flex: 1,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },
  correctLabel: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: 'left',
  },
  correctRest: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#38A19A',
  },
  noteLine: { flexShrink: 1 },
  noteStrong: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#5E51A4',
  },
  noteRest: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#5E51A4',
  },
});
