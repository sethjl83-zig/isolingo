/**
 * WordMgmtStrip — word-management row shown at the bottom of every study card.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeFonts } from '@/constants/homeFonts';
import { useSessionWordMgmt } from '@/src/context/SessionWordMgmtContext';
import WordFrequencyModal, { type WordFrequencyTarget } from './WordFrequencyModal';
import WordPickerModal from './WordPickerModal';

const BUTTONS = [
  { id: 'remove', label: 'Remove', icon: require('@/assets/images/gameplay/remove.png') },
  { id: 'replace', label: 'Replace', icon: require('@/assets/images/gameplay/replace.png') },
  { id: 'frequency', label: 'Frequency', icon: require('@/assets/images/gameplay/frequency.png') },
  { id: 'pause', label: 'Pause', icon: require('@/assets/images/gameplay/pause.png') },
] as const;

type PickerFlow = 'remove' | 'replace' | 'pause';

interface Props {
  words: WordFrequencyTarget[];
}

export default function WordMgmtStrip({ words }: Props) {
  const insets = useSafeAreaInsets();
  const { removeWord, replaceWord, pauseWord } = useSessionWordMgmt();
  const [frequencyVisible, setFrequencyVisible] = useState(false);
  const [pickerFlow, setPickerFlow] = useState<PickerFlow | null>(null);

  const showRemoveConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      Alert.alert(
        'Skip this word for the rest of this session?',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: () => removeWord(word.id),
          },
        ],
      );
    },
    [removeWord],
  );

  const showReplaceConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      Alert.alert(
        'Replace this word in your current session?',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: () => {
              const result = replaceWord(word.id);
              if (!result.success) {
                Alert.alert(
                  'Could not replace word',
                  result.error ?? 'Please try again.',
                );
              }
            },
          },
        ],
      );
    },
    [replaceWord],
  );

  const showPauseConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      Alert.alert(
        'Pause this word?',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              const result = pauseWord(word.id);
              if (!result.success) {
                Alert.alert(
                  'Could not pause word',
                  result.error ?? 'Please try again.',
                );
              }
            },
          },
        ],
      );
    },
    [pauseWord],
  );

  const startFlow = useCallback(
    (flow: PickerFlow) => {
      if (words.length === 1) {
        if (flow === 'remove') showRemoveConfirm(words[0]);
        else if (flow === 'replace') showReplaceConfirm(words[0]);
        else showPauseConfirm(words[0]);
        return;
      }
      setPickerFlow(flow);
    },
    [words, showRemoveConfirm, showReplaceConfirm, showPauseConfirm],
  );

  const handleWordPicked = useCallback(
    (word: WordFrequencyTarget) => {
      const flow = pickerFlow;
      setPickerFlow(null);
      if (flow === 'remove') showRemoveConfirm(word);
      else if (flow === 'replace') showReplaceConfirm(word);
      else if (flow === 'pause') showPauseConfirm(word);
    },
    [pickerFlow, showRemoveConfirm, showReplaceConfirm, showPauseConfirm],
  );

  const pickerTitle =
    pickerFlow === 'replace'
      ? 'Which word would you like to replace?'
      : pickerFlow === 'pause'
      ? 'Which word would you like to pause?'
      : 'Which word would you like to remove?';

  return (
    <>
      <View style={[styles.strip, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {BUTTONS.map(btn => (
          <TouchableOpacity
            key={btn.id}
            style={styles.btn}
            onPress={() => {
              if (btn.id === 'frequency') setFrequencyVisible(true);
              if (btn.id === 'remove') startFlow('remove');
              if (btn.id === 'replace') startFlow('replace');
              if (btn.id === 'pause') startFlow('pause');
            }}
            activeOpacity={0.7}
          >
            <Image source={btn.icon} style={styles.icon} />
            <Text style={styles.label}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <WordFrequencyModal
        visible={frequencyVisible}
        words={words}
        onDismiss={() => setFrequencyVisible(false)}
      />

      <WordPickerModal
        visible={pickerFlow !== null}
        title={pickerTitle}
        words={words}
        onSelect={handleWordPicked}
        onDismiss={() => setPickerFlow(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(210,232,215,0.8)',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  icon: { width: 14, height: 14 },
  label: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },
});
