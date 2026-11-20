/**
 * Fixed study header: Exit Study, the session direction pill, the deck-options icon, and Home.
 * Sits above the card scroll so it stays put while the card moves.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HomeFonts } from '@/constants/homeFonts';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DirectionMode } from '@/src/types/state';
import type { Language } from '@/src/types/vocab';

const CYCLE: DirectionMode[] = ['target_to_native', 'native_to_target', 'mixed'];

/** Text is shorter than 44. hitSlop brings the tap target up to 44 points. */
const LABEL_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };
/** The glyph is 20 points. 12 points of hitSlop on each side makes the target 44. */
const ICON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

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
  showDeckOptions: boolean;
  onOpenDeckOptions: () => void;
}

export default function SessionHeader({
  language,
  direction,
  onCycleDirection,
  onExit,
  onHome,
  showDeckOptions,
  onOpenDeckOptions,
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
        <View style={styles.middle}>
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
          {showDeckOptions ? (
            <TouchableOpacity
              onPress={onOpenDeckOptions}
              hitSlop={ICON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Deck options"
              style={styles.optionsButton}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={20}
                color={palette.primary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
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
  middle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionsButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
