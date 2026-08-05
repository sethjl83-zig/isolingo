import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
import type { VocabItem } from '@/src/types/vocab';
import type { WordFrequencySetting } from '@/src/types/state';
import { getWordLemmaColor } from '@/src/utils/vocabBank';
import FrequencySnapSlider from '../ui/FrequencySnapSlider';

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
    <View style={[styles.activeRow, { borderBottomColor: palette.border }]}>
      <View style={styles.activeMain}>
        <View style={styles.rowLeft}>
          <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
          {item.user_added === 'y' && (
            <Text style={[styles.customTag, { color: palette.tint }]}>Custom</Text>
          )}
        </View>
        <FrequencySnapSlider
          value={frequency}
          onChange={handleFrequencyChange}
          compact
        />
      </View>
      <TouchableOpacity onPress={handleRemove} hitSlop={8} style={styles.removeBtn}>
        <Text style={[styles.actionLink, { color: palette.incorrect }]}>Remove</Text>
      </TouchableOpacity>
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
    <View style={[styles.pausedRow, { borderBottomColor: palette.border }]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.lemma, { color: lemmaColor, opacity: 0.75 }]}>
          {item.lemma}
        </Text>
        <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
      </View>
      <View style={styles.pausedActions}>
        <TouchableOpacity onPress={handleUnpause} hitSlop={8}>
          <Text style={[styles.actionLink, { color: palette.tint }]}>Unpause</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRemove} hitSlop={8}>
          <Text style={[styles.actionLink, { color: palette.incorrect }]}>Remove</Text>
        </TouchableOpacity>
      </View>
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
        { borderTopColor: palette.border, backgroundColor: palette.background },
      ]}
    >
      <Text style={[styles.pausedHeaderText, { color: palette.subtext }]}>{title}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  activeRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  activeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  removeBtn: {
    alignSelf: 'flex-start',
  },
  rowLeft: { flex: 1, gap: 2 },
  lemma: { fontSize: 17, fontWeight: '700' },
  english: { fontSize: 14 },
  customTag: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  pausedHeader: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pausedHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pausedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
