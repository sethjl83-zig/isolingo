/**
 * SCREEN — CURATED LISTS (placeholder)
 * Full curated-list browsing flow to be implemented in the next phase.
 */
import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import StudyButton from '@/src/components/ui/StudyButton';

export default function CuratedListScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.container}>
        <Text style={styles.emoji}>📖</Text>
        <Text style={[styles.title, { color: palette.text }]}>Curated Lists</Text>
        <Text style={[styles.desc, { color: palette.subtext }]}>
          Coming soon — browse hand-picked lists organised by topic and difficulty.
        </Text>
        <StudyButton
          label="← Back"
          variant="secondary"
          size="medium"
          onPress={() => router.back()}
          style={styles.backBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emoji:   { fontSize: 52 },
  title:   { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  desc:    { fontSize: 16, textAlign: 'center', lineHeight: 23, marginBottom: 8 },
  backBtn: { marginTop: 8 },
});
