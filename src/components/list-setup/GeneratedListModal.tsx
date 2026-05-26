import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Animated,
} from 'react-native';
import { Colors, GenderColors } from '@/constants/theme';
import type { WordFrequencySetting } from '@/src/types/state';
import type { VocabItem } from '@/src/types/vocab';
import FrequencySnapSlider from '@/src/components/ui/FrequencySnapSlider';
import StudyButton from '@/src/components/ui/StudyButton';
import { getWordLemmaColor } from '@/src/utils/vocabBank';

export interface DraftWord {
  item: VocabItem;
  frequency: WordFrequencySetting;
}

const FADE_OUT_MS = 180;
const FADE_IN_MS = 450;

interface GeneratedListModalProps {
  visible: boolean;
  words: DraftWord[];
  onRemove: (index: number) => VocabItem | null;
  onFrequencyChange: (index: number, frequency: WordFrequencySetting) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface DraftWordRowProps {
  entry: DraftWord;
  index: number;
  onRemove: (index: number) => VocabItem | null;
  onFrequencyChange: (index: number, frequency: WordFrequencySetting) => void;
  palette: (typeof Colors)['light'];
}

function DraftWordRow({ entry, index, onRemove, onFrequencyChange, palette }: DraftWordRowProps) {
  const [displayEntry, setDisplayEntry] = useState(entry);
  const opacity = useRef(new Animated.Value(1)).current;
  const pendingFadeIn = useRef(false);
  const isFadingOut = useRef(false);

  useEffect(() => {
    if (pendingFadeIn.current || isFadingOut.current) return;
    setDisplayEntry(entry);
  }, [entry]);

  useLayoutEffect(() => {
    if (!pendingFadeIn.current) return;
    if (entry.item.id === displayEntry.item.id) return;

    setDisplayEntry(entry);
    opacity.setValue(0);
    pendingFadeIn.current = false;

    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      useNativeDriver: true,
    }).start();
  }, [entry, displayEntry.item.id, opacity]);

  const lemmaColor = getWordLemmaColor(displayEntry.item, palette.text, GenderColors);

  const handleRemovePress = useCallback(() => {
    if (isFadingOut.current || pendingFadeIn.current) return;

    isFadingOut.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      isFadingOut.current = false;
      if (!finished) {
        opacity.setValue(1);
        return;
      }

      const replacement = onRemove(index);
      if (!replacement) {
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_IN_MS,
          useNativeDriver: true,
        }).start();
        return;
      }

      pendingFadeIn.current = true;
    });
  }, [index, onRemove, opacity]);

  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <View style={styles.wordCol}>
        <Animated.View style={[styles.wordTextBlock, { opacity }]}>
          <Text style={[styles.lemma, { color: lemmaColor }]}>{displayEntry.item.lemma}</Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{displayEntry.item.english}</Text>
        </Animated.View>
        <TouchableOpacity onPress={handleRemovePress} activeOpacity={0.7}>
          <Text style={[styles.removeBtn, { color: palette.tint }]}>Remove</Text>
        </TouchableOpacity>
      </View>
      <FrequencySnapSlider
        value={entry.frequency}
        onChange={freq => onFrequencyChange(index, freq)}
        compact
      />
    </View>
  );
}

export default function GeneratedListModal({
  visible,
  words,
  onRemove,
  onFrequencyChange,
  onConfirm,
  onCancel,
}: GeneratedListModalProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const renderItem = ({ item, index }: { item: DraftWord; index: number }) => (
    <DraftWordRow
      entry={item}
      index={index}
      onRemove={onRemove}
      onFrequencyChange={onFrequencyChange}
      palette={palette}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>Review your word list</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Remove words or adjust frequency before you start studying.
        </Text>

        <View style={[styles.columnHeader, { borderBottomColor: palette.border }]}>
          <Text style={[styles.columnTitle, { color: palette.subtext }]}>Word</Text>
          <Text style={[styles.columnTitle, styles.columnRight, { color: palette.subtext }]}>
            Frequency
          </Text>
        </View>

        <FlatList
          data={words}
          keyExtractor={entry => entry.item.id}
          renderItem={renderItem}
          style={styles.list}
        />

        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <StudyButton label="Confirm" variant="primary" size="medium" onPress={onConfirm} style={styles.footerBtn} />
          <StudyButton label="Cancel" variant="secondary" size="medium" onPress={onCancel} style={styles.footerBtn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 20 },
  subtitle: { fontSize: 14, paddingHorizontal: 20, marginTop: 6, marginBottom: 12 },
  columnHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  columnTitle: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  columnRight: { textAlign: 'right', flex: 0, width: 120 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  wordCol: { flex: 1, gap: 2 },
  wordTextBlock: { gap: 2 },
  lemma: { fontSize: 16, fontWeight: '700' },
  english: { fontSize: 13 },
  removeBtn: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  footerBtn: { width: 140 },
});
