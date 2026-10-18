/**
 * SCREEN — STATS
 * Two tabs: Current Stats (pool words) and Lifetime Stats (all words ever studied).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { loadLanguageStatsBundle, type LangStats, type DailyCardCounts } from '@/src/storage/statsStorage';
import type { WordStatsEntry } from '@/src/types/stats';
import {
  getPoolWords,
  competencyCountsForWords,
  getCurrentPoolEntries,
  last7DayBarData,
  topWordsByPersonalBest,
  buildLemmaLookup,
  formatLemma,
  computeLanguageAccuracy,
  type DayBarDatum,
} from '@/src/utils/statsHelpers';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const globe = require('@/assets/images/stats/globe.png');
const emptyBars = require('@/assets/images/stats/empty-bars.png');
const starIcon = require('@/assets/images/stats/star.png');
const muscleIcon = require('@/assets/images/stats/muscle.png');
const weakIcon = require('@/assets/images/stats/weak.png');
const cardsIcon = require('@/assets/images/stats/cards-done.png');
const wordsIcon = require('@/assets/images/stats/words-studied.png');
const attemptIcon = require('@/assets/images/stats/attempt.png');
const flameIcon = require('@/assets/images/stats/flame.png');
const viewMoreChevron = require('@/assets/images/stats/view-more.png');

type Tab = 'current' | 'lifetime';
type Palette = (typeof Colors)['light'];

const LANGUAGE_LABELS: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish' };

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export default function StatsScreen() {
  const router = useRouter();
  const { state, isReady, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;
  const pools = language ? getLanguagePools(language) : [];
  const poolWords = useMemo(() => getPoolWords(pools), [pools]);
  const poolWordIds = useMemo(() => new Set(poolWords.map(w => w.id)), [poolWords]);
  const lemmaLookup = useMemo(() => buildLemmaLookup(pools), [pools]);

  const [tab, setTab] = useState<Tab>('current');
  const [langStats, setLangStats] = useState<LangStats>({});
  const [dailyCounts, setDailyCounts] = useState<DailyCardCounts>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  const loadData = useCallback(async () => {
    if (!language) return;
    setLoading(true);
    try {
      // Reloads word stats + daily Card 1006 counts from AsyncStorage on each visit.
      const bundle = await loadLanguageStatsBundle(language);
      setLangStats(bundle.wordStats);
      setDailyCounts(bundle.dailyCounts);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  if (!isReady || !language) return null;

  const allEntries = Object.values(langStats);

  const currentCounts = competencyCountsForWords(poolWordIds, langStats, true);
  const poolEntries = getCurrentPoolEntries(poolWords, langStats);

  const lifetimeTotalCards = allEntries.reduce((sum, e) => sum + e.lifetimeAttempts, 0);
  const lifetimeUniqueWords = allEntries.length;
  const lifetimeAccuracyPct = computeLanguageAccuracy(langStats);
  const lifetimeAccuracy = lifetimeAccuracyPct >= 0 ? `${lifetimeAccuracyPct}%` : '—';
  const topPersonalBest = topWordsByPersonalBest(langStats, 5);
  const barData = last7DayBarData(dailyCounts);
  const chromeGap = tab === 'current' ? 25 : 20;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={styles.chrome}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Back"
            activeOpacity={0.75}
          >
            <Image source={backChevron} style={styles.backIcon} resizeMode="contain" accessible={false} />
          </TouchableOpacity>
          <Text style={styles.screenTitle} pointerEvents="none">Stats</Text>
          <View style={styles.langPill}>
            <Image source={globe} style={styles.globe} resizeMode="contain" accessible={false} />
            <Text style={[styles.langLabel, { color: palette.primary }]}>
              {LANGUAGE_LABELS[language] ?? language}
            </Text>
          </View>
        </View>

        <View style={[styles.segmentTrack, { marginTop: chromeGap }]}>
          {(['current', 'lifetime'] as Tab[]).map(t => {
            const selected = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segment, selected && { backgroundColor: palette.primary }, selected && styles.segmentOn]}
                onPress={() => setTab(t)}
                activeOpacity={0.75}
              >
                <Text style={[styles.segmentLabel, { color: selected ? '#FFFFFF' : palette.primary }]}>
                  {t === 'current' ? 'Current Stats' : 'Lifetime Stats'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: chromeGap }]}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'current' ? (
            <CurrentStatsTab
              palette={palette}
              counts={currentCounts}
              poolEntries={poolEntries}
            />
          ) : (
            <LifetimeStatsTab
              palette={palette}
              totalCards={lifetimeTotalCards}
              uniqueWords={lifetimeUniqueWords}
              accuracy={lifetimeAccuracy}
              topWords={topPersonalBest}
              lemmaLookup={lemmaLookup}
              barData={barData}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

interface CurrentProps {
  palette: Palette;
  counts: { mastered: number; strong: number; weak: number };
  poolEntries: Array<{ word: { id: string; lemma: string }; entry: WordStatsEntry | null }>;
}

function CurrentStatsTab({ palette, counts, poolEntries }: CurrentProps) {
  const [wordsExpanded, setWordsExpanded] = useState(false);
  const total = counts.mastered + counts.strong + counts.weak;
  const hasData = total > 0;
  const visibleWords = wordsExpanded ? poolEntries : poolEntries.slice(0, 4);
  const showViewMore = !wordsExpanded && poolEntries.length > 4;

  return (
    <View style={styles.stack20}>
      {!hasData && (
        <EmptyNote text="Add words to your vocabulary lists to see current stats." />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Competency Breakdown</Text>
        <View style={styles.card}>
          <MetricRow
            well="rgba(56,161,154,0.12)"
            icon={starIcon}
            iconStyle={styles.starIcon}
            title="Mastered"
            detail="10 consecutive first-attempt correct"
            detailSize={13}
            value={String(counts.mastered)}
            palette={palette}
          />
          <View style={styles.divider} />
          <MetricRow
            well="rgba(93,176,250,0.12)"
            icon={muscleIcon}
            iconStyle={styles.muscleIcon}
            title="Strong"
            detail="7+ correct in last 10"
            detailSize={13.5}
            value={String(counts.strong)}
            palette={palette}
          />
          <View style={styles.divider} />
          <MetricRow
            well="rgba(247,72,86,0.12)"
            icon={weakIcon}
            iconStyle={styles.weakIcon}
            title="Weak"
            detail="Needs more practice"
            detailSize={13.5}
            value={String(counts.weak)}
            palette={palette}
          />
        </View>
      </View>

      {poolEntries.length > 0 && (
        <View style={styles.section}>
          <View style={styles.wordHeader}>
            <Text style={styles.sectionTitle}>Words in Your Lists</Text>
            {showViewMore && (
              <TouchableOpacity
                style={styles.viewMore}
                onPress={() => setWordsExpanded(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.viewMoreLabel}>View More</Text>
                <Image source={viewMoreChevron} style={styles.viewMoreChevron} resizeMode="contain" accessible={false} />
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.card, styles.wordCard]}>
            {visibleWords.map(({ word, entry }, idx) => (
              <React.Fragment key={word.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.wordRow}>
                  <View style={styles.wordMain}>
                    <Text style={styles.wordLemma} numberOfLines={1}>{word.lemma}</Text>
                    <ResultDots results={entry?.last10Results ?? []} />
                  </View>
                  <View style={styles.flameRow}>
                    <Image source={flameIcon} style={styles.flame} resizeMode="contain" accessible={false} />
                    <Text style={styles.flameCount}>{entry?.currentStreak ?? 0}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

interface LifetimeProps {
  palette: Palette;
  totalCards: number;
  uniqueWords: number;
  accuracy: string;
  topWords: WordStatsEntry[];
  lemmaLookup: Map<string, string>;
  barData: DayBarDatum[];
}

function LifetimeStatsTab({
  palette,
  totalCards,
  uniqueWords,
  accuracy,
  topWords,
  lemmaLookup,
  barData,
}: LifetimeProps) {
  const hasData = totalCards > 0;
  const maxBar = Math.max(...barData.map(d => d.count), 1);

  return (
    <View style={{ gap: hasData ? 15 : 20 }}>
      {!hasData && (
        <EmptyNote text="No lifetime data yet — start studying to build your history." />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.card}>
          <MetricRow
            well="rgba(56,161,154,0.12)"
            icon={cardsIcon}
            iconStyle={styles.cardsIcon}
            title="Cards Done"
            value={String(totalCards)}
            palette={palette}
          />
          <View style={styles.divider} />
          <MetricRow
            well="rgba(93,176,250,0.12)"
            icon={wordsIcon}
            iconStyle={styles.wordsIcon}
            title="Words Studied"
            value={String(uniqueWords)}
            palette={palette}
          />
          <View style={styles.divider} />
          <MetricRow
            well="rgba(253,168,53,0.12)"
            icon={attemptIcon}
            iconStyle={styles.attemptIcon}
            title="1st Attempt"
            value={accuracy}
            palette={palette}
          />
        </View>
      </View>

      {topWords.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Longest Streaks</Text>
          <View style={styles.card}>
            {topWords.map((entry, idx) => (
              <React.Fragment key={entry.wordId}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.streakRow}>
                  <Text style={styles.streakLemma} numberOfLines={1}>
                    {formatLemma(entry.wordId, lemmaLookup)}
                  </Text>
                  <View style={styles.flameRow}>
                    <Image source={flameIcon} style={styles.flame} resizeMode="contain" accessible={false} />
                    <Text style={styles.flameCount}>{entry.personalBestStreak}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cards per Day (Last 7 Days)</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {barData.map(datum => {
              const full = datum.count > 0 && datum.count >= maxBar;
              const fill = datum.count > 0 ? (datum.count / maxBar) * 100 : 0;
              return (
                <View key={datum.dateKey} style={styles.barCol}>
                  {datum.count > 0 && (
                    <Text style={styles.barCount}>{datum.count}</Text>
                  )}
                  <View style={styles.barTrack}>
                    {datum.count > 0 && (
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${fill}%`,
                            borderTopLeftRadius: full ? 6 : 4,
                            borderTopRightRadius: full ? 6 : 4,
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={styles.barLabel}>{datum.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Image source={emptyBars} style={styles.emptyIcon} resizeMode="contain" accessible={false} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function MetricRow({
  well,
  icon,
  iconStyle,
  title,
  detail,
  detailSize = 13.5,
  value,
  palette,
}: {
  well: string;
  icon: number;
  iconStyle: object;
  title: string;
  detail?: string;
  detailSize?: number;
  value: string;
  palette: Palette;
}) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricMain}>
        <View style={[styles.well, { backgroundColor: well }]}>
          <Image source={icon} style={iconStyle} resizeMode="contain" accessible={false} />
        </View>
        <View style={styles.metricCopy}>
          <Text style={styles.metricTitle}>{title}</Text>
          {detail ? (
            <Text style={[styles.metricDetail, { color: palette.detailText, fontSize: detailSize }]}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.metricValue, { color: palette.teal }]}>{value}</Text>
    </View>
  );
}

function ResultDots({ results }: { results: boolean[] }) {
  const slots = 10;
  const shown = results.slice(-slots);
  const padded: (boolean | null)[] = shown.concat(Array(slots - shown.length).fill(null));

  return (
    <View style={styles.dotsRow}>
      {padded.map((val, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                val === null ? 'rgba(0,0,0,0.2)' : val ? '#38A19A' : '#F74856',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chrome: { paddingHorizontal: 16 },
  header: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,81,164,0.15)',
    zIndex: 1,
  },
  backIcon: {
    width: 17,
    height: 17,
    transform: [{ rotate: '-90deg' }],
  },
  screenTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 1,
    ...cardShadow,
  },
  globe: { width: 16, height: 16 },
  langLabel: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13.5,
    lineHeight: 24,
  },

  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...cardShadow,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  segmentOn: cardShadow,
  segmentLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 34 },
  stack20: { gap: 20 },
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    color: '#000000',
  },

  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  emptyIcon: { width: 40, height: 41 },
  emptyText: {
    width: 198,
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    fontSize: 14,
    color: 'rgba(0,0,0,0.6)',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    padding: 15,
    gap: 8,
    ...cardShadow,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 20,
    ...cardShadow,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(210,232,215,0.8)',
  },
  wordCard: { gap: 10 },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  viewMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(253,230,185,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  viewMoreLabel: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 14.5,
    lineHeight: 18,
    color: '#6B3B06',
  },
  viewMoreChevron: { width: 7, height: 12 },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  well: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: { width: 27, height: 25 },
  muscleIcon: { width: 28, height: 26 },
  weakIcon: { width: 40, height: 40 },
  cardsIcon: { width: 32, height: 32 },
  wordsIcon: { width: 30, height: 32 },
  attemptIcon: { width: 30, height: 30 },
  metricCopy: { flex: 1, gap: 0 },
  metricTitle: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },
  metricDetail: {
    fontFamily: HomeFonts.jakartaRegular,
    fontWeight: 'normal',
    lineHeight: 20,
  },
  metricValue: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 24,
    lineHeight: 24,
  },

  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingRight: 2,
  },
  wordMain: { flex: 1, gap: 6 },
  wordLemma: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13.5,
    lineHeight: 24,
    color: '#000000',
  },
  flameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flame: { width: 20, height: 20 },
  flameCount: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakLemma: {
    flex: 1,
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },

  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barCount: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 12,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.6)',
  },
  barTrack: {
    width: '100%',
    maxWidth: 42,
    height: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#38A19A',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  barLabel: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 12,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.6)',
  },
});
