/**
 * SCREEN — ADD WORD (from master list)
 * Browse and multi-select words from the master vocabulary dataset and append
 * them to an existing pool. Words already present in the pool are excluded.
 *
 * UI pattern mirrors build-your-own.tsx: search bar + category chips + word
 * list with checkboxes + bottom action bar. No minimum word count required.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Keyboard,
} from 'react-native';
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
  type VocabSearchMode,
} from '@/src/utils/vocabBank';
import type { VocabItem } from '@/src/types/vocab';
import type { PoolWord } from '@/src/types/pool';
import SearchBar from '@/src/components/ui/SearchBar';
import SearchModeToggle from '@/src/components/ui/SearchModeToggle';
import KeyboardDoneAccessory from '@/src/components/ui/KeyboardDoneAccessory';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

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

  // Resolve the target pool
  const pool = useMemo(() => {
    if (!language || !poolId) return null;
    return getLanguagePools(language).find(p => p.id === poolId) ?? null;
  }, [language, poolId, getLanguagePools]);

  // IDs already in the pool — used to exclude them from the selectable list
  const existingIds = useMemo<Set<string>>(
    () => new Set((pool?.words ?? []).map((pw: PoolWord) => pw.item.id)),
    [pool],
  );

  // Master dataset minus words already in the pool
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

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<VocabSearchMode>('target');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const categoryFiltered = useMemo(
    () =>
      selectedCategory
        ? masterWords.filter(w => w.category.includes(selectedCategory))
        : masterWords,
    [masterWords, selectedCategory],
  );

  const filteredWords = useMemo(
    () => filterVocabBySearch(categoryFiltered, searchQuery, searchMode),
    [categoryFiltered, searchQuery, searchMode],
  );

  const searchPlaceholder =
    searchMode === 'target'
      ? `Search ${getLanguageDisplayName(language)} words…`
      : 'Search English words…';

  const selectedCount = selectedIds.size;
  const canAdd = selectedCount > 0;

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // ── Commit ────────────────────────────────────────────────────────────────
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

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isReady || !language) return null;

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderWord = ({ item }: { item: VocabItem }) => {
    const isSelected = selectedIds.has(item.id);
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    return (
      <TouchableOpacity
        style={[
          styles.wordRow,
          {
            borderBottomColor: palette.border,
            backgroundColor: isSelected ? palette.feedback : palette.background,
          },
        ]}
        onPress={() => {
          if (keyboardVisible) {
            Keyboard.dismiss();
            return;
          }
          toggleSelection(item.id);
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: palette.tint },
            isSelected && { backgroundColor: palette.tint },
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
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <KeyboardDoneAccessory />

      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Add Word</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Search mode + bar */}
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
          showKeyboardDone
        />
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: palette.border, backgroundColor: palette.card },
            selectedCategory === null && {
              backgroundColor: palette.tint,
              borderColor: palette.tint,
            },
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.chipText,
              { color: selectedCategory === null ? '#fff' : palette.text },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {allCategories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.chip,
              { borderColor: palette.border, backgroundColor: palette.card },
              selectedCategory === cat && {
                backgroundColor: palette.tint,
                borderColor: palette.tint,
              },
            ]}
            onPress={() => setSelectedCategory(prev => (prev === cat ? null : cat))}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedCategory === cat ? '#fff' : palette.text },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredWords}
        keyExtractor={item => item.id}
        renderItem={renderWord}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            {masterWords.length === 0
              ? 'All words from the vocabulary list are already in this list.'
              : 'No words match your search.'}
          </Text>
        }
      />

      {/* Bottom action bar */}
      <View
        style={[
          styles.bottomBar,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <View style={styles.counterWrap}>
          <Text style={[styles.counter, { color: palette.text }]}>
            {selectedCount} {selectedCount === 1 ? 'word' : 'words'} selected
          </Text>
        </View>

        <StudyButton
          label="Add to List"
          variant={canAdd ? 'primary' : 'inactive'}
          size="medium"
          onPress={handleAdd}
          disabled={!canAdd}
          style={styles.addBtn}
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  wordInfo: { flex: 1, gap: 2 },
  lemma: { fontSize: 16, fontWeight: '700' },
  english: { fontSize: 13 },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  counterWrap: { flex: 1 },
  counter: { fontSize: 14, fontWeight: '700' },
  addBtn: { flexShrink: 0 },
});
