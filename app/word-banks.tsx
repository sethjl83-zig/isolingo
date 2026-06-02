/**
 * SCREEN — WORD BANKS
 * Overview of the two per-mode vocab banks with View/Edit or Set Up actions.
 */
import React, { useEffect } from 'react';
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
import { useAppContext } from '@/src/context/AppContext';
import type { StudyType } from '@/src/types/state';
import StudyButton from '@/src/components/ui/StudyButton';

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab Bank',
  gender: 'Gender Bank',
};

const MODE_DESCRIPTIONS: Record<StudyType, string> = {
  general_vocab: 'Translation and vocabulary cards',
  gender: 'Noun gender and article cards',
};

const MODE_ICONS: Record<StudyType, string> = {
  general_vocab: '📚',
  gender: '🏷️',
};

const STUDY_TYPES: StudyType[] = ['general_vocab', 'gender'];

export default function WordBanksScreen() {
  const router = useRouter();
  const { state, isReady, selectStudyType, hasModeBank, getModeBank } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  useEffect(() => {
    if (isReady && !language) {
      router.replace('/');
    }
  }, [isReady, language, router]);

  if (!isReady || !language) return null;

  const handleViewEdit = (studyType: StudyType) => {
    selectStudyType(studyType);
    router.push('/vocab-bank');
  };

  const handleSetUp = (studyType: StudyType) => {
    selectStudyType(studyType);
    router.push('/list-setup');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>My Word Banks</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.content}>
        {STUDY_TYPES.map(studyType => {
          const hasBank = hasModeBank(studyType);
          const bank = getModeBank(studyType);
          const wordCount = bank?.activeVocabBank.length ?? 0;

          return (
            <View
              key={studyType}
              style={[styles.bankCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.bankCardLeft}>
                <Text style={styles.bankIcon}>{MODE_ICONS[studyType]}</Text>
                <View style={styles.bankInfo}>
                  <Text style={[styles.bankLabel, { color: palette.text }]}>
                    {MODE_LABELS[studyType]}
                  </Text>
                  <Text style={[styles.bankDesc, { color: palette.subtext }]}>
                    {MODE_DESCRIPTIONS[studyType]}
                  </Text>
                  {hasBank && (
                    <Text style={[styles.bankCount, { color: palette.tint }]}>
                      {wordCount} {wordCount === 1 ? 'word' : 'words'}
                    </Text>
                  )}
                </View>
              </View>

              <StudyButton
                label={hasBank ? 'View / Edit' : 'Set Up'}
                variant={hasBank ? 'secondary' : 'primary'}
                size="small"
                onPress={() => (hasBank ? handleViewEdit(studyType) : handleSetUp(studyType))}
              />
            </View>
          );
        })}
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
  topBarSpacer: { minWidth: 60 },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },

  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  bankCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  bankIcon: { fontSize: 32 },
  bankInfo: { flex: 1, gap: 3 },
  bankLabel: { fontSize: 16, fontWeight: '700' },
  bankDesc: { fontSize: 13 },
  bankCount: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
