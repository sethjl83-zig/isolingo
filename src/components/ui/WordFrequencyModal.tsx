import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/theme';
import { useSessionWordMgmt } from '@/src/context/SessionWordMgmtContext';
import type { WordFrequencySetting } from '@/src/types/state';
import FrequencySnapSlider from './FrequencySnapSlider';
import StudyButton from './StudyButton';

export interface WordFrequencyTarget {
  id: string;
  lemma: string;
}

interface Props {
  visible: boolean;
  words: WordFrequencyTarget[];
  onDismiss: () => void;
}

export default function WordFrequencyModal({ visible, words, onDismiss }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { getFrequency, setFrequency } = useSessionWordMgmt();
  const [draft, setDraft] = useState<Record<string, WordFrequencySetting>>({});

  useEffect(() => {
    if (!visible) return;
    const initial: Record<string, WordFrequencySetting> = {};
    for (const word of words) {
      initial[word.id] = getFrequency(word.id);
    }
    setDraft(initial);
  }, [visible, words, getFrequency]);

  const handleDismiss = useCallback(() => {
    for (const word of words) {
      const next = draft[word.id];
      if (!next) continue;
      if (next !== getFrequency(word.id)) {
        setFrequency(word.id, next);
      }
    }
    onDismiss();
  }, [words, draft, getFrequency, setFrequency, onDismiss]);

  const title =
    words.length === 1 ? `Frequency — ${words[0].lemma}` : 'Word Frequency';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => {}}
        >
          <View style={[styles.iconBadge, { backgroundColor: `${palette.tint}22` }]}>
            <MaterialIcons name="tune" size={22} color={palette.tint} />
          </View>

          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>

          <View style={styles.wordList}>
            {words.map(word => (
              <View key={word.id} style={styles.wordRow}>
                {words.length > 1 && (
                  <Text style={[styles.lemma, { color: palette.text }]}>{word.lemma}</Text>
                )}
                <FrequencySnapSlider
                  value={draft[word.id] ?? getFrequency(word.id)}
                  onChange={freq =>
                    setDraft(prev => ({ ...prev, [word.id]: freq }))
                  }
                />
              </View>
            ))}
          </View>

          <StudyButton
            label="Done"
            variant="primary"
            size="large"
            onPress={handleDismiss}
            style={styles.doneBtn}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 28,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  wordList: { gap: 18 },
  wordRow: { alignItems: 'center', gap: 8 },
  lemma: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneBtn: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 28,
    minWidth: 0,
    marginTop: 8,
  },
});
