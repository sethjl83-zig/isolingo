/**
 * SCREEN — STATS
 * Two tabs: Current Stats (active-bank words) and Lifetime Stats (all words ever studied).
 */
import React, { useState, useCallback, useEffect } from 'react';
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
import { loadStatsForLanguage, type LangStats } from '@/src/storage/statsStorage';
import { getCompetencyLevel, type WordStatsEntry } from '@/src/types/stats';

type Tab = 'current' | 'lifetime';

const LANGUAGE_LABELS: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish' };

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(num: number, denom: number): string {
  if (denom === 0) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}

function competencyCounts(entries: WordStatsEntry[]) {
  let mastered = 0, strong = 0, weak = 0;
  for (const e of entries) {
    const lvl = getCompetencyLevel(e);
    if (lvl === 'mastered') mastered++;
    else if (lvl === 'strong') strong++;
    else weak++;
  }
  return { mastered, strong, weak };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const router = useRouter();
  const { state, isReady } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;
  const activeBankIds = new Set(state.activeVocabBank.map(w => w.id));

  const [tab, setTab] = useState<Tab>('current');
  const [langStats, setLangStats] = useState<LangStats>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  const loadData = useCallback(async () => {
    if (!language) return;
    setLoading(true);
    try {
      const stats = await loadStatsForLanguage(language);
      setLangStats(stats);
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

  // All entries for this language
  const allEntries = Object.values(langStats);

  // Entries that belong to the currently active bank
  const currentBankEntries = allEntries.filter(e => activeBankIds.has(e.wordId));

  // ── Current stats derived values ─────────────────────────────────────────
  const currentCounts = competencyCounts(currentBankEntries);
  const currentFirstAttemptCorrect = currentBankEntries.reduce(
    (sum, e) => sum + e.lifetimeFirstAttemptCorrect,
    0,
  );
  const currentTotalAttempts = currentBankEntries.reduce(
    (sum, e) => sum + e.lifetimeTotalAttempts,
    0,
  );
  const currentAccuracy = pct(currentFirstAttemptCorrect, currentTotalAttempts);

  // Top words by streak
  const topByStreak = [...currentBankEntries]
    .sort((a, b) => b.consecutiveFirstAttemptStreak - a.consecutiveFirstAttemptStreak)
    .slice(0, 8);

  // ── Lifetime stats derived values ─────────────────────────────────────────
  const lifetimeTotalCards = allEntries.reduce((sum, e) => sum + e.lifetimeTotalAttempts, 0);
  const lifetimeUniqueWords = allEntries.length;
  const lifetimeFirstAttemptCorrect = allEntries.reduce(
    (sum, e) => sum + e.lifetimeFirstAttemptCorrect,
    0,
  );
  const lifetimeTotalAttempts = allEntries.reduce(
    (sum, e) => sum + e.lifetimeTotalAttempts,
    0,
  );
  const lifetimeAccuracy = pct(lifetimeFirstAttemptCorrect, lifetimeTotalAttempts);
  const personalBestStreak = allEntries.reduce(
    (best, e) => Math.max(best, e.personalBestStreak),
    0,
  );

  // Words with highest lifetime first-attempt accuracy (min 5 attempts)
  const topLifetimeWords = [...allEntries]
    .filter(e => e.lifetimeTotalAttempts >= 5)
    .sort((a, b) => b.personalBestStreak - a.personalBestStreak)
    .slice(0, 8);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Stats</Text>
        <Text style={[styles.langTag, { color: palette.subtext }]}>
          {LANGUAGE_LABELS[language] ?? language}
        </Text>
      </View>

      {/* Tabs */}
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
              accuracy={currentAccuracy}
              totalAttempts={currentTotalAttempts}
              topByStreak={topByStreak}
              langStats={langStats}
            />
          ) : (
            <LifetimeStatsTab
              palette={palette}
              totalCards={lifetimeTotalCards}
              uniqueWords={lifetimeUniqueWords}
              accuracy={lifetimeAccuracy}
              personalBestStreak={personalBestStreak}
              topWords={topLifetimeWords}
              langStats={langStats}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface Palette {
  text: string; subtext: string; card: string; border: string;
  tint: string; correct: string; incorrect: string; background: string;
}

interface CurrentProps {
  palette: Palette;
  counts: { mastered: number; strong: number; weak: number };
  accuracy: string;
  totalAttempts: number;
  topByStreak: WordStatsEntry[];
  langStats: LangStats;
}

function CurrentStatsTab({ palette, counts, accuracy, totalAttempts, topByStreak }: CurrentProps) {
  const hasData = totalAttempts > 0;

  return (
    <View style={styles.tabContent}>
      {!hasData && (
        <Text style={[styles.emptyNote, { color: palette.subtext }]}>
          Study some cards to see your current stats.
        </Text>
      )}

      {/* Competency breakdown */}
      <SectionTitle palette={palette} title="Competency Breakdown" />
      <View style={[styles.triCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <StatCell palette={palette} value={String(counts.mastered)} label="Mastered" color={palette.correct} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={String(counts.strong)} label="Strong" color={palette.tint} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={String(counts.weak)} label="Weak" color={palette.incorrect} />
      </View>
      <Text style={[styles.noteText, { color: palette.subtext }]}>
        Mastered = 10 consecutive first-attempt correct · Strong = 7+ correct in last 10
      </Text>

      {/* Accuracy */}
      <SectionTitle palette={palette} title="First-Attempt Accuracy" />
      <View style={[styles.bigStatCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.bigStatNumber, { color: palette.tint }]}>{accuracy}</Text>
        <Text style={[styles.bigStatLabel, { color: palette.subtext }]}>
          {totalAttempts > 0 ? `across ${totalAttempts} cards` : 'No cards yet'}
        </Text>
      </View>

      {/* Per-word streaks */}
      {topByStreak.length > 0 && (
        <>
          <SectionTitle palette={palette} title="Current Streak (top words)" />
          <View style={[styles.listCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {topByStreak.map((entry, idx) => (
              <View
                key={entry.wordId}
                style={[
                  styles.listRow,
                  idx < topByStreak.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.listWordId, { color: palette.text }]}>{entry.wordId}</Text>
                <Text style={[styles.listValue, { color: palette.tint }]}>
                  🔥 {entry.consecutiveFirstAttemptStreak}
                </Text>
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
  personalBestStreak: number;
  topWords: WordStatsEntry[];
  langStats: LangStats;
}

function LifetimeStatsTab({
  palette,
  totalCards,
  uniqueWords,
  accuracy,
  personalBestStreak,
  topWords,
}: LifetimeProps) {
  const hasData = totalCards > 0;

  return (
    <View style={styles.tabContent}>
      {!hasData && (
        <Text style={[styles.emptyNote, { color: palette.subtext }]}>
          No lifetime data yet — start studying to build your history.
        </Text>
      )}

      {/* Summary row */}
      <SectionTitle palette={palette} title="Summary" />
      <View style={[styles.triCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <StatCell palette={palette} value={String(totalCards)} label="Cards Done" color={palette.text} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={String(uniqueWords)} label="Words Studied" color={palette.text} />
        <Divider palette={palette} />
        <StatCell palette={palette} value={accuracy} label="1st-Attempt" color={palette.tint} />
      </View>

      {/* Personal best streak */}
      <SectionTitle palette={palette} title="Personal Best Streak" />
      <View style={[styles.bigStatCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.bigStatNumber, { color: palette.correct }]}>
          🔥 {personalBestStreak}
        </Text>
        <Text style={[styles.bigStatLabel, { color: palette.subtext }]}>
          consecutive first-attempt correct
        </Text>
      </View>

      {/* Top words by personal best */}
      {topWords.length > 0 && (
        <>
          <SectionTitle palette={palette} title="Best Streak by Word" />
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
                <Text style={[styles.listWordId, { color: palette.text }]}>{entry.wordId}</Text>
                <Text style={[styles.listValue, { color: palette.tint }]}>
                  best: {entry.personalBestStreak}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Study time placeholder */}
      <SectionTitle palette={palette} title="Study Time per Day" />
      <View
        style={[
          styles.placeholderCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.placeholderIcon}>📊</Text>
        <Text style={[styles.placeholderText, { color: palette.subtext }]}>
          Session duration tracking coming soon
        </Text>
      </View>
    </View>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

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
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 44, marginHorizontal: 8 },

  noteText: { fontSize: 12, lineHeight: 17 },

  bigStatCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  bigStatNumber: { fontSize: 42, fontWeight: '800' },
  bigStatLabel: { fontSize: 14 },

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
  },
  listWordId: { flex: 1, fontSize: 13, fontWeight: '500' },
  listValue: { fontSize: 14, fontWeight: '700' },

  placeholderCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  placeholderIcon: { fontSize: 36 },
  placeholderText: { fontSize: 14 },
});
