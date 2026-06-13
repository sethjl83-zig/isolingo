/**
 * SCREEN — DASHBOARD
 * Returning-user home. Language selector, study mode buttons,
 * vocab banks shortcut, and a stats summary widget.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
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
import { USER_NAME_KEY, CELEBRATION_PENDING_KEY, takePendingCelebration } from './welcome';
import { setListSetupLaunchSource } from './list-setup';

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

// ── Celebration overlay ───────────────────────────────────────────────────────
// Renders on top of the fully-mounted dashboard when a new user arrives.
// Phase 1 (0–1500 ms): centred text throbs + seesaws, confetti bursts.
// Phase 2 (1500–2500 ms): text flies to exact banner position, bg fades away.

const { width: SW, height: SH } = Dimensions.get('window');

const CELEB_FONT_SIZE = 42; // px — must match celebText fontSize below

const CELEB_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6',
  '#FF8C42', '#6CB4EE', '#FFC3E0', '#55EFC4',
  '#E84393', '#F39C12', '#00CEC9', '#6C5CE7',
];

// [w, h, borderRadius] for 5 shape types
const SHAPES: [number, number, number][] = [
  [9, 9, 1],    // square
  [7, 7, 3.5],  // circle
  [4, 22, 2],   // tall streamer
  [13, 13, 2],  // large square
  [11, 5, 1],   // flat rectangle
];

const CELEB_PIECES = Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 100) * Math.PI * 2;
  const [w, h, r] = SHAPES[i % 5];
  const spd   = 0.42 + (i % 7) * 0.09;
  const wave  = Math.floor(i / 50);
  return {
    id:      i,
    color:   CELEB_COLORS[i % CELEB_COLORS.length],
    w, h, r,
    vx:      Math.cos(angle) * (100 + (i % 6) * 22) * spd,
    vy:      Math.sin(angle) * 60 * spd,
    gravity: 260 + (i % 8) * 15,
    rotDeg:  ((i % 9) - 4) * 155,
    delay:   wave * 160 + (i % 6) * 22,
  };
});

function CelebConfettiPiece({ piece }: { piece: typeof CELEB_PIECES[0] }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 2400, easing: Easing.linear }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    const p  = progress.value;
    const ex = p === 0 ? 0 : 1 - Math.pow(1 - p, 2);
    const opacity = p < 0.70 ? 1 : Math.max(0, 1 - (p - 0.70) / 0.30);
    return {
      transform: [
        { translateX: piece.vx * ex },
        { translateY: piece.vy * p + piece.gravity * p * p },
        { rotate: `${piece.rotDeg * p}deg` },
      ],
      opacity,
    };
  });
  return (
    <Animated.View style={[{
      position: 'absolute',
      width: piece.w, height: piece.h,
      backgroundColor: piece.color,
      borderRadius: piece.r,
    }, style]} />
  );
}

// Ease-in-out cubic — must be a worklet so it runs on the UI thread
function easeInOutCubic(t: number) {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface WelcomeLayout { pageX: number; pageY: number; width: number; height: number }

interface CelebrationOverlayProps {
  name: string;
  textColor: string;
  bgColor: string;
  welcomeLayout: WelcomeLayout;
  onComplete: () => void;
}

function CelebrationOverlay({ name, textColor, bgColor, welcomeLayout, onComplete }: CelebrationOverlayProps) {
  // Pre-compute targets once (props don't change after mount)
  const finalTX = useSharedValue(
    (welcomeLayout.pageX + welcomeLayout.width  / 2) - SW / 2,
  );
  const finalTY = useSharedValue(
    (welcomeLayout.pageY + welcomeLayout.height / 2) - SH / 2,
  );
  // Scale to approximate the dashboard heading font size
  const finalS = useSharedValue(38 / CELEB_FONT_SIZE);

  // Single linear progress shared value drives all animations
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2600, easing: Easing.linear });
    const t = setTimeout(onComplete, 2700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opaque background during phase 1, fades during phase 2
  const bgStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p <= 0.577 ? 1 : Math.max(0, 1 - (p - 0.577) / 0.423);
    return { opacity };
  });

  // Text: appear → throb+seesaw (phase 1) → fly to banner (phase 2)
  const textStyle = useAnimatedStyle(() => {
    const p  = progress.value;
    const p1 = Math.min(p / 0.577, 1);
    const p2 = p <= 0.577 ? 0 : (p - 0.577) / 0.423;
    const p2e = easeInOutCubic(p2);

    // Grow in from 0 during first ~15 % of total animation (~390 ms)
    const appear = Math.min(p / 0.15, 1);

    // Throb: 3 sine pulses, ±8 % scale
    const throb   = Math.sin(p1 * Math.PI * 3);
    const p1Scale = appear * (1 + Math.abs(throb) * 0.08);

    // Interpolate to final scale in phase 2
    const curScale = p1Scale * (1 - p2e) + finalS.value * p2e;

    // Seesaw: ±4° decaying oscillation, gone by end of phase 1
    const seesaw = Math.sin(p1 * Math.PI * 3.5) * 4 * Math.pow(1 - p1, 2) * (1 - p2);

    // Translate toward banner in phase 2
    const tx = finalTX.value * p2e;
    const ty = finalTY.value * p2e;

    return {
      opacity: 1,  // text NEVER fades
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${seesaw}deg` },
        { scale: curScale },
      ],
    };
  });

  return (
    <>
      {/* Fading background — blocks dashboard during phase 1, reveals it in phase 2 */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }, bgStyle]}
        pointerEvents="none"
      />

      {/* Confetti + text layer — always fully visible, non-interactive */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Burst origin at screen centre */}
        <View style={celebStyles.confettiOrigin}>
          {CELEB_PIECES.map(p => <CelebConfettiPiece key={p.id} piece={p} />)}
        </View>

        {/* Greeting — centred in screen, then flies to banner */}
        <View style={celebStyles.center}>
          <Animated.Text
            style={[celebStyles.text, { color: textColor }, textStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {`Welcome, ${name}!`}
          </Animated.Text>
        </View>
      </View>
    </>
  );
}

