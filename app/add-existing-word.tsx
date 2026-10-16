/**
 * SCREEN — ADD WORD (from master list)
 * Browse and multi-select words from the master vocabulary dataset and append
 * them to an existing pool. Words already present in the pool are excluded.
 *
 * Visual style matches build-your-own.tsx, with no language toggle, no
 * minimum word count, and no naming step.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, GenderColors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import { getMasterDataset } from '@/src/data';
import {
  filterVocabBySearch,
  getLanguageDisplayName,
  getUniqueCategories,
  getWordLemmaColor,
  sortVocabByLemma,
  type VocabSearchMode,
} from '@/src/utils/vocabBank';
import type { VocabItem } from '@/src/types/vocab';
import type { PoolWord } from '@/src/types/pool';
import SearchBar from '@/src/components/ui/SearchBar';
import SearchModeToggle from '@/src/components/ui/SearchModeToggle';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

function pillSurface(
  selected: boolean,
  palette: (typeof Colors)['light'],
) {
  return selected
    ? { backgroundColor: palette.tint, borderColor: palette.tint }
    : { backgroundColor: palette.card, borderColor: palette.border };
}

function pillLabel(selected: boolean, palette: (typeof Colors)['light']) {
  return { color: selected ? '#fff' : palette.text };
}

export default function AddExistingWordScreen() {
  const router = useRouter();
  const { poolId } = useLocalSearchParams<{ poolId?: string }>();
  const { state, isReady, updatePool, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  const pool = useMemo(() => {
    if (!language || !poolId) return null;
    return getLanguagePools(language).find(p => p.id === poolId) ?? null;
  }, [language, poolId, getLanguagePools]);

  const existingIds = useMemo<Set<string>>(
    () => new Set((pool?.words ?? []).map((pw: PoolWord) => pw.item.id)),
    [pool],
  );

  const masterWords = useMemo(
    () =>
      (language ? getMasterDataset(language) : []).filter(
        w => !existingIds.has(w.id),
      ),
    [language, existingIds],
  );

  const allCategories = useMemo(
    () => getUniqueCategories(masterWords),
    [masterWords],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<VocabSearchMode>('target');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoryFiltered = useMemo(
    () =>
      selectedCategory
        ? masterWords.filter(w => w.category.includes(selectedCategory))
        : masterWords,
    [masterWords, selectedCategory],
  );

  const filteredWords = useMemo(
    () =>
      sortVocabByLemma(
        filterVocabBySearch(categoryFiltered, searchQuery, searchMode),
        language ?? undefined,
      ),
    [categoryFiltered, searchQuery, searchMode, language],
  );

  const searchPlaceholder =
    searchMode === 'target'
      ? `Search ${getLanguageDisplayName(language)} words…`
      : 'Search English words…';

  const selectedCount = selectedIds.size;
  const canAdd = selectedCount > 0;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (!pool || !canAdd) return;

    const newPoolWords: PoolWord[] = masterWords
      .filter(w => selectedIds.has(w.id))
      .map(item => ({ item, frequency: 'normal' as const }));

    updatePool(pool.id, {
      words: [...pool.words, ...newPoolWords],
    });

    router.back();
  }, [pool, canAdd, masterWords, selectedIds, updatePool, router]);

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  if (!isReady || !language) return null;

  const renderWord = ({ item }: { item: VocabItem }) => {
    const isSelected = selectedIds.has(item.id);
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    return (
      <TouchableOpacity
        style={[styles.wordRow, { borderBottomColor: palette.border }]}
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: palette.tint,
              backgroundColor: isSelected ? palette.tint : 'transparent',
            },
          ]}
        >
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.wordInfo}>
          <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.screenTitle, { color: palette.text }]}>Add Word</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.searchWrap}>
            <SearchModeToggle
              mode={searchMode}
              onModeChange={setSearchMode}
              language={language}
            />
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="always"
          >
            <TouchableOpacity
              style={[styles.chip, pillSurface(selectedCategory === null, palette)]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.chipText, pillLabel(selectedCategory === null, palette)]}>
                All
              </Text>
            </TouchableOpacity>

            {allCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, pillSurface(selectedCategory === cat, palette)]}
                onPress={() =>
                  setSelectedCategory(prev => (prev === cat ? null : cat))
                }
              >
                <Text style={[styles.chipText, pillLabel(selectedCategory === cat, palette)]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      <FlatList
        data={filteredWords}
        keyExtractor={item => item.id}
        renderItem={renderWord}
        style={styles.list}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            {masterWords.length === 0
              ? 'All words from the vocabulary list are already in this list.'
              : 'No words match your search.'}
          </Text>
        }
      />

      <View
        style={[
          styles.bottomBar,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <Text style={[styles.counter, { color: palette.text }]}>
          {selectedCount} {selectedCount === 1 ? 'word' : 'words'} selected
        </Text>
        <StudyButton
          label="Add to List"
          variant={canAdd ? 'primary' : 'inactive'}
          size="large"
          onPress={handleAdd}
          disabled={!canAdd}
          style={styles.addBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

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

  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 8 },

  chipScroll: { maxHeight: 48, flexGrow: 0 },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  list: { flex: 1 },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 32,
    paddingHorizontal: 24,
  },

  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 15 },
  wordInfo: { flex: 1, gap: 2 },
  lemma: { fontSize: 16, fontWeight: '600' },
  english: { fontSize: 13 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  counter: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  addBtn: { width: '100%', borderRadius: 28, minWidth: 0 },
});
