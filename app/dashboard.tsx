/**
 * SCREEN — DASHBOARD
 * Returning-user home. Language selector, study mode buttons,
 * vocab banks shortcut, and a stats summary widget.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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

// Warm coral-orange accent — clearly distinct from gender colours
// (#4da3ff masc · #d66aa6 fem · #A4922D neut)
const ACCENT_LIGHT = '#E07651';
const ACCENT_DARK  = '#F09070';

// Mode card palette: soft, slightly desaturated blue-gray with gradient
// Gradient: lighter at top-center → slightly darker at bottom edges (soft light-from-above)
const MODE_CARD_GRAD_LIGHT: [string, string] = ['#C9DCED', '#A6BCDA'];
const MODE_CARD_GRAD_DARK:  [string, string] = ['#274562', '#152F4A'];
const MODE_CARD_TEXT_LIGHT = '#143360';   // deep navy for contrast on light bg
const MODE_CARD_TEXT_DARK  = '#C2D8EF';   // pale blue for contrast on dark bg

const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
];

interface StatsSnapshot {
  mastered: number;
  accuracy: number; // 0–100, or -1 when no attempts yet
}

// ── Accuracy progress ring ────────────────────────────────────────────────────
// Uses the two-half-circle clip technique to draw an arc proportional to `pct`.
// No external library required.
function AccuracyRing({
  pct,
  fillColor,
  trackColor,
  textColor,
}: {
  pct: number;       // 0–100, or -1 when no data
  fillColor: string;
  trackColor: string;
  textColor: string;
}) {
  const SIZE   = 64;
  const BORDER = 5;
  const hasData    = pct >= 0;
  const clamped    = hasData ? Math.max(0, Math.min(100, pct)) : 0;

  // Right half covers 0–50 %; rotate from –180° (empty) to 0° (half full)
  const rightRot = `${(clamped / 50) * 180 - 180}deg`;
  // Left half covers 50–100 %; only rendered when > 50 %
  const leftRot  = clamped > 50 ? `${((clamped - 50) / 50) * 180 - 180}deg` : '-180deg';

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      {/* Empty track */}
      <View style={[
        StyleSheet.absoluteFill,
        { borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: trackColor },
      ]} />

      {/* Right-half fill (0–50 %) */}
      <View style={{ position: 'absolute', right: 0, width: SIZE / 2, height: SIZE, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: -(SIZE / 2),
          width: SIZE, height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: BORDER, borderColor: fillColor,
          transform: [{ rotate: rightRot }],
        }} />
      </View>

      {/* Left-half fill (50–100 %) */}
      {clamped > 50 && (
        <View style={{ position: 'absolute', left: 0, width: SIZE / 2, height: SIZE, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute', right: -(SIZE / 2),
            width: SIZE, height: SIZE,
            borderRadius: SIZE / 2,
            borderWidth: BORDER, borderColor: fillColor,
            transform: [{ rotate: leftRot }],
          }} />
        </View>
      )}

      {/* Centre label */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: textColor }}>
          {hasData ? `${clamped}%` : '—'}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { state, isReady, selectLanguage, selectStudyType } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const accent = scheme === 'dark' ? ACCENT_DARK : ACCENT_LIGHT;
  const modeCardGrad = scheme === 'dark' ? MODE_CARD_GRAD_DARK  : MODE_CARD_GRAD_LIGHT;
  const modeCardBg   = modeCardGrad[0];   // flat version for widget backgrounds
  const modeCardText = scheme === 'dark' ? MODE_CARD_TEXT_DARK  : MODE_CARD_TEXT_LIGHT;

  const language = state.languageSelected;

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [statsSnap, setStatsSnap] = useState<StatsSnapshot>({ mastered: 0, accuracy: -1 });
  const [statsLoading, setStatsLoading] = useState(false);

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
      let mastered = 0;
      let totalAttempts = 0;
      let firstAttemptCorrect = 0;

      for (const entry of Object.values(langStats)) {
        if (getCompetencyLevel(entry) === 'mastered') mastered++;
        totalAttempts += entry.lifetimeTotalAttempts ?? 0;
        firstAttemptCorrect += entry.lifetimeFirstAttemptCorrect ?? 0;
      }

      const accuracy = totalAttempts > 0
        ? Math.round((firstAttemptCorrect / totalAttempts) * 100)
        : -1;

      setStatsSnap({ mastered, accuracy });
    } finally {
      setStatsLoading(false);
    }
  }, [language]);

  useFocusEffect(useCallback(() => { refreshStats(); }, [refreshStats]));

  if (!isReady || !language) return null;

  const currentLang = LANGUAGES.find(l => l.id === language) ?? LANGUAGES[0];

  const handleLanguageSelect = (lang: Language) => {
    setLangModalVisible(false);
    if (lang !== language) selectLanguage(lang);
  };

  const handleStudyModePress = (studyType: StudyType) => {
    const bank = state.modeBanks[studyType];
    const hasBank = bank !== null && (bank.activeVocabBank?.length ?? 0) > 0;

    console.log('[Dashboard] handleStudyModePress:', {
      studyType,
      hasBank,
      bankWordCount: bank?.activeVocabBank?.length ?? 0,
      fullModeBanks: JSON.stringify(state.modeBanks),
    });

    selectStudyType(studyType);
    router.push(hasBank ? '/direction' : '/list-setup');
  };

  // ── DEV ONLY — remove before publishing ─────────────────────────────────────
  const handleResetAppData = () => {
    Alert.alert(
      'Reset App Data',
      'This will wipe all saved data and restart as a fresh install. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => { await AsyncStorage.clear(); router.replace('/'); },
        },
      ],
    );
  };
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.langPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.langFlag}>{currentLang.flag}</Text>
          <Text style={[styles.langName, { color: palette.text }]}>{currentLang.label}</Text>
          <Text style={[styles.chevron, { color: palette.subtext }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* ── Welcome header ──────────────────────────────────────────────────── */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeHeading, { color: palette.text }]}>Welcome!</Text>
        <Text style={[styles.studyPrompt, { color: palette.subtext }]}>
          What do you want to study?
        </Text>
      </View>

      {/* ── Central action area ─────────────────────────────────────────────── */}
      <View style={styles.actionArea}>

        {/* Study mode cards */}
        <View style={styles.modeRow}>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleStudyModePress('general_vocab')}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={modeCardGrad}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.modeCardLabel, { color: modeCardText }]}>
              General{'\n'}Vocab
            </Text>
            <Text style={[styles.modeCardIcon, { color: modeCardText }]}>📖</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleStudyModePress('gender')}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={modeCardGrad}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.modeCardLabel, { color: modeCardText }]}>Gender</Text>
            <Text style={[styles.modeCardIcon, { color: modeCardText }]}>⚥</Text>
          </TouchableOpacity>

        </View>

        {/* My Vocab Banks — narrower, centred, softer */}
        <View style={styles.vocabBankRow}>
          <TouchableOpacity
            style={[styles.vocabBankBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/word-banks')}
            activeOpacity={0.8}
          >
            <Text style={styles.vocabBankIcon}>🗂</Text>
            <Text style={[styles.vocabBankLabel, { color: palette.tint }]}>My Vocabulary</Text>
          </TouchableOpacity>
        </View>

        {/* DEV ONLY — remove before publishing */}
        <TouchableOpacity style={styles.devResetBtn} onPress={handleResetAppData}>
          <Text style={styles.devResetText}>🛠 Reset App Data</Text>
        </TouchableOpacity>

      </View>

      {/* ── Stats widget ─────────────────────────────────────────────────────── */}
      <View style={styles.statsSection}>
        <TouchableOpacity
          style={[
            styles.statsCard,
            { backgroundColor: modeCardBg, borderColor: '#2251CC' },
          ]}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          {/* Header row */}
          <View style={styles.statsCardHeader}>
            <Text style={[styles.statsCardTitle, { color: modeCardText }]}>STATS</Text>
            <Text style={[styles.statsCardArrow, { color: modeCardText }]}>View details →</Text>
          </View>

          {statsLoading ? (
            <ActivityIndicator size="small" color={modeCardText} style={styles.statsSpinner} />
          ) : (
            <View style={styles.metricsRow}>

              {/* Mastered — no icon */}
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: modeCardText }]}>{statsSnap.mastered}</Text>
                <Text style={[styles.metricLabel, { color: modeCardText + '99' }]}>Mastered</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: modeCardText + '40' }]} />

              {/* Accuracy — true percentage arc */}
              <View style={styles.metric}>
                <AccuracyRing
                  pct={statsSnap.accuracy}
                  fillColor={modeCardText}
                  trackColor={modeCardText + '30'}
                  textColor={modeCardText}
                />
                <Text style={[styles.metricLabel, { color: modeCardText + '99' }]}>Accuracy</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: modeCardText + '40' }]} />

              {/* Today — no icon */}
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: modeCardText }]}>—</Text>
                <Text style={[styles.metricLabel, { color: modeCardText + '99' }]}>Today</Text>
              </View>

            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Language selection modal ─────────────────────────────────────────── */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable style={styles.langOverlay} onPress={() => setLangModalVisible(false)}>
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

  // ── Top bar ──────────────────────────────────────────────────────────────────
  topBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'flex-start',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  langFlag: { fontSize: 24 },
  langName: { fontSize: 18, fontWeight: '600' },
  chevron: { fontSize: 13, marginTop: 1 },

  // ── Welcome header (plain text, no card) ────────────────────────────────────
  welcomeSection: {
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 6,
  },
  welcomeHeading: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  studyPrompt: {
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.2,
  },

  // ── Action area ──────────────────────────────────────────────────────────────
  actionArea: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,        // intentional breathing room below the prompt
    justifyContent: 'flex-start',
    gap: 16,
  },

  // Study mode cards
  modeRow: { flexDirection: 'row', gap: 14 },
  modeCard: {
    flex: 1,
    minHeight: 190,
    borderRadius: 22,
    overflow: 'hidden',         // clips the highlight overlay
    paddingVertical: 32,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    // Top border acts as a "light reflection" highlight line
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#2C6BED',
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  modeCardLabel: {
    fontSize: 35,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 0.15,
  },
  modeCardIcon: {
    fontSize: 104,
    lineHeight: 118,
    textAlign: 'center',
  },

  // Vocab Banks button
  vocabBankRow: { alignItems: 'center' },
  vocabBankBtn: {
    width: '65%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  vocabBankIcon: { fontSize: 21 },
  vocabBankLabel: { fontSize: 18, fontWeight: '600' },

  // Dev reset
  devResetBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  devResetText: { fontSize: 12, color: '#BBBBBB', fontWeight: '500' },

  // ── Stats widget ─────────────────────────────────────────────────────────────
  statsSection: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  statsCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  statsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statsCardArrow: { fontSize: 12, fontWeight: '600' },
  statsSpinner: { marginVertical: 10 },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  metricDivider: { width: 1, height: 64 },   // matches AccuracyRing SIZE
  metricValue: { fontSize: 42, fontWeight: '800', lineHeight: 48 },
  metricLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },

  // ── Language modal ───────────────────────────────────────────────────────────
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
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
