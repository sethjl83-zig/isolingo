/**
 * CARD_1001 — Matching (Gender Anchoring)
 * User taps a noun row, then a gender tile to assign a match.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import type { Card1001Data } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import { splitDisplayForm } from '@/src/engines/articleHelper';
import GenderTile from '../ui/GenderTile';
import StudyButton from '../ui/StudyButton';
import CorrectText from '../ui/CorrectText';
import StudyCardLayout from './StudyCardLayout';

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
        <View style={styles.bottomBar}>
          <StudyButton
            label="Flip"
            variant="secondary"
            size="small"
            onPress={handleFlip}
            disabled={flipped || submitted}
          />
          {!showNext && (
            <StudyButton
              label="Submit"
              variant={allPaired ? 'primary' : 'inactive'}
              size="medium"
              onPress={handleSubmit}
              disabled={!allPaired || submitted || flipped}
            />
          )}
          {showNext && (
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
          tap a word, then tap its gender below
        </Text>

        <View style={styles.nounList}>
          {card.nouns.map(noun => {
            const assigned = pairs[noun.item.id];
            const isLocked = lockedCorrect.has(noun.item.id);
            const isSelected = selectedNounId === noun.item.id;
            const nounColor = assigned ? GenderColors[assigned] : palette.text;

            return (
              <TouchableOpacity
                key={noun.item.id}
                style={[
                  styles.nounRow,
                  {
                    borderColor: isSelected ? palette.tint : palette.border,
                    backgroundColor: isSelected ? palette.feedback : palette.card,
                  },
                  isSelected && styles.nounSelected,
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
                  defaultColor={palette.text}
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
          <CorrectText color={palette.correct} style={styles.feedbackMargin} />
        ) : feedbackText !== '' ? (
          <Text
            style={[
              styles.feedback,
              { color: flipped ? palette.correct : palette.incorrect },
            ]}
          >
            {feedbackText}
          </Text>
        ) : null}
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
  nounList: { gap: 12, marginBottom: 32 },
  nounRow: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  nounSelected: { borderWidth: 2.5 },
  nounText: { fontSize: 18, fontWeight: '600' },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
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
