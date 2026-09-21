import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface StudyButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'correct' | 'incorrect' | 'inactive';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function StudyButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
}: StudyButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles[size],
    ...(variant === 'primary' && { backgroundColor: palette.buttonPrimary }),
    ...(variant === 'secondary' && {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: palette.tint,
    }),
    ...(variant === 'correct' && { backgroundColor: palette.correct }),
    ...(variant === 'incorrect' && { backgroundColor: palette.incorrect }),
    ...(variant === 'inactive' && { backgroundColor: palette.border, opacity: 0.6 }),
    ...(disabled && { opacity: 0.4 }),
  };

  const labelStyle: TextStyle = {
    ...styles.label,
    ...labelSizeStyles[size],
    ...(variant === 'primary' && { color: palette.buttonPrimaryText }),
    ...(variant === 'secondary' && { color: palette.tint }),
    ...((variant === 'correct' || variant === 'incorrect') && { color: '#fff' }),
    ...(variant === 'inactive' && { color: palette.subtext }),
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled || variant === 'inactive'}
      activeOpacity={0.75}
    >
      <Text style={[labelStyle, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});

const sizeStyles: Record<string, ViewStyle> = {
  large: { paddingVertical: 18, paddingHorizontal: 28, minWidth: 220 },
  medium: { paddingVertical: 14, paddingHorizontal: 22, minWidth: 160 },
  small: { paddingVertical: 10, paddingHorizontal: 16, minWidth: 80 },
};

const labelSizeStyles: Record<string, TextStyle> = {
  large: { fontSize: 18 },
  medium: { fontSize: 16 },
  small: { fontSize: 14 },
};
