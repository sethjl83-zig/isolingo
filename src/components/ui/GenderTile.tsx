import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  useColorScheme,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
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
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const color = GenderColors[gender];

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        { backgroundColor: color },
        selected && !showCorrect && styles.selected,
        showCorrect && [
          styles.correct,
          {
            borderColor: palette.correct,
            shadowColor: palette.correct,
          },
        ],
        disabled && !showCorrect && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  selected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  correct: {
    borderWidth: 4,
    transform: [{ scale: 1.12 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 10,
  },
  disabled: {
    opacity: 0.4,
  },
});
