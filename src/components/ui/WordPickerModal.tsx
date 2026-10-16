import React from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors } from '@/constants/theme';
import type { WordFrequencyTarget } from './WordFrequencyModal';

interface Props {
  visible: boolean;
  title: string;
  words: WordFrequencyTarget[];
  onSelect: (word: WordFrequencyTarget) => void;
  onDismiss: () => void;
}

export default function WordPickerModal({
  visible,
  title,
  words,
  onSelect,
  onDismiss,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>

          <View style={styles.options}>
            {words.map(word => (
              <TouchableOpacity
                key={word.id}
                style={[styles.option, { borderColor: palette.border }]}
                onPress={() => onSelect(word)}
                activeOpacity={0.75}
              >
                <Text style={[styles.optionText, { color: palette.text }]}>{word.lemma}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Pressable onPress={onDismiss}>
            <Text style={[styles.cancel, { color: palette.subtext }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 28,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  options: { gap: 10 },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancel: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
