import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HomeFonts } from '@/constants/homeFonts';
import type { Language } from '@/src/types/vocab';
import {
  getLanguageDisplayName,
  type VocabSearchMode,
} from '@/src/utils/vocabBank';

interface Props {
  mode: VocabSearchMode;
  onModeChange: (mode: VocabSearchMode) => void;
  language: Language;
}

export default function SearchModeToggle({ mode, onModeChange, language }: Props) {
  const languageLabel = getLanguageDisplayName(language);

  const options: { id: VocabSearchMode; label: string }[] = [
    { id: 'target', label: languageLabel },
    { id: 'english', label: 'English' },
  ];

  return (
    <View style={styles.row}>
      {options.map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
            onPress={() => onModeChange(opt.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { borderColor: '#38A19A' },
  chipOff: { borderColor: 'rgba(94,81,164,0.2)' },
  chipText: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
  },
  chipTextOn: { color: '#38A19A' },
  chipTextOff: { color: 'rgba(0,0,0,0.5)' },
});
