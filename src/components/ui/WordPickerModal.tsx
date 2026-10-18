import React from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';

import { HomeFonts } from '@/constants/homeFonts';
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.options}>
            {words.map(word => (
              <TouchableOpacity
                key={word.id}
                style={styles.option}
                onPress={() => onSelect(word)}
                activeOpacity={0.75}
              >
                <Text style={styles.optionText}>{word.lemma}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={onDismiss}>
            <Text style={styles.cancelLabel}>Cancel</Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 28,
  },
  sheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  options: { gap: 10, alignSelf: 'stretch', alignItems: 'center' },
  option: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  optionText: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
    textAlign: 'center',
  },
  cancel: {
    width: 220,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cancelLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
});
