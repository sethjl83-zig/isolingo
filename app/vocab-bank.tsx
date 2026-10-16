/**
 * SCREEN — VOCAB BANK MANAGER
 *
 * Navigated with a `poolId` param from My Lists. Reads words and frequencies
 * from state.languagePools. Frequency changes are written back via updatePool.
 * Paused words appear in a separate section below a divider.
 */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, InteractionManager, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { enrichVocabItemsFromMasterAsync } from '@/src/data';
import type { VocabItem } from '@/src/types/vocab';
import type { WordFrequencySetting } from '@/src/types/state';
import type { Pool, PoolWord } from '@/src/types/pool';
import { filterVocabBySearch, sortVocabByLemma } from '@/src/utils/vocabBank';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import StudyButton from '@/src/components/ui/StudyButton';
import SearchBar from '@/src/components/ui/SearchBar';
import {
  ActiveWordRow,
  PausedWordRow,
  PausedSectionHeader,
} from '@/src/components/vocab-bank/WordListRows';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const searchIcon = require('@/assets/images/lists/icon-search.png');

type WordListRow =
  | { kind: 'section-header'; key: string; title: string }
  | { kind: 'active'; key: string; item: VocabItem }
  | { kind: 'paused'; key: string; item: VocabItem };

interface DisplayWords {
  activeWords: VocabItem[];
  pausedWords: VocabItem[];
}

function splitPoolWords(pool: Pool): { active: VocabItem[]; paused: VocabItem[] } {
  const pausedSet = new Set(pool.pausedWordIds ?? []);
  const active: VocabItem[] = [];
  const paused: VocabItem[] = [];
  for (const pw of pool.words) {
    if (pausedSet.has(pw.item.id)) paused.push(pw.item);
    else active.push(pw.item);
  }
  return { active, paused };
}

