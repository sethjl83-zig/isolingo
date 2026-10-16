/**
 * SCREEN — DASHBOARD
 * Returning-user home. Language selector, study mode buttons,
 * vocab banks shortcut, and a stats summary widget.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Pressable, Alert, ActivityIndicator, Dimensions, BackHandler, ScrollView } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import GenderModeIcon from '@/src/components/ui/GenderModeIcon';
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

const FLAG_IMAGES: Record<Language, number> = {
  es: require('@/assets/images/home/flag-es.png'),
  fr: require('@/assets/images/home/flag-fr.png'),
  de: require('@/assets/images/home/flag-de.png'),
};

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
];

interface StatsSnapshot {
  mastered: number;
  accuracy: number; // 0–100, or -1 when no attempts yet
  today: number;
}

// ── Accuracy progress ring ────────────────────────────────────────────────────
// Uses the two-half-circle clip technique to draw an arc proportional to `pct`.
// No external library required.
function RingArc({
  size,
  border,
  color,
  rightRot,
  leftRot,
  showLeft,
}: {
  size: number;
  border: number;
  color: string;
  rightRot: string;
  leftRot: string;
  showLeft: boolean;
}) {
  return (
    <>
      <View style={{ position: 'absolute', right: 0, width: size / 2, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: -(size / 2),
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: border, borderColor: color,
          transform: [{ rotate: rightRot }],
        }} />
      </View>
      {showLeft && (
        <View style={{ position: 'absolute', left: 0, width: size / 2, height: size, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute', right: -(size / 2),
            width: size, height: size,
            borderRadius: size / 2,
            borderWidth: border, borderColor: color,
            transform: [{ rotate: leftRot }],
          }} />
        </View>
      )}
    </>
  );
}

function AccuracyRing({
  pct,
  caption,
  size = 102,
  border = 7,
}: {
  pct: number;       // 0–100, or -1 when no data
  caption?: string;
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
  const showLeft = clamped > 50;
  // Home 5C stacks a teal arc under a purple arc of the same sweep.
  // The purple layer covers the teal one, which is how the frame renders.
  const arcProps = { size: SIZE, border: BORDER, rightRot, leftRot, showLeft };

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <View style={[
        StyleSheet.absoluteFill,
        { borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: '#F2F0FB' },
      ]} />
      <RingArc {...arcProps} color="#70C8BE" />
      <RingArc {...arcProps} color="#6D5CC7" />

      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.ringValue}>
          {hasData ? `${clamped}%` : '—'}
        </Text>
        {caption ? (
          <Text style={styles.ringCaption}>{caption}</Text>
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
  // Scale to the Home heading size (28) as the greeting lands
  const finalS = useSharedValue(28 / CELEB_FONT_SIZE);

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
    fontFamily: HomeFonts.interSemiBold,
    fontSize: CELEB_FONT_SIZE,
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
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <StatusBar style="dark" />
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
                color: celebrationActive ? 'transparent' : '#25262B',
              },
            ]}
          >
            {`Welcome, ${userName ?? ''}!`}
          </Text>
        </View>
        <Text style={styles.studyPrompt}>
          What do you want to study?
        </Text>
      </View>

      {/* ── Language selector ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.langCard}
        onPress={() => setLangModalVisible(true)}
        activeOpacity={0.75}
      >
        <View style={styles.langIconCircle}>
          <Image
            source={require('@/assets/images/home/globe.png')}
            style={styles.globeIcon}
            accessibilityIgnoresInvertColors
          />
        </View>
        <View style={styles.langTextBlock}>
          {currentLang ? (
            <>
              <Text style={styles.langCaption}>Select Language</Text>
              <View style={styles.langCardText}>
                <Text style={styles.langName}>{currentLang.label}</Text>
                <Image source={require('@/assets/images/home/lang-chevron.png')} style={styles.langChevron} />
              </View>
            </>
          ) : (
            <View style={styles.langCardText}>
              <Text style={styles.langCaption}>Select Language</Text>
              <Image source={require('@/assets/images/home/lang-chevron.png')} style={styles.langChevron} />
            </View>
          )}
        </View>
        <View style={styles.langFlagWell}>
          {currentLang ? (
            <Image source={FLAG_IMAGES[currentLang.id]} style={styles.langFlag} />
          ) : null}
        </View>
      </TouchableOpacity>

      {/* ── Study mode cards ────────────────────────────────────────────────── */}
      <View style={styles.modeRow}>

        <TouchableOpacity
          style={styles.modeCard}
          onPress={() => handleStudyModePress('general_vocab')}
          activeOpacity={0.82}
        >
          <View style={styles.modeCardBody}>
            <View style={styles.modeCardMain}>
              <View style={styles.modeIconCircle}>
                <Image source={require('@/assets/images/home/vocab-book.png')} style={styles.modeBookIcon} />
              </View>
              <View>
                <Text style={styles.modeCardLabel}>
                  General Vocabulary
                </Text>
                <Text style={styles.modeCardDesc}>
                  Standard vocabulary practice
                </Text>
              </View>
            </View>
            <Image source={require('@/assets/images/home/card-arrow.png')} style={styles.cardArrow} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeCard}
          onPress={() => handleStudyModePress('gender')}
          activeOpacity={0.82}
        >
          <View style={styles.modeCardBody}>
            <View style={styles.modeCardMain}>
              <View style={styles.modeIconCircle}>
                <GenderModeIcon language={language} size={30} />
              </View>
              <View>
                <Text style={styles.modeCardLabel}>Gender</Text>
                <Text style={styles.modeCardDesc}>
                  Focus on noun gender
                </Text>
              </View>
            </View>
            <Image source={require('@/assets/images/home/card-arrow.png')} style={styles.cardArrow} />
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
      <View style={styles.statsShadow}>
        <TouchableOpacity
          style={styles.statsCard}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FF']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.statsHeader}>
            <Text style={styles.statsCardTitle}>Your Progress</Text>
            <View style={styles.chartBadge}>
              <View style={[styles.chartBar, { left: 9, top: 15.8, height: 10.31 }]} />
              <View style={[styles.chartBar, { left: 14.63, top: 11.11, height: 15 }]} />
              <View style={[styles.chartBar, { left: 20.25, top: 19.55, height: 6.56 }]} />
            </View>
          </View>

          {statsLoading ? (
            <View style={styles.statsSpinner}>
              <ActivityIndicator size="small" color="#5E51A4" />
            </View>
          ) : (
            <View style={styles.statsBody}>
              <AccuracyRing
                pct={statsSnap.accuracy}
                caption="Accuracy"
              />
              <View style={styles.statsCol}>
                <View style={styles.statRowMastered}>
                  <Text style={styles.statLabel}>Mastered</Text>
                  <Text style={styles.statValueMastered}>{statsSnap.mastered.toLocaleString()}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Today</Text>
                  <Text style={styles.statValueToday}>{statsSnap.today}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.detailsBtn}>
            <Text style={styles.detailsBtnText}>View Details</Text>
            <Image
              source={require('@/assets/images/home/details-arrow.png')}
              style={styles.detailsArrow}
              accessibilityIgnoresInvertColors
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── My Vocabulary ────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.vocabBankBtn}
        onPress={() => {
          if (!state.languageSelected) {
            Alert.alert('No language selected', 'Please select a language from the dropdown first.');
            return;
          }
          router.push('/my-lists' as never);
        }}
        activeOpacity={0.8}
      >
        <Image source={require('@/assets/images/home/my-vocab-book.png')} style={styles.myVocabIcon} />
        <Text style={styles.vocabBankLabel}>My Vocabulary</Text>
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
                <Image source={FLAG_IMAGES[lang.id]} style={styles.langOptionFlag} />
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

