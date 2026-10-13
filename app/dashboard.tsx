/**
 * SCREEN — DASHBOARD
 * Returning-user home. Language selector, study mode buttons,
 * vocab banks shortcut, and a stats summary widget.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  BackHandler,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { ensureLanguageStatsLoaded } from '@/src/storage/statsStorage';
import {
  countMasteredInPools,
  computeLanguageAccuracy,
  getTodayCardCount,
} from '@/src/utils/statsHelpers';
import { USER_NAME_KEY, CELEBRATION_PENDING_KEY, takePendingCelebration } from './welcome';
import { setAddListLaunchSource } from './add-list';
import { countStudyWords, getDeckSizeLaunchDecision } from '@/src/utils/studyLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
];

interface StatsSnapshot {
  mastered: number;
  accuracy: number; // 0–100, or -1 when no attempts yet
  today: number;
}

// ── Accuracy progress ring ────────────────────────────────────────────────────
// Uses the two-half-circle clip technique to draw an arc proportional to `pct`.
// No external library required.
function AccuracyRing({
  pct,
  fillColor,
  trackColor,
  textColor,
  caption,
  captionColor,
  size = 92,
  border = 8,
}: {
  pct: number;       // 0–100, or -1 when no data
  fillColor: string;
  trackColor: string;
  textColor: string;
  caption?: string;
  captionColor?: string;
  size?: number;
  border?: number;
}) {
  const SIZE   = size;
  const BORDER = border;
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
        <Text style={{ fontSize: 20, fontWeight: '700', color: textColor }}>
          {hasData ? `${clamped}%` : '—'}
        </Text>
        {caption ? (
          <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: captionColor ?? textColor, marginTop: 1 }}>
            {caption}
          </Text>
        ) : null}
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
  const finalS = useSharedValue(30 / CELEB_FONT_SIZE);

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
  const {
    state, isReady, selectLanguage, selectStudyType,
    getLanguagePools, getDefaultPools,
  } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  const [langModalVisible,  setLangModalVisible]  = useState(false);
  const [statsSnap,         setStatsSnap]         = useState<StatsSnapshot>({ mastered: 0, accuracy: -1, today: 0 });
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
      const { wordStats, dailyCounts } = await ensureLanguageStatsLoaded(language);
      const pools = getLanguagePools(language);
      const mastered = countMasteredInPools(pools, wordStats);
      const accuracy = computeLanguageAccuracy(wordStats);
      const today = getTodayCardCount(dailyCounts);
      setStatsSnap({ mastered, accuracy, today });
    } finally {
      setStatsLoading(false);
    }
  }, [language, getLanguagePools]);

  useFocusEffect(useCallback(() => { refreshStats(); }, [refreshStats]));

  useAndroidBackHandler(
    useCallback(() => {
      Alert.alert('Exit app?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    }, []),
  );

  if (!isReady) return null;

  // currentLang is null when no language has been chosen yet (new user)
  const currentLang = language ? (LANGUAGES.find(l => l.id === language) ?? LANGUAGES[0]) : null;

  const handleLanguageSelect = (lang: Language) => {
    setLangModalVisible(false);
    if (lang !== language) selectLanguage(lang);
  };

  const handleStudyModePress = async (studyType: StudyType) => {
    if (!language) {
      setShowLangHint(true);
      setTimeout(() => setShowLangHint(false), 3500);
      return;
    }

    selectStudyType(studyType);

    const pools = getLanguagePools(language);
    if (pools.length === 0) {
      // No pools yet — send user to the creation choice screen.
      setAddListLaunchSource('study_mode', studyType);
      router.push('/add-list' as never);
      return;
    }

    // Check for a saved default pool selection for this study type + language.
    const defaultPools = getDefaultPools(studyType, language);
    if (defaultPools.length > 0) {
      // A default exists — skip the list picker entirely.
      const poolIds = defaultPools.map(p => p.id);
      const poolIdsStr = JSON.stringify(poolIds);
      const totalCount = countStudyWords(defaultPools, studyType);

      const { showDeckSizePicker, deckSize } = await getDeckSizeLaunchDecision(
        language,
        studyType,
        poolIds,
        totalCount,
      );

      if (showDeckSizePicker) {
        router.push({
          pathname: '/deck-size',
          params: { poolIds: poolIdsStr, totalCount: String(totalCount) },
        } as never);
      } else {
        router.push({
          pathname: '/direction',
          params: {
            poolIds: poolIdsStr,
            deckSize: deckSize !== null ? String(deckSize) : '',
          },
        } as never);
      }
      return;
    }

    // No default set — show the multi-select list picker.
    router.push('/select-study-list' as never);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

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
            {`Welcome, ${userName ?? ''}!`}
          </Text>
        </View>
        <Text style={[styles.studyPrompt, { color: palette.subtext }]}>
          What do you want to study?
        </Text>
      </View>

      {/* ── Language selector ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.langCard, { backgroundColor: palette.card }]}
        onPress={() => setLangModalVisible(true)}
        activeOpacity={0.75}
      >
        <View style={[styles.langIconCircle, { backgroundColor: palette.iconCircle }]}>
          <MaterialIcons name="public" size={22} color={palette.primary} />
        </View>
        <View style={styles.langTextBlock}>
          {currentLang ? (
            <>
              <Text style={[styles.langCaption, { color: palette.subtext }]}>Select Language</Text>
              <View style={styles.langCardText}>
                <Text style={[styles.langName, { color: palette.text }]}>{currentLang.label}</Text>
                <Text style={[styles.chevron, { color: palette.subtext }]}>▼</Text>
              </View>
            </>
          ) : (
            <View style={styles.langCardText}>
              <Text style={[styles.langCaption, { color: palette.subtext }]}>Select Language</Text>
              <Text style={[styles.chevron, { color: palette.subtext }]}>▼</Text>
            </View>
          )}
        </View>
        <Text style={styles.langFlag}>{currentLang?.flag ?? '🌐'}</Text>
      </TouchableOpacity>

      {/* ── Study mode cards ────────────────────────────────────────────────── */}
      <View style={styles.modeRow}>

        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: palette.primary }]}
          onPress={() => handleStudyModePress('general_vocab')}
          activeOpacity={0.82}
        >
          <View style={styles.modeIconCircle}>
            <MaterialIcons name="menu-book" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.modeCardLabel}>
            General Vocabulary
          </Text>
          <Text style={styles.modeCardDesc}>
            Standard vocabulary practice
          </Text>
          <View style={styles.modeChevronRow}>
            <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.92)" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: palette.primary }]}
          onPress={() => handleStudyModePress('gender')}
          activeOpacity={0.82}
        >
          <View style={styles.modeIconCircle}>
            <MaterialIcons name="transgender" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.modeCardLabel}>Gender</Text>
          <Text style={styles.modeCardDesc}>
            Focus on noun gender
          </Text>
          <View style={styles.modeChevronRow}>
            <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.92)" />
          </View>
        </TouchableOpacity>

      </View>

      {/* Inline prompt shown when user taps a study mode with no language selected */}
      {showLangHint && (
        <Text style={[styles.langHint, { color: palette.primary }]}>
          Select a language from the dropdown above first ↑
        </Text>
      )}

      {/* ── Stats widget ─────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.statsCard, { backgroundColor: palette.progressCard }]}
        onPress={() => router.push('/stats')}
        activeOpacity={0.85}
      >
        <View style={styles.statsHeader}>
          <Text style={[styles.statsCardTitle, { color: palette.text }]}>Your Progress</Text>
          <View style={[styles.chartBadge, { backgroundColor: `${palette.teal}26` }]}>
            <MaterialIcons name="bar-chart" size={18} color={palette.teal} />
          </View>
        </View>

        {statsLoading ? (
          <View style={styles.statsSpinner}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : (
          <View style={styles.statsBody}>
            <AccuracyRing
              pct={statsSnap.accuracy}
              fillColor={palette.primary}
              trackColor={palette.badgeFill}
              textColor={palette.text}
              caption="Accuracy"
              captionColor={palette.subtext}
            />
            <View style={styles.statsCol}>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Mastered</Text>
                <Text style={[styles.statValue, { color: palette.text }]}>{statsSnap.mastered}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: palette.subtext }]}>Today</Text>
                <Text style={[styles.statValue, { color: palette.teal }]}>{statsSnap.today}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.detailsBtn, { backgroundColor: palette.teal }]}>
          <Text style={styles.detailsBtnText}>View Details →</Text>
        </View>
      </TouchableOpacity>

      {/* ── My Vocabulary ────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.vocabBankBtn, { backgroundColor: palette.amberFill }]}
        onPress={() => {
          if (!state.languageSelected) {
            Alert.alert('No language selected', 'Please select a language from the dropdown first.');
            return;
          }
          router.push('/my-lists' as never);
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="book-open-outline" size={20} color={palette.amberText} />
        <Text style={[styles.vocabBankLabel, { color: palette.amberText }]}>My Vocabulary</Text>
      </TouchableOpacity>

      </ScrollView>

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

const cardShadow = {
  shadowColor: '#2A2640',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },

  // ── Welcome header ───────────────────────────────────────────────────────────
  welcomeSection: {
    gap: 4,
    marginBottom: 4,
  },
  welcomeHeading: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  studyPrompt: {
    fontSize: 16,
    fontWeight: '400',
  },

  // ── Language card ────────────────────────────────────────────────────────────
  langCard: {
    height: 71,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...cardShadow,
  },
  langIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTextBlock: { flex: 1, justifyContent: 'center' },
  langCaption: { fontSize: 12, fontWeight: '500' },
  langCardText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  langFlag: { fontSize: 28 },
  langName: { fontSize: 16, fontWeight: '600' },
  chevron: { fontSize: 11, marginTop: 1 },

  // Study mode cards
  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: {
    flex: 1,
    minHeight: 168,
    borderRadius: 11,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    alignItems: 'flex-start',
    ...cardShadow,
  },
  modeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardLabel: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  modeCardDesc: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: 'rgba(255,255,255,0.78)',
  },
  modeChevronRow: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    paddingTop: 8,
  },

  // Vocab button
  vocabBankBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...cardShadow,
  },
  vocabBankLabel: { fontSize: 16, fontWeight: '600' },

  // Language hint (shown when a study mode is tapped with no language chosen)
  langHint: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },

  // ── Stats widget ─────────────────────────────────────────────────────────────
  statsCard: {
    height: 274,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    ...cardShadow,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  chartBadge: {
    width: 33,
    height: 33,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSpinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsCol: { flex: 1 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statDivider: { height: 1, marginVertical: 12 },
  detailsBtn: {
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

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
