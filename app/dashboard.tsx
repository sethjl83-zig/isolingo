/**
 * SCREEN — DASHBOARD
 * Returning-user home. Language selector, study mode buttons,
 * word-banks shortcut, and a stats summary widget.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { Language } from '@/src/types/vocab';
import type { StudyType } from '@/src/types/state';
import { loadStatsForLanguage } from '@/src/storage/statsStorage';
import { getCompetencyLevel } from '@/src/types/stats';
import StudyButton from '@/src/components/ui/StudyButton';

const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
];

const STUDY_MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab',
  gender: 'Gender',
};

interface StatsSnapshot {
  mastered: number;
  strong: number;
  weak: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const {
    state,
    isReady,
    selectLanguage,
    selectStudyType,
  } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [statsSnap, setStatsSnap] = useState<StatsSnapshot>({ mastered: 0, strong: 0, weak: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Redirect to language selection if no language set
  useEffect(() => {
    if (isReady && !language) {
      router.replace('/');
    }
  }, [isReady, language, router]);

  const refreshStats = useCallback(async () => {
    if (!language) return;
    setStatsLoading(true);
    try {
      const langStats = await loadStatsForLanguage(language);
      let mastered = 0, strong = 0, weak = 0;
      for (const entry of Object.values(langStats)) {
        const level = getCompetencyLevel(entry);
        if (level === 'mastered') mastered++;
        else if (level === 'strong') strong++;
        else weak++;
      }
      setStatsSnap({ mastered, strong, weak });
    } finally {
      setStatsLoading(false);
    }
  }, [language]);

  // Reload stats whenever screen comes into focus (e.g. returning from session)
  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [refreshStats]),
  );

  if (!isReady || !language) return null;

  const currentLang = LANGUAGES.find(l => l.id === language) ?? LANGUAGES[0];

  const handleLanguageSelect = (lang: Language) => {
    setLangModalVisible(false);
    if (lang !== language) {
      selectLanguage(lang);
    }
  };

  const handleStudyModePress = (studyType: StudyType) => {
    // Read modeBanks directly from state — no callback staleness possible.
    const bank = state.modeBanks[studyType];
    const hasBank = bank !== null && (bank.activeVocabBank?.length ?? 0) > 0;

    console.log('[Dashboard] handleStudyModePress:', {
      studyType,
      hasBank,
      bankWordCount: bank?.activeVocabBank?.length ?? 0,
      fullModeBanks: JSON.stringify(state.modeBanks),
    });

    // Always call selectStudyType first so state.studyTypeSelected is set
    // before the next screen mounts (both list-setup and direction need it).
    selectStudyType(studyType);

    if (!hasBank) {
      router.push('/list-setup');
      return;
    }

    // Bank exists → navigate to the direction selection screen.
    // The direction screen reads studyType from state.studyTypeSelected.
    router.push('/direction');
  };

  // ── DEV ONLY — remove before publishing ─────────────────────────────────────
  const handleResetAppData = () => {
    Alert.alert(
      'Reset App Data',
      'This will wipe all saved data and restart as a fresh install. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/');
          },
        },
      ],
    );
  };
  // ────────────────────────────────────────────────────────────────────────────

  const totalStudied = statsSnap.mastered + statsSnap.strong + statsSnap.weak;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* ── Language selector ─────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.langPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.langFlag}>{currentLang.flag}</Text>
          <Text style={[styles.langName, { color: palette.text }]}>{currentLang.label}</Text>
          <Text style={[styles.chevron, { color: palette.subtext }]}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: palette.text }]}>Isolingo</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          What would you like to study?
        </Text>

        {/* Study mode buttons */}
        <View style={styles.modeGroup}>
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: palette.buttonPrimary }]}
            onPress={() => handleStudyModePress('general_vocab')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeCardIcon}>📚</Text>
            <Text style={[styles.modeCardLabel, { color: palette.buttonPrimaryText }]}>
              General Vocab
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: palette.buttonPrimary }]}
            onPress={() => handleStudyModePress('gender')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeCardIcon}>🏷️</Text>
            <Text style={[styles.modeCardLabel, { color: palette.buttonPrimaryText }]}>Gender</Text>
          </TouchableOpacity>
        </View>

        {/* Word Banks */}
        <StudyButton
          label="My Word Banks"
          variant="secondary"
          size="medium"
          onPress={() => router.push('/word-banks')}
          style={styles.wordBanksBtn}
        />

        {/* ── DEV ONLY — remove before publishing ── */}
        <TouchableOpacity style={styles.devResetBtn} onPress={handleResetAppData}>
          <Text style={styles.devResetText}>🛠 Reset App Data</Text>
        </TouchableOpacity>

        {/* Stats widget */}
        <TouchableOpacity
          style={[styles.statsWidget, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => router.push('/stats')}
          activeOpacity={0.8}
        >
          <View style={styles.statsHeader}>
            <Text style={[styles.statsTitle, { color: palette.text }]}>Your Progress</Text>
            <Text style={[styles.statsHint, { color: palette.tint }]}>View details →</Text>
          </View>

          {statsLoading ? (
            <ActivityIndicator size="small" color={palette.tint} style={styles.statsSpinner} />
          ) : totalStudied === 0 ? (
            <Text style={[styles.statsEmpty, { color: palette.subtext }]}>
              No words studied yet — start a session to see your stats.
            </Text>
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={[styles.statNumber, { color: palette.correct }]}>
                  {statsSnap.mastered}
                </Text>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Mastered</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statNumber, { color: palette.tint }]}>
                  {statsSnap.strong}
                </Text>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Strong</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statNumber, { color: palette.incorrect }]}>
                  {statsSnap.weak}
                </Text>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Weak</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Language selection modal ───────────────────────────────────────────── */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        {/* Backdrop — tapping outside the card closes the modal */}
        <Pressable style={styles.langOverlay} onPress={() => setLangModalVisible(false)}>
          {/* onPress={() => {}} blocks backdrop from firing when user taps inside the card */}
          <Pressable style={[styles.langSheet, { backgroundColor: palette.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Select Language</Text>
            {LANGUAGES.map((lang, idx) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.langOption,
                  idx < LANGUAGES.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.border,
                  },
                  lang.id === language && { backgroundColor: palette.feedback },
                ]}
                onPress={() => handleLanguageSelect(lang.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.langOptionFlag}>{lang.flag}</Text>
                <Text style={[styles.langOptionLabel, { color: palette.text }]}>{lang.label}</Text>
                {lang.id === language && (
                  <Text style={[styles.checkmark, { color: palette.tint }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  langFlag: { fontSize: 22 },
  langName: { fontSize: 15, fontWeight: '600' },
  chevron: { fontSize: 12, marginTop: 1 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
  },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, marginTop: -6 },

  modeGroup: { flexDirection: 'row', gap: 14 },
  modeCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  modeCardIcon: { fontSize: 32 },
  modeCardLabel: { fontSize: 16, fontWeight: '700' },

  wordBanksBtn: { alignSelf: 'stretch' },

  statsWidget: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: { fontSize: 15, fontWeight: '700' },
  statsHint: { fontSize: 13, fontWeight: '500' },
  statsEmpty: { fontSize: 14, lineHeight: 20 },
  statsSpinner: { marginVertical: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 30, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 44, marginHorizontal: 8 },

  devResetBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14 },
  devResetText: { fontSize: 13, color: '#999', fontWeight: '500' },

  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },

  // ── Language modal (centred card) ─────────────────────────────────────────
  langOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 24,
  },
  langSheet: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    gap: 4,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
  },
  langOptionFlag: { fontSize: 28 },
  langOptionLabel: { flex: 1, fontSize: 17, fontWeight: '600' },
  checkmark: { fontSize: 18, fontWeight: '700' },
});
