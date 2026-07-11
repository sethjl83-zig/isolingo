import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
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
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const languageLabel = getLanguageDisplayName(language);

  const options: { id: VocabSearchMode; label: string }[] = [
    { id: 'target', label: languageLabel },
    { id: 'english', label: 'English' },
  ];

  return (
    <View style={[styles.row, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {options.map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.option,
              active && { backgroundColor: palette.tint },
            ]}
            onPress={() => onModeChange(opt.id)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.optionText,
                { color: active ? '#fff' : palette.text },
              ]}
            >
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
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