const shadow12 = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const shadow6 = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 68,
    paddingBottom: 0,
    gap: 20,
  },

  // ── Welcome header ───────────────────────────────────────────────────────────
  welcomeSection: {
    gap: 3,
  },
  welcomeHeading: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 28,
    lineHeight: 34,
    color: '#25262B',
  },
  studyPrompt: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14.5,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  // ── Language card ────────────────────────────────────────────────────────────
  langCard: {
    height: 71,
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    ...shadow12,
  },
  langIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EDFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeIcon: { width: 22, height: 22 },
  langTextBlock: { flex: 1, justifyContent: 'center', marginLeft: 15, gap: 3 },
  langCaption: {
    fontFamily: HomeFonts.jakartaMedium,
    fontSize: 11.5,
    lineHeight: 14,
    color: 'rgba(0,0,0,0.8)',
  },
  langCardText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langFlagWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EDFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langFlag: { width: 32, height: 32, borderRadius: 16 },
  langName: {
    fontFamily: HomeFonts.jakartaMedium,
    fontSize: 16,
    lineHeight: 24,
    color: '#2D2A26',
  },
  langChevron: { width: 12, height: 12 },

  // Study mode cards
  modeRow: { flexDirection: 'row', gap: 11 },
  modeCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 175,
    maxWidth: 175,
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#766BB2',
    backgroundColor: '#5E51A4',
    paddingHorizontal: 12,
    paddingVertical: 18,
    ...shadow6,
  },
  modeCardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 15,
  },
  modeCardMain: {
    flex: 1,
    alignSelf: 'stretch',
    gap: 10,
  },
  modeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: 'rgba(254,252,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBookIcon: { width: 25, height: 25 },
  cardArrow: { width: 12, height: 12 },
  modeCardLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 12.8,
    lineHeight: 28,
    color: '#FEFCFA',
  },
  modeCardDesc: {
    fontFamily: HomeFonts.jakartaMedium,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(254,252,250,0.6)',
  },

  ringValue: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 22,
    lineHeight: 24,
    color: '#25262B',
  },
  ringCaption: {
    marginTop: 2,
    fontFamily: HomeFonts.jakartaMedium,
    fontSize: 10,
    lineHeight: 15,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.6)',
  },

  // Vocab button
  vocabBankBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FDE6B9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...shadow6,
  },
  myVocabIcon: { width: 22, height: 16 },
  vocabBankLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 16,
    lineHeight: 28,
    color: '#6B3B06',
  },

  // Language hint (shown when a study mode is tapped with no language chosen)
  langHint: {
    textAlign: 'center',
    fontFamily: HomeFonts.jakartaMedium,
    fontSize: 14,
    paddingHorizontal: 8,
  },

  // ── Stats widget ─────────────────────────────────────────────────────────────
  statsShadow: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    ...shadow12,
  },
  statsCard: {
    height: 275,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(210,232,215,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 21,
    gap: 20,
    overflow: 'hidden',
  },
  statsHeader: {
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsCardTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.6)',
  },
  chartBadge: {
    width: 33,
    height: 35,
    borderRadius: 8,
    backgroundColor: '#EAF0F1',
  },
  chartBar: {
    position: 'absolute',
    width: 3.75,
    backgroundColor: '#38A19A',
  },
  statsSpinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsBody: {
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    paddingBottom: 8,
  },
  statsCol: { flex: 1, gap: 20 },
  statRowMastered: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(102,102,102,0.2)',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.6)',
  },
  statValueMastered: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontSize: 24,
    lineHeight: 30,
    color: '#5E51A4',
  },
  statValueToday: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontSize: 24,
    lineHeight: 24,
    color: '#38A19A',
  },
  detailsBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#38A19A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailsBtnText: {
    fontFamily: HomeFonts.interSemiBold,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
  },
  detailsArrow: { width: 12, height: 12 },

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
  langOptionFlag: { width: 32, height: 32, borderRadius: 16 },
  langOptionLabel: { flex: 1, fontSize: 17, fontWeight: '600' },
  checkmark: { fontSize: 18, fontWeight: '700' },
});
