import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  useColorScheme,
} from 'react-native';
import { GenderColors } from '@/constants/theme';
import type { Gender } from '@/src/types/vocab';

interface GenderTileProps {
  gender: Gender;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function GenderTile({
  gender,
  selected = false,
  onPress,
  disabled = false,
  style,
}: GenderTileProps) {
  const color = GenderColors[gender];

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        { backgroundColor: color },
        selected && styles.selected,
        disabled && styles.disabled,
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
  disabled: {
    opacity: 0.4,
  },
});