export default function VocabBankScreen() {
  const router = useRouter();
  const { poolId: poolIdParam } = useLocalSearchParams<{ poolId?: string | string[] }>();
  const poolId = Array.isArray(poolIdParam) ? poolIdParam[0] : poolIdParam;
  const { state, updatePool, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [searchQuery, setSearchQuery] = useState('');
  const [displayWords, setDisplayWords] = useState<DisplayWords | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);

  const isPoolMode = !!poolId;
  const language = state.languageSelected;

  const pool: Pool | null = useMemo(() => {
    if (!isPoolMode || !language) return null;
    return getLanguagePools(language).find(p => p.id === poolId) ?? null;
  }, [isPoolMode, language, poolId, getLanguagePools, state.languagePools]);

  useEffect(() => {
    if (!language) {
      router.replace('/');
      return;
    }
    if (!poolId) {
      router.replace('/my-lists');
    }
  }, [language, poolId, router]);

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  const poolWordsKey = useMemo(() => {
    if (!pool) return '';
    const wordIds = pool.words.map(pw => pw.item.id).sort().join('|');
    const pausedIds = [...(pool.pausedWordIds ?? [])].sort().join('|');
    return `${pool.id}:${wordIds}:${pausedIds}`;
  }, [pool]);

  const poolRef = useRef(pool);
  poolRef.current = pool;

  useEffect(() => {
    const currentPool = poolRef.current;
    if (!currentPool || !language) {
      setDisplayWords(null);
      setLoadingWords(false);
      return;
    }

    let cancelled = false;
    setLoadingWords(true);
    setDisplayWords(null);

    const { active, paused } = splitPoolWords(currentPool);
    const allItems = [...active, ...paused];

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const enriched = await enrichVocabItemsFromMasterAsync(allItems, language);
          if (cancelled) return;

          const enrichedById = new Map(enriched.map(item => [item.id, item]));
          setDisplayWords({
            activeWords: active.map(item => enrichedById.get(item.id) ?? item),
            pausedWords: paused.map(item => enrichedById.get(item.id) ?? item),
          });
        } catch (err) {
          console.warn('[VocabBank] word enrichment failed', err);
          if (!cancelled) {
            setDisplayWords({ activeWords: active, pausedWords: paused });
          }
        } finally {
          if (!cancelled) setLoadingWords(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
    };
  }, [poolWordsKey, language]);

  const frequencyById = useMemo(() => {
    if (!pool) return new Map<string, WordFrequencySetting>();
    return new Map(
      pool.words.map((pw: PoolWord) => [pw.item.id, pw.frequency as WordFrequencySetting]),
    );
  }, [pool]);

  const frequencyByIdRef = useRef(frequencyById);
  frequencyByIdRef.current = frequencyById;

  const activeWords = displayWords?.activeWords ?? [];
  const pausedWords = displayWords?.pausedWords ?? [];

  const listRows = useMemo((): WordListRow[] => {
    const sortLocale = pool?.language ?? language ?? undefined;
    const sortedActive = sortVocabByLemma(
      filterVocabBySearch(activeWords, searchQuery),
      sortLocale,
    );
    const rows: WordListRow[] = sortedActive.map(item => ({
      kind: 'active',
      key: item.id,
      item,
    }));

    if (pausedWords.length > 0) {
      const sortedPaused = sortVocabByLemma(
        filterVocabBySearch(pausedWords, searchQuery),
        sortLocale,
      );
      if (sortedPaused.length > 0) {
        rows.push({
          kind: 'section-header',
          key: 'paused-header',
          title: 'Paused Words',
        });
        for (const item of sortedPaused) {
          rows.push({ kind: 'paused', key: item.id, item });
        }
      }
    }

    return rows;
  }, [activeWords, pausedWords, searchQuery, pool, language]);

  const wordCount = activeWords.length + pausedWords.length;

  const handleFrequencyChange = useCallback(
    (id: string, frequency: WordFrequencySetting) => {
      if (!pool) return;
      const updatedWords: PoolWord[] = pool.words.map((pw: PoolWord) =>
        pw.item.id === id
          ? { ...pw, frequency: frequency as PoolWord['frequency'] }
          : pw,
      );
      updatePool(pool.id, { words: updatedWords });
    },
    [pool, updatePool],
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

  const removeWordFromPool = useCallback(
    (item: VocabItem) => {
      if (!pool) return;
      updatePool(pool.id, {
        words: pool.words.filter(pw => pw.item.id !== item.id),
        pausedWordIds: pool.pausedWordIds.filter(pid => pid !== item.id),
      });
    },
    [pool, updatePool],
  );

  const handleRemoveActiveWord = useCallback(
    (item: VocabItem) => {
      Alert.alert('Remove this word from this list?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeWordFromPool(item),
        },
      ]);
    },
    [removeWordFromPool],
  );

  const handleRemovePausedWord = useCallback(
    (item: VocabItem) => {
      Alert.alert(
        'Remove this word from your list?',
        `“${item.lemma}” will be permanently removed from this pool.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeWordFromPool(item),
          },
        ],
      );
    },
    [removeWordFromPool],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: WordListRow }) => {
      switch (row.kind) {
        case 'section-header':
          return <PausedSectionHeader title={row.title} />;
        case 'active':
          return (
            <ActiveWordRow
              item={row.item}
              frequency={frequencyByIdRef.current.get(row.item.id) ?? 'normal'}
              onFrequencyChange={handleFrequencyChange}
              onRemove={handleRemoveActiveWord}
            />
          );
        case 'paused':
          return (
            <PausedWordRow
              item={row.item}
              onUnpause={handleUnpause}
              onRemove={handleRemovePausedWord}
            />
          );
      }
    },
    [handleFrequencyChange, handleRemoveActiveWord, handleUnpause, handleRemovePausedWord],
  );

  const keyExtractor = useCallback((row: WordListRow) => row.key, []);

  const screenLabel = pool?.name ?? 'Vocab Bank';

  if (!pool) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          style={[styles.backBtn, { backgroundColor: 'rgba(94,81,164,0.15)' }]}
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1} pointerEvents="none">
          {screenLabel}
        </Text>
      </View>

      <View style={styles.header}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={searchIcon}
          containerStyle={styles.search}
        />
        <View style={styles.countPill}>
          <Text style={styles.counter}>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </Text>
        </View>
      </View>

      {loadingWords ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>
            Loading words…
          </Text>
        </View>
      ) : (
        <FlatList
          data={listRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={frequencyById}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              {searchQuery
                ? 'No words match your search.'
                : 'No words in this list yet.'}
            </Text>
          }
        />
      )}

      <View style={styles.bottomBar}>
        <StudyButton
          label="Add Word"
          variant="primary"
          size="medium"
          onPress={() =>
            router.push({
              pathname: '/add-existing-word',
              params: { poolId: poolId ?? '' },
            } as never)
          }
          style={styles.actionBtn}
          textStyle={styles.actionLabel}
          disabled={loadingWords}
        />
        <StudyButton
          label="Create New Word"
          variant="primary"
          size="medium"
          onPress={() => router.push('/add-word')}
          style={styles.actionBtn}
          textStyle={styles.actionLabel}
          disabled={loadingWords}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },

  topBar: {
    height: 36,
    marginHorizontal: 16,
    marginTop: 0,
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
  topBarTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
  },

  header: {
    marginTop: 15,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  search: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    borderColor: 'rgba(0,0,0,0.4)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 0,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  countPill: {
    height: 46,
    minWidth: 92,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FAEDDB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  counter: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 14,
    lineHeight: 18,
    color: '#6B3B06',
  },

  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 15, textAlign: 'center' },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 16,
    gap: 10,
  },
  emptyText: { textAlign: 'center', fontSize: 15, marginTop: 32, paddingHorizontal: 20 },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  actionBtn: {
    flex: 1,
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  actionLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 15,
    lineHeight: 24,
  },
});
