/**
 * SCREEN — ADD LIST
 * Choice screen: the user picks how they want to build a new vocabulary pool.
 *
 * Module-level launch-source state lets the Dashboard signal that the user
 * arrived here from a study-mode tap (no pools existed yet). Creation screens
 * read this to decide where to navigate after the pool is saved.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import type { StudyType } from '@/src/types/state';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

// ── Launch-source tracking ────────────────────────────────────────────────────

export type AddListLaunchSource = 'my_lists' | 'study_mode';

let _addListSource: AddListLaunchSource = 'my_lists';
let _addListStudyType: StudyType | null = null;

/** Call this before navigating to /add-list from a study-mode button. */
export function setAddListLaunchSource(
  source: AddListLaunchSource,
  studyType?: StudyType,
): void {
  _addListSource = source;
  _addListStudyType = studyType ?? null;
}

/** Read by creation screens (random-list, curated-list, build-your-own). */
export function getAddListLaunchSource(): {
  source: AddListLaunchSource;
  studyType: StudyType | null;
} {
  return { source: _addListSource, studyType: _addListStudyType };
}

interface ChoiceCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  palette: (typeof Colors)['light'];
}

function ChoiceCard({ icon, title, description, onPress, palette }: ChoiceCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: palette.subtext }]}>{description}</Text>
      </View>
      <Text style={[styles.chevron, { color: palette.subtext }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function AddListScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Add List</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          How do you want to build your list?
        </Text>

        <ChoiceCard
          icon="📖"
          title="Curated Lists"
          description="Words organized by topic"
          onPress={() => router.push('/curated-list' as never)}
          palette={palette}
        />

        <ChoiceCard
          icon="✏️"
          title="Build Your Own"
          description="Choose your own words"
          onPress={() => router.push('/build-your-own' as never)}
          palette={palette}
        />

        <ChoiceCard
          icon="🎲"
          title="Random"
          description="Randomly selected words"
          onPress={() => router.push('/random-list' as never)}
          palette={palette}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { fontSize: 15, fontWeight: '500', minWidth: 60 },
  screenTitle: { fontSize: 17, fontWeight: '700' },
  topBarSpacer: { minWidth: 60 },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 14,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  cardIcon: { fontSize: 30 },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  chevron: { fontSize: 22, fontWeight: '300' },
});
