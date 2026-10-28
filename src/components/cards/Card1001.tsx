/**
 * CARD_1001 — Matching (Gender Anchoring)
 * User taps a noun row, then a gender tile to assign a match.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import type { Card1001Data } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import GenderTile from '../ui/GenderTile';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import FeedbackNote from '../ui/FeedbackNote';
import StudyCardLayout from './StudyCardLayout';
import { playCorrect, playIncorrect } from '@/src/utils/soundPlayer';
import {
  studyChrome,
  actionLabelStyle,
  flipButtonStyle,
  submitButtonStyle,
} from './studyChrome';

type MatchResult = 'idle' | 'correct' | 'partial';

interface Props {
  card: Card1001Data;
  language: Language;
  onNext: () => void;
  onFlip: () => void;
  onExit: () => void;
  onHome: () => void;
  onSubmit: (allCorrect: boolean) => void;
}

function NounLabel({
  language,
  lemma,
  displayForm,
  gender,
  nounColor,
  defaultColor,
}: {
  language: Language;
  lemma: string;
  displayForm: string;
  gender: Gender | null;
  nounColor: string;
  defaultColor: string;
}) {
  const isFrEs = language === 'fr' || language === 'es';
  if (isFrEs && gender) {
    const parts = splitDisplayForm(language, gender, lemma, 'definite');
    return (
      <Text style={styles.nounText}>
        <Text style={{ color: defaultColor }}>
          {parts.article}
          {parts.separator}
        </Text>
        <Text style={{ color: nounColor }}>{parts.noun}</Text>
      </Text>
    );
  }

  return <Text style={[styles.nounText, { color: nounColor }]}>{displayForm}</Text>;
}

export default function Card1001({
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

  // Always show all genders for the language, not just those present on this card
  const tileGenders: Gender[] =
    language === 'de'
      ? ['masculine', 'feminine', 'neuter']
      : ['masculine', 'feminine'];

  const [selectedNounId, setSelectedNounId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, Gender>>({}); // nounId → assigned gender
  const [lockedCorrect, setLockedCorrect] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<MatchResult>('idle');
  const [submitted, setSubmitted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const allPaired = card.nouns.every(n => pairs[n.item.id] !== undefined);

  const handleNounTap = useCallback(
    (id: string) => {
      if (submitted || flipped || lockedCorrect.has(id)) return;
      setSelectedNounId(prev => (prev === id ? null : id));
    },
    [submitted, flipped, lockedCorrect],
  );

  const handleTileTap = useCallback(
    (gender: Gender) => {
      if (!selectedNounId || submitted || flipped) return;
      setPairs(prev => ({ ...prev, [selectedNounId]: gender }));
      setSelectedNounId(null);
    },
    [selectedNounId, submitted, flipped],
  );

  const handleSubmit = useCallback(() => {
    const allCorrect = card.nouns.every(n => pairs[n.item.id] === n.item.gender);
    if (allCorrect) {
      setResult('correct');
      setSubmitted(true);
      setShowNext(true);
      playCorrect();
      onSubmit(true);
    } else {
      const newLocked = new Set(lockedCorrect);
      const newPairs = { ...pairs };
      for (const noun of card.nouns) {
        if (pairs[noun.item.id] === noun.item.gender) {
          newLocked.add(noun.item.id);
        } else {
          delete newPairs[noun.item.id];
        }
      }
      setLockedCorrect(newLocked);
      setPairs(newPairs);
      setResult('partial');
      playIncorrect();
      onSubmit(false);
    }
  }, [card.nouns, pairs, lockedCorrect, onSubmit]);

  const handleFlip = useCallback(() => {
    const correctPairs: Record<string, Gender> = {};
    for (const noun of card.nouns) {
      correctPairs[noun.item.id] = noun.item.gender as Gender;
    }
    setPairs(correctPairs);
    setFlipped(true);
    setShowNext(true);
    setSubmitted(true);
    onFlip();
  }, [card.nouns, onFlip]);

  const feedbackText =
    flipped
      ? 'Answer shown'
      : result === 'correct'
      ? 'Correct!'
      : result === 'partial'
      ? 'Not quite — try again'
      : '';

  return (
    <StudyCardLayout
      style={{ backgroundColor: palette.background }}
      words={card.nouns.map(n => ({ id: n.item.id, lemma: n.item.lemma }))}
      bottomBar={
        <View style={studyChrome.bottomBar}>
          <StudyButton
            label="Flip"
            variant="secondary"
            onPress={handleFlip}
            disabled={flipped || submitted}
            style={flipButtonStyle}
            textStyle={actionLabelStyle}
          />
          {!showNext && (
            <StudyButton
              label="Submit"
              variant="primary"
              onPress={handleSubmit}
              disabled={!allPaired || submitted || flipped}
              style={submitButtonStyle}
              textStyle={actionLabelStyle}
            />
          )}
          {showNext && (
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
          Tap a word, then tap its gender below
        </Text>

        <View style={styles.nounList}>
          {card.nouns.map(noun => {
            const assigned = pairs[noun.item.id];
            const isLocked = lockedCorrect.has(noun.item.id);
            const isSelected = selectedNounId === noun.item.id;
            const nounColor = assigned ? GenderColors[assigned] : 'rgba(0,0,0,0.8)';

            return (
              <TouchableOpacity
                key={noun.item.id}
                style={[
                  styles.nounRow,
                  isSelected && styles.nounSelected,
                  isLocked && styles.nounLocked,
                ]}
                onPress={() => handleNounTap(noun.item.id)}
                disabled={isLocked || submitted || flipped}
                activeOpacity={0.75}
              >
                <NounLabel
                  language={language}
                  lemma={noun.item.lemma}
                  displayForm={noun.displayForm}
                  gender={noun.item.gender}
                  nounColor={nounColor}
                  defaultColor="rgba(0,0,0,0.8)"
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tilesRow}>
          {tileGenders.map(gender => (
            <GenderTile
              key={gender}
              gender={gender}
              selected={
                selectedNounId !== null && pairs[selectedNounId] === gender
              }
              onPress={() => handleTileTap(gender)}
              disabled={submitted || flipped}
            />
          ))}
        </View>

        {result === 'correct' ? (
          <FeedbackNote tone="correct">
            <CorrectText color="#38A19A" style={styles.correctLabel} />
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
  instruction: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    color: '#000000',
    marginBottom: 20,
  },
  nounList: { gap: 8, marginBottom: 20 },
  nounRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  nounSelected: {
    borderColor: '#5E51A4',
    borderWidth: 2,
  },
  nounLocked: {
    backgroundColor: 'rgba(56,161,154,0.05)',
    borderColor: '#38A19A',
  },
  nounText: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 24,
  },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
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
});
