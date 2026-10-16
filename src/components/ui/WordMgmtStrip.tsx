/**
 * WordMgmtStrip — word-management row shown at the bottom of every study card.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useSessionWordMgmt } from '@/src/context/SessionWordMgmtContext';
import WordFrequencyModal, { type WordFrequencyTarget } from './WordFrequencyModal';
import WordPickerModal from './WordPickerModal';

const BUTTONS = [
  { id: 'remove', label: 'Remove' },
  { id: 'replace', label: 'Replace' },
  { id: 'frequency', label: 'Frequency' },
  { id: 'pause', label: 'Pause' },
] as const;

type PickerFlow = 'remove' | 'replace' | 'pause';

interface Props {
  words: WordFrequencyTarget[];
}

export default function WordMgmtStrip({ words }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
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
      <View
        style={[
          styles.strip,
          {
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        {BUTTONS.map(btn => (
          <TouchableOpacity
            key={btn.id}
            style={[styles.btn, { borderColor: palette.border }]}
            onPress={() => {
              if (btn.id === 'frequency') setFrequencyVisible(true);
              if (btn.id === 'remove') startFlow('remove');
              if (btn.id === 'replace') startFlow('replace');
              if (btn.id === 'pause') startFlow('pause');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: palette.subtext }]}>
              {btn.label}
            </Text>
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
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
