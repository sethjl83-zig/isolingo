import React from 'react';
import { TouchableOpacity, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { HomeFonts } from '@/constants/homeFonts';
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
      borderWidth: 1,
      borderColor: palette.tint,
    }),
    ...(variant === 'correct' && { backgroundColor: palette.correct }),
    ...(variant === 'incorrect' && { backgroundColor: '#F74856' }),
    ...(variant === 'inactive' && { backgroundColor: 'rgba(94,81,164,0.4)' }),
    ...(disabled && variant !== 'inactive' && { opacity: 0.4 }),
  };

  const labelStyle: TextStyle = {
    ...styles.label,
    ...labelSizeStyles[size],
    ...(variant === 'primary' && { color: palette.buttonPrimaryText }),
    ...(variant === 'secondary' && { color: palette.tint }),
    ...((variant === 'correct' || variant === 'incorrect') && { color: palette.buttonPrimaryText }),
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
  medium: {
    height: 48,
    paddingVertical: 0,
    paddingHorizontal: 22,
    minWidth: 160,
    borderRadius: 12,
  },
  small: { paddingVertical: 10, paddingHorizontal: 16, minWidth: 80 },
};

const labelSizeStyles: Record<string, TextStyle> = {
  large: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  medium: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 14,
  },
};
