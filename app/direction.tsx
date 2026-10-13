/**
 * SCREEN — DIRECTION SELECT
 * Reached from Dashboard after tapping a study mode that already has a bank.
 * Reads studyTypeSelected from global state (set by dashboard before navigating here).
 * Lets the user pick a study direction, then starts the session.
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { StudyType, DirectionMode } from '@/src/types/state';
import type { Language } from '@/src/types/vocab';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};

function getDirectionOptions(langName: string): { id: DirectionMode; label: string; desc: string }[] {
  return [
    {
      id: 'target_to_native',
      label: `${langName} → English`,
      desc: `See the ${langName} word, type English`,
    },
    {
      id: 'native_to_target',
      label: `English → ${langName}`,
      desc: `See English, type the ${langName} word`,
    },
    {
      id: 'mixed',
      label: 'Mixed (Random)',
      desc: 'Both directions at random',
    },
  ];
}

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab',
  gender: 'Gender',
};

export default function DirectionScreen() {
  const router = useRouter();
  const { state, setDirectionMode } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  // Pool IDs and deck size are forwarded from select-study-list / deck-size to session.
  const { poolIds, deckSize } = useLocalSearchParams<{ poolIds?: string; deckSize?: string }>();

  // studyTypeSelected is set by the dashboard before navigating here.
  const studyType: StudyType = state.studyTypeSelected ?? 'general_vocab';
  const directionMode = state.directionMode;

  const langName = state.languageSelected
    ? (LANGUAGE_NAMES[state.languageSelected] ?? 'Target')
    : 'Target';
  const directionOptions = getDirectionOptions(langName);

  const handleStart = () => {
    router.replace({
      pathname: '/session',
      params: { poolIds: poolIds ?? '', deckSize: deckSize ?? '' },
    } as never);
  };

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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>
          {MODE_LABELS[studyType]}
        </Text>
        <View style={styles.spacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.heading, { color: palette.text }]}>Study Direction</Text>
        <Text style={[styles.subheading, { color: palette.subtext }]}>
          Choose how you want to see the cards
        </Text>

        <View style={styles.options}>
          {directionOptions.map(opt => {
            const selected = directionMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? palette.feedback : palette.card,
                    borderColor: selected ? palette.tint : palette.border,
                  },
                ]}
                onPress={() => setDirectionMode(opt.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.radioOuter, { borderColor: palette.tint }]}>
                  {selected && (
                    <View style={[styles.radioInner, { backgroundColor: palette.tint }]} />
                  )}
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: palette.text }]}>{opt.label}</Text>
                  <Text style={[styles.optionDesc, { color: palette.subtext }]}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <StudyButton
          label="Start Study"
          variant="primary"
          size="large"
          onPress={handleStart}
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
  screenTitle: { fontSize: 17, fontWeight: '600' },
  spacer: { minWidth: 60 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 16,
  },
  heading: { fontSize: 26, fontWeight: '800' },
  subheading: { fontSize: 15, marginTop: -8 },

  options: { gap: 12, marginTop: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  optionDesc: { fontSize: 13 },
});