const celebStyles = StyleSheet.create({
  confettiOrigin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: CELEB_FONT_SIZE,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 20,
    maxWidth: SW - 40,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { state, isReady, selectLanguage, selectStudyType, resetApp } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const accent = scheme === 'dark' ? ACCENT_DARK : ACCENT_LIGHT;
  const modeCardGrad = scheme === 'dark' ? MODE_CARD_GRAD_DARK  : MODE_CARD_GRAD_LIGHT;
  const modeCardBg   = modeCardGrad[0];   // flat version for widget backgrounds
  const modeCardText = scheme === 'dark' ? MODE_CARD_TEXT_DARK  : MODE_CARD_TEXT_LIGHT;

  const language = state.languageSelected;

  const [langModalVisible,  setLangModalVisible]  = useState(false);
  const [statsSnap,         setStatsSnap]         = useState<StatsSnapshot>({ mastered: 0, accuracy: -1 });
  const [statsLoading,      setStatsLoading]      = useState(false);
  const [showLangHint,      setShowLangHint]      = useState(false);
  const [welcomeLayout,     setWelcomeLayout]     = useState<WelcomeLayout | null>(null);
  const welcomeWrapRef = useRef<View>(null);

  // ── Synchronous first-run detection ──────────────────────────────────────
  // `takePendingCelebration()` is set in welcome.tsx before navigation,
  // so this runs in the same JS frame as the very first render — zero flash.
  const [celebrationPending] = useState(() => takePendingCelebration());
  const [celebrationActive,  setCelebrationActive] = useState(() => !!celebrationPending);
  const [userName,           setUserName]          = useState<string | null>(
    () => celebrationPending?.name ?? null,
  );

  // For returning users: load name from storage (celebration path already has it).
  // Also handle the edge-case where the app restarted mid-celebration (AsyncStorage backup).
  useEffect(() => {
    if (celebrationActive) {
      // Celebration is firing now via the in-memory path — clear the storage
      // flag immediately so it can never fire again (e.g. when a later
      // navigation mounts a fresh dashboard instance).
      AsyncStorage.removeItem(CELEBRATION_PENDING_KEY);
      return;
    }

    Promise.all([
      AsyncStorage.getItem(USER_NAME_KEY),
      AsyncStorage.getItem(CELEBRATION_PENDING_KEY),
    ]).then(([name, pending]) => {
      if (name) setUserName(name);
      if (pending) {
        AsyncStorage.removeItem(CELEBRATION_PENDING_KEY);
        setCelebrationActive(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWelcomeMeasure = () => {
    welcomeWrapRef.current?.measure((x, y, w, h, pageX, pageY) => {
      if (!welcomeLayout) {
        setWelcomeLayout({ pageX, pageY, width: w, height: h });
      }
    });
  };

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

  if (!isReady) return null;

  // currentLang is null when no language has been chosen yet (new user)
  const currentLang = language ? (LANGUAGES.find(l => l.id === language) ?? LANGUAGES[0]) : null;

  const handleLanguageSelect = (lang: Language) => {
    setLangModalVisible(false);
    if (lang !== language) selectLanguage(lang);
  };

  const handleStudyModePress = (studyType: StudyType) => {
    if (!language) {
      // Remind the user to pick a language first
      setShowLangHint(true);
      setTimeout(() => setShowLangHint(false), 3500);
      return;
    }

    const bank    = state.modeBanks[studyType];
    const hasBank = bank !== null && (bank.activeVocabBank?.length ?? 0) > 0;

    selectStudyType(studyType);
    if (hasBank) {
      router.push('/direction');
    } else {
      setListSetupLaunchSource('study_mode');
      router.push({ pathname: '/list-setup', params: { source: 'study_mode' } });
    }
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
          onPress: async () => {
            await AsyncStorage.clear();
            // AppProvider survives navigation, so the in-memory state must be
            // reset too — otherwise the old language and banks linger and get
            // re-persisted on the next state change.
            resetApp();
            router.replace('/');
          },
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
          <Text style={styles.langFlag}>{currentLang?.flag ?? '🌐'}</Text>
          <Text style={[styles.langName, { color: currentLang ? palette.text : palette.subtext }]}>
            {currentLang?.label ?? 'Select language'}
          </Text>
          <Text style={[styles.chevron, { color: palette.subtext }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* ── Welcome header ──────────────────────────────────────────────────── */}
      <View style={styles.welcomeSection}>
        {/* collapsable={false} ensures Android preserves this View for measure() */}
        <View
          ref={welcomeWrapRef}
          collapsable={false}
          onLayout={handleWelcomeMeasure}
        >
          <Text
            style={[
              styles.welcomeHeading,
              {
                // Hidden while the overlay text is in flight; revealed when overlay unmounts
                color: celebrationActive ? 'transparent' : palette.text,
              },
            ]}
          >
            {userName ? `Welcome, ${userName}!` : 'Welcome!'}
          </Text>
        </View>
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

        {/* Inline prompt shown when user taps a study mode with no language selected */}
        {showLangHint && (
          <Text style={[styles.langHint, { color: accent }]}>
            Select a language from the dropdown above first ↑
          </Text>
        )}

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

      {/* ── Celebration overlay (new-user first launch) ──────────────────────── */}
      {/* Blocking placeholder: keeps the dashboard hidden while we wait for the
          welcome banner's layout measurement to complete. */}
      {celebrationActive && !welcomeLayout && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}
          pointerEvents="none"
        />
      )}

      {celebrationActive && welcomeLayout && userName && (
        <CelebrationOverlay
          name={userName}
          textColor={palette.text}
          bgColor={palette.background}
          welcomeLayout={welcomeLayout}
          onComplete={() => setCelebrationActive(false)}
        />
      )}

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

  // Language hint (shown when a study mode is tapped with no language chosen)
  langHint: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },

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
