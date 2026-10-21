/**
 * SCREEN — SELECT STUDY LIST
 * Shown after tapping a study-mode button on the Dashboard when pools already
 * exist. The user multi-selects which pool(s) to include in the upcoming
 * session, sees a live running total, then taps Continue → deck-size (first time)
 * or direction screen (when a deck size is already saved for this context).
 *
 * Back always returns to the Dashboard (not to intermediate creation screens).
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import type { StudyType } from '@/src/types/state';
import type { Pool } from '@/src/types/pool';
import StudyButton from '@/src/components/ui/StudyButton';
import { countStudyWords, getDeckSizeLaunchDecision } from '@/src/utils/studyLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const checkIcon = require('@/assets/images/lists/check-white.png');

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Number of nouns in a pool that have an assigned gender (gender-mode eligible). */
function countNouns(pool: Pool): number {
  return pool.words.filter(
    pw => pw.item.partOfSpeech === 'noun' && pw.item.gender !== null,
  ).length;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SelectStudyListScreen() {
  const router = useRouter();
  const { fromExit } = useLocalSearchParams<{ fromExit?: string | string[] }>();
  const showHome = fromExit === '1' || (Array.isArray(fromExit) && fromExit.includes('1'));
  const { state, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const studyType: StudyType = state.studyTypeSelected ?? 'general_vocab';
  const language = state.languageSelected;
  const isGender = studyType === 'gender';

  const pools = useMemo(
    () => (language ? getLanguagePools(language) : []),
    [language, getLanguagePools],
  );

  // Pre-compute the relevant word count per pool (nouns for gender, all for vocab)
  const poolCounts = useMemo<Record<string, number>>(
    () =>
      Object.fromEntries(
        pools.map(p => [p.id, isGender ? countNouns(p) : p.words.length]),
      ),
    [pools, isGender],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isNavigating, setIsNavigating] = useState(false);

  const togglePool = (poolId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        next.delete(poolId);
      } else {
        next.add(poolId);
      }
      return next;
    });
  };

  const totalCount = useMemo(
    () =>
      Array.from(selectedIds).reduce(
        (sum, id) => sum + (poolCounts[id] ?? 0),
        0,
      ),
    [selectedIds, poolCounts],
  );

  const canContinue = selectedIds.size > 0;
  const countLabel = isGender ? 'nouns' : 'words';

  const handleContinue = useCallback(async () => {
    if (!canContinue || isNavigating || !language) return;
    setIsNavigating(true);

    const ids = Array.from(selectedIds);
    const poolIdsStr = JSON.stringify(ids);
    const selectedPools = pools.filter(p => selectedIds.has(p.id));

    try {
      const { showDeckSizePicker, deckSize } = await getDeckSizeLaunchDecision(
        language,
        studyType,
        ids,
        countStudyWords(selectedPools, studyType),
      );

      if (showDeckSizePicker) {
        router.push({
          pathname: '/deck-size',
          params: {
            poolIds: poolIdsStr,
            totalCount: String(totalCount),
          },
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
    } finally {
      setIsNavigating(false);
    }
  }, [canContinue, isNavigating, language, studyType, selectedIds, pools, totalCount, router]);

  const handleBack = useCallback(() => {
    // Navigate to dashboard, popping any intermediate creation screens from
    // the stack (router.navigate pops to an existing ancestor route).
    router.navigate('/dashboard' as never);
  }, [router]);

  useAndroidBackHandler(
    useCallback(() => {
      handleBack();
      return true;
    }, [handleBack]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        {showHome ? (
          <TouchableOpacity
            onPress={handleBack}
            accessibilityLabel="Home"
          >
            <Text style={styles.homeLink}>Home</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={8}
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
          >
            <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        )}
        <Text style={styles.screenTitle} pointerEvents="none">
          Choose What to Study
        </Text>
      </View>

      <Text style={styles.totalText}>
        {canContinue
          ? `${totalCount} ${countLabel} selected`
          : `Select at least one list to continue`}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
      >
        {pools.length === 0 ? (
          <Text style={styles.emptyText}>
            No lists found. Go back and create one first.
          </Text>
        ) : (
          pools.map(pool => {
            const count = poolCounts[pool.id] ?? 0;
            const disabled = isGender && count === 0;
            const selected = selectedIds.has(pool.id);

            return (
              <TouchableOpacity
                key={pool.id}
                style={[styles.cardShadow, disabled && styles.rowDisabled]}
                onPress={() => !disabled && togglePool(pool.id)}
                activeOpacity={disabled ? 1 : 0.75}
              >
                <View style={[styles.card, { borderColor: palette.listCardBorder }]}>
                  <View style={styles.poolInfo}>
                    <Text
                      style={[styles.poolName, disabled && styles.poolNameDisabled]}
                      numberOfLines={1}
                    >
                      {pool.name}
                    </Text>
                    <Text style={styles.poolCount}>
                      {count} {countLabel}
                      {disabled ? ' — no nouns for Gender mode' : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      selected
                        ? { backgroundColor: palette.teal, borderColor: palette.teal }
                        : { backgroundColor: 'transparent', borderColor: 'rgba(0,0,0,0.2)' },
                    ]}
                  >
                    {selected && (
                      <Image
                        source={checkIcon}
                        style={styles.checkIcon}
                        accessibilityIgnoresInvertColors
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <StudyButton
          label={isNavigating ? 'Loading…' : 'Continue'}
          variant="primary"
          size="medium"
          onPress={handleContinue}
          disabled={!canContinue || isNavigating}
          style={styles.continueBtn}
          textStyle={styles.continueLabel}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },

  topBar: {
    height: 36,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 17,
    height: 17,
    transform: [{ rotate: '-90deg' }],
  },
  homeLink: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 18,
    color: '#5E51A4',
  },
  screenTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
  },

  totalText: {
    marginTop: 25,
    marginHorizontal: 16,
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  scroll: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 10,
  },

  emptyText: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  card: {
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowDisabled: { opacity: 0.45 },
  poolInfo: { flex: 1, gap: 6 },
  poolName: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#25262B',
  },
  poolNameDisabled: { color: 'rgba(0,0,0,0.45)' },
  poolCount: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 13.5,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.6)',
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { width: 18, height: 18 },

  bottomBar: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 29,
    paddingHorizontal: 29,
    backgroundColor: '#F7F5FD',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  continueBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  continueLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
});
