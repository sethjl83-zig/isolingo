import React from 'react';
import { Image } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Language } from '@/src/types/vocab';

const twoGenderIcon = require('@/assets/images/home/two-gender.png');

/**
 * German has three genders and keeps the three-gender symbol.
 * Spanish and French have two, so they use the Home 5C two-gender symbol.
 * No language selected uses the two-gender symbol as well.
 */
export default function GenderModeIcon({
  language,
  size = 30,
}: {
  language: Language | null;
  size?: number;
}) {
  if (language === 'de') {
    return <MaterialIcons name="transgender" size={size} color="#FEFCFA" />;
  }

  return (
    <Image
      source={twoGenderIcon}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
