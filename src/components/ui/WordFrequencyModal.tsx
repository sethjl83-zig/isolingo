import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HomeFonts } from '@/constants/homeFonts';
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
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.iconBadge}>
            <MaterialIcons name="tune" size={35} color="#5E51A4" />
          </View>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.wordList}>
            {words.map(word => (
              <View key={word.id} style={styles.wordRow}>
                {words.length > 1 && (
                  <Text style={styles.lemma}>{word.lemma}</Text>
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
            size="medium"
            onPress={handleDismiss}
            style={styles.doneBtn}
            textStyle={styles.doneLabel}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 28,
  },
  sheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  iconBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(94,81,164,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  wordList: { gap: 10, alignSelf: 'stretch', alignItems: 'center' },
  wordRow: { alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  lemma: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 14.8,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  doneBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  doneLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
});
