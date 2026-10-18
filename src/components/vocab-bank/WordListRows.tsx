import React, { useCallback, memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import type { VocabItem } from '@/src/types/vocab';
import { FREQUENCY_INDICATOR_COLORS, FREQUENCY_LABELS, type WordFrequencySetting } from '@/src/types/state';
import { getWordLemmaColor } from '@/src/utils/vocabBank';
import FrequencySnapSlider from '../ui/FrequencySnapSlider';

const trashIcon = require('@/assets/images/lists/trash.png');

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface ActiveWordRowProps {
  item: VocabItem;
  frequency: WordFrequencySetting;
  onFrequencyChange: (id: string, frequency: WordFrequencySetting) => void;
  onRemove: (item: VocabItem) => void;
}

export const ActiveWordRow = memo(function ActiveWordRow({
  item,
  frequency,
  onFrequencyChange,
  onRemove,
}: ActiveWordRowProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

  const handleFrequencyChange = useCallback(
    (next: WordFrequencySetting) => onFrequencyChange(item.id, next),
    [item.id, onFrequencyChange],
  );

  const handleRemove = useCallback(() => onRemove(item), [item, onRemove]);

  return (
    <View style={styles.cardShadow}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FF']}
        style={[styles.card, { borderColor: palette.listCardBorder }]}
      >
        <View style={styles.cardTop}>
          <View style={styles.rowLeft}>
            <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
            <Text style={styles.english}>{item.english}</Text>
            {item.user_added === 'y' && (
              <Text style={[styles.customTag, { color: palette.primary }]}>Custom</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleRemove}
            activeOpacity={0.7}
            accessibilityLabel="Remove"
            style={[
              styles.trashBtn,
              {
                backgroundColor: hexAlpha(palette.destructive, 0.12),
                borderColor: hexAlpha(palette.destructive, 0.6),
              },
            ]}
          >
            <Image source={trashIcon} style={styles.trashIcon} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.freqRow}>
          <Text style={styles.freqLabel}>Frequency</Text>
          <FrequencySnapSlider
            value={frequency}
            onChange={handleFrequencyChange}
            hideLabel
          />
          <Text style={[styles.freqValue, { color: FREQUENCY_INDICATOR_COLORS[frequency] }]}>
            {FREQUENCY_LABELS[frequency]}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
});

interface PausedWordRowProps {
  item: VocabItem;
  onUnpause: (id: string) => void;
  onRemove: (item: VocabItem) => void;
}

export const PausedWordRow = memo(function PausedWordRow({
  item,
  onUnpause,
  onRemove,
}: PausedWordRowProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

  const handleUnpause = useCallback(() => onUnpause(item.id), [item.id, onUnpause]);
  const handleRemove = useCallback(() => onRemove(item), [item, onRemove]);

  return (
    <View style={styles.cardShadow}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FF']}
        style={[styles.card, { borderColor: palette.listCardBorder }]}
      >
        <View style={styles.pausedTop}>
          <View style={styles.rowLeft}>
            <Text style={[styles.lemma, { color: lemmaColor, opacity: 0.75 }]}>
              {item.lemma}
            </Text>
            <Text style={styles.english}>{item.english}</Text>
          </View>
          <View style={styles.pausedActions}>
            <TouchableOpacity onPress={handleUnpause} hitSlop={8}>
              <Text style={[styles.actionLink, { color: palette.primary }]}>Unpause</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRemove} hitSlop={8}>
              <Text style={[styles.actionLink, { color: palette.destructive }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

interface PausedSectionHeaderProps {
  title: string;
}

export const PausedSectionHeader = memo(function PausedSectionHeader({
  title,
}: PausedSectionHeaderProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View
      style={[
        styles.pausedHeader,
        { borderTopColor: 'rgba(210,232,215,0.8)', backgroundColor: palette.background },
      ]}
    >
      <Text style={styles.pausedHeaderText}>{title}</Text>
    </View>
  );
});

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 15,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowLeft: { flex: 1, gap: 6 },
  lemma: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  english: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 13.5,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.6)',
  },
  customTag: {
    fontFamily: HomeFonts.interMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIcon: { width: 17, height: 17 },
  divider: {
    height: 1,
    marginHorizontal: -3,
    backgroundColor: 'rgba(210,232,215,0.8)',
  },
  freqRow: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  freqLabel: {
    width: 80,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 16,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.6)',
  },
  freqValue: {
    width: 70,
    textAlign: 'right',
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 18,
  },
  pausedHeader: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  pausedHeaderText: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.45)',
  },
  pausedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pausedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionLink: {
    fontFamily: HomeFonts.interMedium,
    fontSize: 13,
    lineHeight: 16,
  },
});
