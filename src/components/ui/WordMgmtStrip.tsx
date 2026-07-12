/**
 * WordMgmtStrip — word-management row shown at the bottom of every study card.
 * Frequency and Remove are wired up; other buttons remain placeholders.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
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

interface Props {
  words: WordFrequencyTarget[];
}

export default function WordMgmtStrip({ words }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { removeWord } = useSessionWordMgmt();
  const [frequencyVisible, setFrequencyVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

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

  const handleRemovePress = useCallback(() => {
    if (words.length === 1) {
      showRemoveConfirm(words[0]);
      return;
    }
    setPickerVisible(true);
  }, [words, showRemoveConfirm]);

  const handleWordPicked = useCallback(
    (word: WordFrequencyTarget) => {
      setPickerVisible(false);
      showRemoveConfirm(word);
    },
    [showRemoveConfirm],
  );

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
              if (btn.id === 'remove') handleRemovePress();
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
        visible={pickerVisible}
        title="Which word would you like to remove?"
        words={words}
        onSelect={handleWordPicked}
        onDismiss={() => setPickerVisible(false)}
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
