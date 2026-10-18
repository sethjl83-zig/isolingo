/**
 * SCREEN — ADD WORD (from master list)
 * Browse and multi-select words from the master vocabulary dataset and append
 * them to an existing pool. Words already present in the pool are excluded.
 *
 * Visual style matches build-your-own.tsx, with no language toggle, no
 * minimum word count, and no naming step.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ScrollView, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, GenderColors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
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

const backChevron = require('@/assets/images/lists/back-chevron.png');
const checkIcon = require('@/assets/images/lists/check-white.png');

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
        style={styles.cardShadow}
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.card, { borderColor: palette.listCardBorder }]}>
          <View style={styles.wordInfo}>
            <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
            <Text style={styles.english}>{item.english}</Text>
          </View>
          <View
            style={[
              styles.checkbox,
              isSelected
                ? { backgroundColor: palette.teal, borderColor: palette.teal }
                : { backgroundColor: 'transparent', borderColor: 'rgba(0,0,0,0.2)' },
            ]}
          >
            {isSelected && (
              <Image source={checkIcon} style={styles.checkIcon} accessibilityIgnoresInvertColors />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="Back"
              style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
            >
              <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
            </TouchableOpacity>
            <Text style={styles.screenTitle} pointerEvents="none">Add Word</Text>
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
              style={[styles.chip, selectedCategory === null ? styles.chipOn : styles.chipOff]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.chipText, selectedCategory === null ? styles.chipTextOn : styles.chipTextOff]}>
                All
              </Text>
            </TouchableOpacity>

            {allCategories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, selectedCategory === cat ? styles.chipOn : styles.chipOff]}
                onPress={() =>
                  setSelectedCategory(prev => (prev === cat ? null : cat))
                }
              >
                <Text style={[styles.chipText, selectedCategory === cat ? styles.chipTextOn : styles.chipTextOff]}>
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
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {masterWords.length === 0
              ? 'All words from the vocabulary list are already in this list.'
              : 'No words match your search.'}
          </Text>
        }
      />

      <View style={styles.bottomBar}>
        <Text style={styles.counter}>
          {selectedCount} {selectedCount === 1 ? 'word' : 'words'} selected
        </Text>
        <StudyButton
          label="Add to List"
          variant="primary"
          size="medium"
          onPress={handleAdd}
          disabled={!canAdd}
          style={styles.addBtn}
          textStyle={styles.addLabel}
        />
      </View>
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F7F5FD' },

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

  searchWrap: {
    marginTop: 15,
    marginHorizontal: 16,
    gap: 15,
  },

  chipScroll: { flexGrow: 0, marginTop: 15 },
  chipRow: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { borderColor: '#38A19A' },
  chipOff: { borderColor: 'rgba(94,81,164,0.2)' },
  chipText: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: '#38A19A' },
  chipTextOff: { color: 'rgba(0,0,0,0.5)' },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 16,
    gap: 10,
  },
  emptyText: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
  },

  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  wordInfo: { flex: 1, gap: 6 },
  lemma: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  english: {
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
    gap: 10,
    backgroundColor: '#F7F5FD',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  counter: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  addBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  addLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
});
