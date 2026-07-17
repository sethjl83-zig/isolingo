/**
 * SCREEN — STATS
 * Two tabs: Current Stats (pool words) and Lifetime Stats (all words ever studied).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
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

type Tab = 'current' | 'lifetime';

const LANGUAGE_LABELS: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish' };

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

  if (!isReady || !language) return null;

  const allEntries = Object.values(langStats);

  const currentCounts = competencyCountsForWords(poolWordIds, langStats, true);
  const poolEntries = getCurrentPoolEntries(poolWords, langStats);

  const lifetimeTotalCards = allEntries.reduce((sum, e) => sum + e.lifetimeAttempts, 0);
  const lifetimeUniqueWords = allEntries.length;
  const lifetimeFirstAttemptCorrect = allEntries.reduce(
    (sum, e) => sum + e.lifetimeFirstAttemptCorrect,
    0,
  );
  const lifetimeTotalAttempts = allEntries.reduce(
    (sum, e) => sum + e.lifetimeAttempts,
    0,
  );
  const lifetimeAccuracyPct = computeLanguageAccuracy(langStats);
  const lifetimeAccuracy = lifetimeAccuracyPct >= 0 ? `${lifetimeAccuracyPct}%` : '—';
  const topPersonalBest = topWordsByPersonalBest(langStats, 5);
  const barData = last7DayBarData(dailyCounts);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Stats</Text>
        <Text style={[styles.langTag, { color: palette.subtext }]}>
          {LANGUAGE_LABELS[language] ?? language}
        </Text>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: palette.border }]}>
        {(['current', 'lifetime'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: palette.tint, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: tab === t ? palette.tint : palette.subtext },
              ]}
            >
              {t === 'current' ? 'Current Stats' : 'Lifetime Stats'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={palette.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

interface Palette {
  text: string; subtext: string; card: string; border: string;
  tint: string; correct: string; incorrect: string; background: string;
}

interface CurrentProps {
  palette: Palette;
  counts: { mastered: number; strong: number; weak: number };
  poolEntries: Array<{ word: { id: string; lemma: string }; entry: WordStatsEntry | null }>;
}

function CurrentStatsTab({ palette, counts, poolEntries }: CurrentProps) {
  const total = counts.mastered + counts.strong + counts.weak;
  const hasData = total > 0;

  return (
    <View style={styles.tabContent}>
      {!hasData && (
        <Text style={[styles.emptyNote, { color: palette.subtext }]}>
          Add words to your vocabulary lists to see current stats.
        </Text>
      )}

      <SectionTitle palette={palette} title="Competency Breakdown" />
      <View style={[styles.breakdownCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.triRow}>
          <StatCell palette={palette} value={String(counts.mastered)} label="Mastered" color={palette.correct} />
          <Divider palette={palette} />
          <StatCell palette={palette} value={String(counts.strong)} label="Strong" color={palette.tint} />
          <Divider palette={palette} />
          <StatCell palette={palette} value={String(counts.weak)} label="Weak" color={palette.incorrect} />
        </View>
        {total > 0 && (
          <View style={[styles.breakdownBar, { backgroundColor: palette.border }]}>
            {counts.mastered > 0 && (
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: counts.mastered, backgroundColor: palette.correct },
                ]}
              />
            )}
            {counts.strong > 0 && (
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: counts.strong, backgroundColor: palette.tint },
                ]}
              />
            )}
            {counts.weak > 0 && (
              <View
                style={[
                  styles.breakdownSegment,
                  { flex: counts.weak, backgroundColor: palette.incorrect },
                ]}
              />
            )}
          </View>
        )}
      </View>
      <Text style={[styles.noteText, { color: palette.subtext }]}>
        Mastered = 10 consecutive first-attempt correct · Strong = 7+ correct in last 10
      </Text>

      {poolEntries.length > 0 && (
        <>
          <SectionTitle palette={palette} title="Words in Your Lists" />
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {poolEntries.map(({ word, entry }, idx) => (
              <View
                key={word.id}
                style={[
                  styles.wordRow,
                  idx < poolEntries.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.border,
                  },
                ]}
              >
                <View style={styles.wordRowMain}>
                  <Text style={[styles.wordLemma, { color: palette.text }]} numberOfLines={1}>
                    {word.lemma}
                  </Text>
                  <Text style={[styles.wordStreak, { color: palette.tint }]}>
                    🔥 {entry?.currentStreak ?? 0}
                  </Text>
                </View>
                <ResultDots
                  results={entry?.last10Results ?? []}
                  correctColor={palette.correct}
                  incorrectColor={palette.incorrect}
                  emptyColor={palette.border}
                />
              </View>
            ))}
          </View>
        </>
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
    <View style={styles.tabContent}>
      {!hasData && (
        <Text style={[styles.emptyNote, { color: palette.subtext }]}>
          No lifetime data yet — start studying to build your history.
        </Text>
      )}

      <SectionTitle palette={palette} title="Summary" />
      <View style={[styles.triCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <StatCell palette={palette} value={String(totalCards)} label="Cards Done" color={palette.text} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={String(uniqueWords)} label="Words Studied" color={palette.text} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={accuracy} label="1st-Attempt" color={palette.tint} />
      </View>

      {topWords.length > 0 && (
        <>
          <SectionTitle palette={palette} title="Top Personal Best Streaks" />
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {topWords.map((entry, idx) => (
              <View
                key={entry.wordId}
                style={[
                  styles.listRow,
                  idx < topWords.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.listWordLemma, { color: palette.text }]} numberOfLines={1}>
                  {formatLemma(entry.wordId, lemmaLookup)}
                </Text>
                <Text style={[styles.listValue, { color: palette.correct }]}>
                  🔥 {entry.personalBestStreak}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <SectionTitle palette={palette} title="Cards per Day (Last 7 Days)" />
      <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.barChart}>
          {barData.map(datum => (
            <View key={datum.dateKey} style={styles.barColumn}>
              <Text style={[styles.barCount, { color: palette.subtext }]}>
                {datum.count > 0 ? datum.count : ''}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(4, (datum.count / maxBar) * 100)}%`,
                      backgroundColor: palette.tint,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: palette.subtext }]}>{datum.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ResultDots({
  results,
  correctColor,
  incorrectColor,
  emptyColor,
}: {
  results: boolean[];
  correctColor: string;
  incorrectColor: string;
  emptyColor: string;
}) {
  const slots = 10;
  const padded: (boolean | null)[] = Array(slots - results.length).fill(null).concat(results);

  return (
    <View style={styles.dotsRow}>
      {padded.map((val, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                val === null ? emptyColor : val ? correctColor : incorrectColor,
              opacity: val === null ? 0.35 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SectionTitle({ palette, title }: { palette: Palette; title: string }) {
  return <Text style={[styles.sectionTitle, { color: palette.subtext }]}>{title.toUpperCase()}</Text>;
}

function StatCell({
  palette,
  value,
  label,
  color,
}: {
  palette: Palette;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statNumber, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function Divider({ palette }: { palette: Palette }) {
  return <View style={[styles.divider, { backgroundColor: palette.border }]} />;
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
  langTag: { fontSize: 13, fontWeight: '500', minWidth: 60, textAlign: 'right' },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { padding: 20, paddingBottom: 48 },
  tabContent: { gap: 10 },

  emptyNote: { fontSize: 14, lineHeight: 20, marginBottom: 8 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 2,
  },

  triCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  breakdownCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  triRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownSegment: {
    minWidth: 4,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 44, marginHorizontal: 8 },

  noteText: { fontSize: 12, lineHeight: 17 },

  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  listWordLemma: { flex: 1, fontSize: 15, fontWeight: '600' },
  listValue: { fontSize: 14, fontWeight: '700' },

  wordRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  wordRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordLemma: { flex: 1, fontSize: 15, fontWeight: '600' },
  wordStreak: { fontSize: 14, fontWeight: '700' },

  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barCount: {
    fontSize: 10,
    fontWeight: '600',
    minHeight: 14,
  },
  barTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
