/**
 * Fixed study header: Exit Study, the session direction pill, and Home.
 * Sits above the card scroll so it stays put while the card moves.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HomeFonts } from '@/constants/homeFonts';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DirectionMode } from '@/src/types/state';
import type { Language } from '@/src/types/vocab';

const CYCLE: DirectionMode[] = ['target_to_native', 'native_to_target', 'mixed'];

/** Text is shorter than 44. hitSlop brings the tap target up to 44 points. */
const LABEL_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

function languageCode(language: Language): string {
  if (language === 'fr') return 'FR';
  if (language === 'es') return 'ES';
  return 'DE';
}

function directionLabel(mode: DirectionMode, language: Language): string {
  const code = languageCode(language);
  if (mode === 'native_to_target') return `EN → ${code}`;
  if (mode === 'mixed') return 'Mixed';
  return `${code} → EN`;
}

interface Props {
  language: Language;
  direction: DirectionMode;
  onCycleDirection: () => void;
  onExit: () => void;
  onHome: () => void;
}

export default function SessionHeader({
  language,
  direction,
  onCycleDirection,
  onExit,
  onHome,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const [showCaption, setShowCaption] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cycle = () => {
    onCycleDirection();
    setShowCaption(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowCaption(false), 2000);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={onExit}
          hitSlop={LABEL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Exit Study"
        >
          <Text style={styles.exit}>Exit Study</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={cycle}
          accessibilityRole="button"
          accessibilityLabel={`Study direction ${directionLabel(direction, language)}`}
        >
          <View style={[styles.pill, { backgroundColor: palette.badgeFill }]}>
            <Text style={[styles.pillText, { color: palette.primary }]}>
              {directionLabel(direction, language)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHome}
          hitSlop={LABEL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Text style={styles.home}>Home</Text>
        </TouchableOpacity>
      </View>
      {showCaption ? (
        <Text style={[styles.caption, { color: palette.subtext }]} pointerEvents="none">
          Applies from the next card
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 6,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exit: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 17.5,
    lineHeight: 22,
    color: '#5E51A4',
  },
  home: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 18,
    lineHeight: 22,
    color: '#5E51A4',
  },
  pill: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    position: 'absolute',
    top: '100%',
    left: 16,
    right: 16,
    textAlign: 'center',
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 16,
  },
});
