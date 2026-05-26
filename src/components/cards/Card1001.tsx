/**
 * CARD_1001 — Matching (Gender Anchoring)
 * User taps a noun on the left, then a gender-colour tile on the right to form a pair.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
import type { Card1001Data, MatchingNoun } from '@/src/types/cards';
import type { Gender, Language } from '@/src/types/vocab';
import StudyButton from '../ui/StudyButton';

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

const GENDER_ORDER: Gender[] =
  // We need to know the language to decide whether to show 2 or 3 tiles.
  // We always render all genders that appear in the card's nouns.
  ['masculine', 'feminine', 'neuter'];

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

  // Derive the genders actually present
  const presentGenders = [
    ...new Set(card.nouns.map(n => n.item.gender as Gender)),
  ] as Gender[];
  const tileGenders: Gender[] = GENDER_ORDER.filter(g => presentGenders.includes(g));

  const [selectedNounId, setSelectedNounId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, Gender>>({}); // nounId → gender
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
      // Lock correct pairs, reset incorrect ones
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
    // Reveal all correct answers
    const correctPairs: Record<string, Gender> = {};
    for (const noun of card.nouns) {
      correctPairs[noun.item.id] = noun.item.gender as Gender;
    }
    setPairs(correctPairs);
    setFlipped(true);
    setShowNext(true);
    setSubmitted(true);
  }, [card.nouns]);

  const feedbackText =
    flipped
      ? 'Answer shown'
      : result === 'correct'
      ? 'Correct!'
      : result === 'partial'
      ? 'Not quite — try again'
      : '';

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onExit}>
          <Text style={[styles.topBarBtn, { color: palette.tint }]}>Exit Study</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHome}>
          <Text style={[styles.topBarBtn, { color: palette.tint }]}>Home</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.instruction, { color: palette.subtext }]}>match the words</Text>

      {/* Two-column matching area */}
      <View style={styles.matchArea}>
        {/* Left: nouns */}
        <View style={styles.nounColumn}>
          {card.nouns.map(noun => {
            const paired = pairs[noun.item.id];
            const isLocked = lockedCorrect.has(noun.item.id);
            const isSelected = selectedNounId === noun.item.id;
            const nounColor =
              submitted || flipped
                ? GenderColors[noun.item.gender as Gender]
                : paired
                ? GenderColors[paired]
                : undefined;

            return (
              <TouchableOpacity
                key={noun.item.id}
                style={[
                  styles.nounChip,
                  { borderColor: palette.border, backgroundColor: palette.card },
                  isSelected && styles.nounSelected,
                  isLocked && styles.nounLocked,
                ]}
                onPress={() => handleNounTap(noun.item.id)}
                disabled={isLocked || submitted || flipped}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.nounText,
                    { color: nounColor ?? palette.text },
                  ]}
                >
                  {noun.displayForm}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right: gender tiles */}
        <View style={styles.tileColumn}>
          {tileGenders.map(gender => (
            <TouchableOpacity
              key={gender}
              style={[
                styles.genderTile,
                { backgroundColor: GenderColors[gender] },
                (submitted || flipped) && styles.tileDisabled,
              ]}
              onPress={() => handleTileTap(gender)}
              disabled={submitted || flipped}
              activeOpacity={0.75}
            />
          ))}
        </View>
      </View>

      {/* Feedback */}
      {feedbackText !== '' && (
        <Text
          style={[
            styles.feedback,
            {
              color:
                result === 'correct' || flipped ? palette.correct : palette.incorrect,
            },
          ]}
        >
          {feedbackText}
        </Text>
      )}

      {/* Bottom actions */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topBarBtn: { fontSize: 15, fontWeight: '500' },
  instruction: { textAlign: 'center', fontSize: 14, marginBottom: 28 },
  matchArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
  },
  nounColumn: { flex: 1, gap: 14 },
  tileColumn: { gap: 14, paddingLeft: 24, justifyContent: 'center' },
  nounChip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nounSelected: { borderColor: '#2C6BED', borderWidth: 2.5 },
  nounLocked: { opacity: 0.6 },
  nounText: { fontSize: 18, fontWeight: '600' },
  genderTile: { width: 56, height: 56, borderRadius: 10 },
  tileDisabled: { opacity: 0.5 },
  feedback: { textAlign: 'center', fontSize: 16, fontWeight: '600', marginTop: 20 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
});
