/**
 * SCREEN — VOCAB BANK MANAGER
 *
 * Supports two entry modes:
 *
 *   Pool mode   — navigated with a `poolId` param (from My Lists).
 *                 Reads words and frequencies directly from state.languagePools.
 *                 Frequency changes are written back via updatePool.
 *                 Paused words appear in a separate section below a divider.
 *
 *   Legacy mode — navigated without a poolId (from the old word-banks flow).
 *                 Reads from state.activeVocabBank / state.wordFrequencySettings.
 *                 Frequency changes use setWordFrequency.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, GenderColors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { VocabItem } from '@/src/types/vocab';
import type { StudyType, WordFrequencySetting } from '@/src/types/state';
import { normalizeFrequencySetting } from '@/src/types/state';
import type { Pool, PoolWord } from '@/src/types/pool';
import { filterVocabBySearch, getWordLemmaColor, sortVocabByLemma } from '@/src/utils/vocabBank';
import StudyButton from '@/src/components/ui/StudyButton';
import SearchBar from '@/src/components/ui/SearchBar';
import FrequencySnapSlider from '@/src/components/ui/FrequencySnapSlider';

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab',
  gender: 'Gender',
};

type BankSection = {
  key: string;
  title: string | null;
  paused: boolean;
  data: VocabItem[];
};

export default function VocabBankScreen() {
  const router = useRouter();
  const { poolId: poolIdParam } = useLocalSearchParams<{ poolId?: string | string[] }>();
  const poolId = Array.isArray(poolIdParam) ? poolIdParam[0] : poolIdParam;
  const {
    state,
    setWordFrequency,
    updatePool,
    getLanguagePools,
  } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [searchQuery, setSearchQuery] = useState('');

  const isPoolMode = !!poolId;
  const language = state.languageSelected;

  const pool: Pool | null = useMemo(() => {
    if (!isPoolMode || !language) return null;
    return getLanguagePools(language).find(p => p.id === poolId) ?? null;
  }, [isPoolMode, language, poolId, getLanguagePools, state.languagePools]);

  const studyType = state.studyTypeSelected;

  useEffect(() => {
    if (!language) {
      router.replace('/');
      return;
    }
    if (!isPoolMode && !studyType) {
      router.replace('/dashboard');
    }
  }, [language, studyType, isPoolMode, router]);

  const { activeWords, pausedWords } = useMemo(() => {
    if (isPoolMode && pool) {
      const pausedSet = new Set(pool.pausedWordIds ?? []);
      const active: VocabItem[] = [];
      const paused: VocabItem[] = [];
      for (const pw of pool.words) {
        if (pausedSet.has(pw.item.id)) paused.push(pw.item);
        else active.push(pw.item);
      }
      return { activeWords: active, pausedWords: paused };
    }
    return {
      activeWords: state.activeVocabBank,
      pausedWords: [] as VocabItem[],
    };
  }, [isPoolMode, pool, state.activeVocabBank]);

  const sections = useMemo((): BankSection[] => {
    const sortLocale = pool?.language ?? language ?? undefined;
    const sortedActive = sortVocabByLemma(
      filterVocabBySearch(activeWords, searchQuery),
      sortLocale,
    );
    const result: BankSection[] = [
      { key: 'active', title: null, paused: false, data: sortedActive },
    ];

    let sortedPaused: VocabItem[] = [];
    if (isPoolMode && pausedWords.length > 0) {
      sortedPaused = sortVocabByLemma(
        filterVocabBySearch(pausedWords, searchQuery),
        sortLocale,
      );
      if (sortedPaused.length > 0) {
        result.push({
          key: 'paused',
          title: 'Paused words',
          paused: true,
          data: sortedPaused,
        });
      }
    }

    // TEMP: confirm sorted data passed to SectionList
    console.log('[VocabBank] display sections', {
      poolId,
      poolFound: !!pool,
      sortLocale,
      activeCount: sortedActive.length,
      activeLemmas: sortedActive.map(w => w.lemma),
      pausedCount: sortedPaused.length,
      pausedLemmas: sortedPaused.map(w => w.lemma),
    });

    return result;
  }, [activeWords, pausedWords, searchQuery, isPoolMode, pool, language, poolId]);

  const wordCount = activeWords.length + (isPoolMode ? pausedWords.length : 0);

  const getFrequency = useCallback(
    (id: string): WordFrequencySetting => {
      if (isPoolMode && pool) {
        const pw = pool.words.find((w: PoolWord) => w.item.id === id);
        return pw ? (pw.frequency as WordFrequencySetting) : 'normal';
      }
      return normalizeFrequencySetting(state.wordFrequencySettings[id]);
    },
    [isPoolMode, pool, state.wordFrequencySettings],
  );

  const handleFrequencyChange = useCallback(
    (id: string, frequency: WordFrequencySetting) => {
      if (isPoolMode && pool) {
        const updatedWords: PoolWord[] = pool.words.map((pw: PoolWord) =>
          pw.item.id === id
            ? { ...pw, frequency: frequency as PoolWord['frequency'] }
            : pw,
        );
        updatePool(pool.id, { words: updatedWords });
      } else {
        setWordFrequency(id, frequency);
      }
    },
    [isPoolMode, pool, updatePool, setWordFrequency],
  );

  const handleUnpause = useCallback(
    (id: string) => {
      if (!pool) return;
      updatePool(pool.id, {
        pausedWordIds: pool.pausedWordIds.filter(pid => pid !== id),
      });
    },
    [pool, updatePool],
  );

  const handleRemoveFromPool = useCallback(
    (item: VocabItem) => {
      if (!pool) return;
      Alert.alert(
        'Remove this word from your list?',
        `“${item.lemma}” will be permanently removed from this pool.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              updatePool(pool.id, {
                words: pool.words.filter(pw => pw.item.id !== item.id),
                pausedWordIds: pool.pausedWordIds.filter(pid => pid !== item.id),
              });
            },
          },
        ],
      );
    },
    [pool, updatePool],
  );

  const screenLabel = isPoolMode && pool
    ? pool.name
    : studyType
    ? MODE_LABELS[studyType]
    : 'Vocab Bank';

  if (!isPoolMode && !studyType) return null;

  const renderActiveRow = (item: VocabItem) => {
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);
    const frequency = getFrequency(item.id);

    return (
      <View style={[styles.row, { borderBottomColor: palette.border }]}>
        <View style={styles.rowLeft}>
          <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
          {item.user_added === 'y' && (
            <Text style={[styles.customTag, { color: palette.tint }]}>Custom</Text>
          )}
        </View>
        <FrequencySnapSlider
          value={frequency}
          onChange={freq => handleFrequencyChange(item.id, freq)}
          compact
        />
      </View>
    );
  };

  const renderPausedRow = (item: VocabItem) => {
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    return (
      <View style={[styles.pausedRow, { borderBottomColor: palette.border }]}>
        <View style={styles.rowLeft}>
          <Text style={[styles.lemma, { color: lemmaColor, opacity: 0.75 }]}>
            {item.lemma}
          </Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
        </View>
        <View style={styles.pausedActions}>
          <TouchableOpacity
            onPress={() => handleUnpause(item.id)}
            hitSlop={8}
          >
            <Text style={[styles.actionLink, { color: palette.tint }]}>Unpause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRemoveFromPool(item)}
            hitSlop={8}
          >
            <Text style={[styles.actionLink, { color: palette.incorrect }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderItem = ({
    item,
    section,
  }: {
    item: VocabItem;
    section: BankSection;
  }) => (section.paused ? renderPausedRow(item) : renderActiveRow(item));

  const renderSectionHeader = ({ section }: { section: BankSection }) => {
    if (!section.title) return null;
    return (
      <View
        style={[
          styles.pausedHeader,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <Text style={[styles.pausedHeaderText, { color: palette.subtext }]}>
          {section.title}
        </Text>
      </View>
    );
  };

  const isEmpty = sections.every(s => s.data.length === 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.topBarBtn, { color: palette.tint }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: palette.text }]} numberOfLines={1}>
          {screenLabel}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.header}>
        <Text style={[styles.counter, { color: palette.tint }]}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </Text>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      {!isEmpty && (
        <View
          style={[
            styles.columnHeader,
            { borderBottomColor: palette.border, backgroundColor: palette.background },
          ]}
        >
          <Text style={[styles.columnTitle, { color: palette.subtext }]}>Word</Text>
          <Text
            style={[styles.columnTitle, styles.columnRight, { color: palette.subtext }]}
          >
            Frequency
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        extraData={sections.map(s => s.data.map(w => w.id).join(',')).join('|')}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            {searchQuery
              ? 'No words match your search.'
              : 'No words in this list yet.'}
          </Text>
        }
      />

      {isPoolMode && (
        <View style={[styles.bottomBar, { borderTopColor: palette.border }]}>
          <StudyButton
            label="Add Word"
            variant="secondary"
            size="medium"
            onPress={() =>
              router.push({
                pathname: '/add-existing-word',
                params: { poolId: poolId ?? '' },
              } as never)
            }
            style={styles.actionBtn}
          />
          <StudyButton
            label="Create New Word"
            variant="secondary"
            size="medium"
            onPress={() => router.push('/add-word')}
            style={styles.actionBtn}
          />
        </View>
      )}
    </SafeAreaView>
  );
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
  topBarBtn: { fontSize: 15, fontWeight: '500', minWidth: 60 },
  topBarTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  topBarSpacer: { minWidth: 60 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },
  counter: { fontSize: 16, fontWeight: '600' },

  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  columnTitle: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  columnRight: { textAlign: 'right', flex: 0, width: 120 },

  list: { flex: 1 },
  emptyText: { textAlign: 'center', fontSize: 15, marginTop: 32, paddingHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 2 },
  lemma: { fontSize: 17, fontWeight: '700' },
  english: { fontSize: 14 },
  customTag: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  pausedHeader: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pausedHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pausedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  actionBtn: { flex: 1 },
});
