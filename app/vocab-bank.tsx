/**
 * SCREEN — VOCAB BANK MANAGER
 *
 * Supports two entry modes:
 *
 *   Pool mode   — navigated with a `poolId` param (from My Lists).
 *                 Reads words and frequencies directly from state.languagePools.
 *                 Frequency changes are written back via updatePool.
 *
 *   Legacy mode — navigated without a poolId (from the old word-banks flow).
 *                 Reads from state.activeVocabBank / state.wordFrequencySettings.
 *                 Frequency changes use setWordFrequency.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, GenderColors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { VocabItem } from '@/src/types/vocab';
import type { StudyType, WordFrequencySetting } from '@/src/types/state';
import { normalizeFrequencySetting } from '@/src/types/state';
import type { Pool, PoolWord } from '@/src/types/pool';
import { filterVocabBySearch, getWordLemmaColor } from '@/src/utils/vocabBank';
import StudyButton from '@/src/components/ui/StudyButton';
import SearchBar from '@/src/components/ui/SearchBar';
import FrequencySnapSlider from '@/src/components/ui/FrequencySnapSlider';

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab',
  gender: 'Gender',
};

export default function VocabBankScreen() {
  const router = useRouter();
  const { poolId } = useLocalSearchParams<{ poolId?: string }>();
  const {
    state,
    setWordFrequency,
    updatePool,
    getLanguagePools,
  } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [searchQuery, setSearchQuery] = useState('');

  // ── Mode detection ──────────────────────────────────────────────────────────
  const isPoolMode = !!poolId;
  const language = state.languageSelected;

  // Resolve the pool object when in pool mode
  const pool: Pool | null = useMemo(() => {
    if (!isPoolMode || !language) return null;
    return getLanguagePools(language).find(p => p.id === poolId) ?? null;
  }, [isPoolMode, language, poolId, getLanguagePools]);

  const studyType = state.studyTypeSelected;

  // ── Guards ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!language) {
      router.replace('/');
      return;
    }
    // Only redirect when in legacy mode without a study type.
    // Pool mode never needs studyType.
    if (!isPoolMode && !studyType) {
      router.replace('/dashboard');
    }
  }, [language, studyType, isPoolMode, router]);

  // ── Word data ───────────────────────────────────────────────────────────────
  const rawWords: VocabItem[] = useMemo(() => {
    if (isPoolMode && pool) {
      return pool.words.map(pw => pw.item);
    }
    return state.activeVocabBank;
  }, [isPoolMode, pool, state.activeVocabBank]);

  const sortedWords = useMemo(
    () =>
      [...rawWords].sort((a, b) =>
        a.lemma.localeCompare(b.lemma, undefined, { sensitivity: 'base' }),
      ),
    [rawWords],
  );

  const filteredWords = useMemo(
    () => filterVocabBySearch(sortedWords, searchQuery),
    [sortedWords, searchQuery],
  );

  const wordCount = rawWords.length;

  // ── Frequency helpers ───────────────────────────────────────────────────────
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
        // Update the word's frequency inside the pool
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

  // ── Screen label ────────────────────────────────────────────────────────────
  const screenLabel = isPoolMode && pool
    ? pool.name
    : studyType
    ? MODE_LABELS[studyType]
    : 'Vocab Bank';

  // ── Render guard ────────────────────────────────────────────────────────────
  if (!isPoolMode && !studyType) return null;

  // ── Row renderer ────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: VocabItem }) => {
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

      <FlatList
        data={filteredWords}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
