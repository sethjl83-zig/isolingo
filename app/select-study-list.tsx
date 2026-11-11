/**
 * SCREEN — SELECT STUDY LIST
 * Shown after tapping a study-mode button on the Dashboard when pools already
 * exist. Tapping one list continues that list's saved deck, or opens
 * Deck Size when the list has no saved deck and more than 10 eligible words.
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
import { resolveSingleListLaunch } from '@/src/utils/listDeckLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');

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

  const [isNavigating, setIsNavigating] = useState(false);
  const countLabel = isGender ? 'nouns' : 'words';

  const openList = useCallback(async (pool: Pool) => {
    if (isNavigating || !language) return;
    setIsNavigating(true);
    try {
      const launch = await resolveSingleListLaunch(pool, language, studyType);
      if (launch.screen === 'deck-size') {
        router.push({
          pathname: '/deck-size',
          params: { poolIds: launch.poolIds, totalCount: launch.totalCount },
        } as never);
      } else {
        router.push({
          pathname: '/direction',
          params: {
            poolIds: launch.poolIds,
            deckSize: launch.deckSize,
            deckIds: launch.deckIds,
          },
        } as never);
      }
    } finally {
      setIsNavigating(false);
    }
  }, [isNavigating, language, studyType, router]);

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
        <View pointerEvents="none" style={styles.titleOverlay}>
          <Text style={styles.screenTitle} numberOfLines={1}>
            Choose What to Study
          </Text>
        </View>
        <View style={styles.headerRow} pointerEvents="box-none">
        {showHome ? (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={12}
            accessibilityLabel="Home"
            style={styles.headerControl}
          >
            <Text style={styles.homeLink}>Home</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={8}
            accessibilityLabel="Back"
            style={[styles.backBtn, styles.headerControl, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
          >
            <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        )}
        </View>
      </View>

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

            return (
              <TouchableOpacity
                key={pool.id}
                style={[styles.cardShadow, disabled && styles.rowDisabled]}
                onPress={() => !disabled && openList(pool)}
                activeOpacity={disabled ? 1 : 0.75}
                disabled={disabled || isNavigating}
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
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 56,
  },
  headerControl: { zIndex: 1 },
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
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
    includeFontPadding: false,
  },

  scroll: { flex: 1, marginTop: 25 },
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
});
