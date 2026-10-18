import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const infoIcon = require('@/assets/images/gameplay/info.png');

interface Props {
  tone: 'info' | 'correct';
  children: React.ReactNode;
}

/** Purple info note from Gameplay 2C. Correct uses the same card in teal. */
export default function FeedbackNote({ tone, children }: Props) {
  const correct = tone === 'correct';
  return (
    <View style={[styles.note, correct && styles.correct]}>
      <Image
        source={infoIcon}
        style={styles.icon}
        tintColor={correct ? '#38A19A' : undefined}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(94,81,164,0.06)',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  correct: {
    backgroundColor: 'rgba(56,161,154,0.08)',
  },
  icon: { width: 20, height: 20 },
  body: { flex: 1, gap: 4 },
});
