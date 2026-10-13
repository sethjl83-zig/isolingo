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
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { StudyType } from '@/src/types/state';
import type { Pool } from '@/src/types/pool';
import StudyButton from '@/src/components/ui/StudyButton';
import { countStudyWords, getDeckSizeLaunchDecision } from '@/src/utils/studyLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

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
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>
          Choose What to Study
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Pool list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {pools.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
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
                style={[
                  styles.poolRow,
                  {
                    backgroundColor: selected ? palette.feedback : palette.card,
                    borderColor: selected ? palette.tint : palette.border,
                    opacity: disabled ? 0.38 : 1,
                  },
                ]}
                onPress={() => !disabled && togglePool(pool.id)}
                activeOpacity={disabled ? 1 : 0.75}
              >
                {/* Checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: disabled ? palette.border : palette.tint,
                      backgroundColor: selected ? palette.tint : 'transparent',
                    },
                  ]}
                >
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>

                {/* Pool info */}
                <View style={styles.poolInfo}>
                  <Text
                    style={[
                      styles.poolName,
                      { color: disabled ? palette.subtext : palette.text },
                    ]}
                    numberOfLines={1}
                  >
                    {pool.name}
                  </Text>
                  <Text style={[styles.poolCount, { color: palette.subtext }]}>
                    {count} {countLabel}
                    {disabled ? ' — no nouns for Gender mode' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Footer with running total and Continue button */}
      <View
        style={[
          styles.footer,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <Text style={[styles.totalText, { color: palette.subtext }]}>
          {canContinue
            ? `${totalCount} ${countLabel} selected`
            : `Select at least one list to continue`}
        </Text>
        <StudyButton
          label={isNavigating ? 'Loading…' : 'Continue'}
          variant="primary"
          size="large"
          onPress={handleContinue}
          disabled={!canContinue || isNavigating}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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

  scroll: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 10,
  },

  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },

  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },

  poolInfo: { flex: 1, gap: 3 },
  poolName: { fontSize: 16, fontWeight: '600' },
  poolCount: { fontSize: 13 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    gap: 10,
    alignItems: 'center',
  },
  totalText: { fontSize: 14 },
});
