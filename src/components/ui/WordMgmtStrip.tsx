/**
 * WordMgmtStrip — word-management row shown at the bottom of every study card.
 * Frequency is wired up; other buttons remain placeholders for a later pass.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import WordFrequencyModal, { type WordFrequencyTarget } from './WordFrequencyModal';

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
  const [frequencyVisible, setFrequencyVisible] = useState(false);

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
