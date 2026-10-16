import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
    <View
      style={[
        styles.track,
        { backgroundColor: '#FFFFFF' },
      ]}
    >
      {options.map(opt => {
        const active = mode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.segment,
              active && { backgroundColor: palette.tint },
            ]}
            onPress={() => onModeChange(opt.id)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? '#FFFFFF' : palette.text },
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
  track: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 19,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
