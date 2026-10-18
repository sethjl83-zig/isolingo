import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';

import { GenderColors } from '@/constants/theme';
import type { Gender } from '@/src/types/vocab';

interface GenderTileProps {
  gender: Gender;
  selected?: boolean;
  /** Highlight as the correct answer after an incorrect submission. */
  showCorrect?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function GenderTile({
  gender,
  selected = false,
  showCorrect = false,
  onPress,
  disabled = false,
  style,
}: GenderTileProps) {
  const color = GenderColors[gender];

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        gender === 'neuter' && styles.neuter,
        { backgroundColor: color, borderColor: color },
        selected && !showCorrect && styles.selected,
        showCorrect && styles.correct,
        disabled && !showCorrect && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 110,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
  },
  neuter: {
    borderRadius: 12,
  },
  selected: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  correct: {
    borderColor: '#38A19A',
    borderWidth: 3,
  },
  disabled: {
    opacity: 0.4,
  },
});
