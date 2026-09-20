/**
 * SCREEN — BUILD YOUR OWN
 * Two-step flow:
 *   Step 1 — Browse + filter the master vocab list, tap to select words (min 10)
 *   Step 2 — Name the list and confirm pool creation
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import type { Pool } from '@/src/types/pool';
import { generatePoolId, snapToDeckSize } from '@/src/types/pool';
import SearchBar from '@/src/components/ui/SearchBar';
import SearchModeToggle from '@/src/components/ui/SearchModeToggle';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const MIN_WORDS = 10;

// ── Helper: next "List N" name ────────────────────────────────────────────────

function nextListName(existingPools: Pool[]): string {
  const nums = existingPools
    .map(p => {
      const m = p.name.match(/^List (\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `List ${max + 1}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Step = 'select' | 'naming';

export default function BuildYourOwnScreen() {
  const router = useRouter();
  const { state, isReady, getLanguagePools, createPool } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  // Redirect if no language selected
  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  // ── Master data ───────────────────────────────────────────────────────────
  const masterWords = useMemo(
    () => (language ? getMasterDataset(language) : []),
    [language],
  );

  const allCategories = useMemo(
    () => getUniqueCategories(masterWords),
    [masterWords],
  );

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<VocabSearchMode>('target');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [listName, setListName] = useState('');

  // ── Derived lists ─────────────────────────────────────────────────────────
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
  const canProceed = selectedCount >= MIN_WORDS;

  // ── Toggle word selection ─────────────────────────────────────────────────
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

  // ── Proceed to naming step ────────────────────────────────────────────────
  const handleProceed = useCallback(() => {
    if (!language || !canProceed) return;
    const existing = getLanguagePools(language);
    setListName(nextListName(existing));
    setStep('naming');
  }, [language, canProceed, getLanguagePools]);

  // ── Confirm pool creation ─────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!language) return;
    const selectedWords = masterWords.filter(w => selectedIds.has(w.id));
    if (selectedWords.length === 0) return;

    const trimmed = listName.trim() || nextListName(getLanguagePools(language));
    const deckSize = snapToDeckSize(Math.min(selectedWords.length, 25));

    const pool: Pool = {
      id: generatePoolId(),
      name: trimmed,
      language,
      words: selectedWords.map(item => ({ item, frequency: 'normal' })),
      deckSize,
      createdVia: 'custom',
      pausedWordIds: [],
    };

    createPool(pool);

    const { source } = getAddListLaunchSource();
    if (source === 'study_mode') {
      router.replace('/select-study-list' as never);
    } else {
      router.dismiss(2);
    }
  }, [language, masterWords, selectedIds, listName, getLanguagePools, createPool, router]);

  useAndroidBackHandler(
    useCallback(() => {
      if (step === 'naming') {
        setStep('select');
      } else {
        router.back();
      }
      return true;
    }, [step, router]),
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
        onPress={() => toggleSelection(item.id)}
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'naming') {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: palette.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={styles.flex}>
            {/* Top bar */}
            <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
              <TouchableOpacity onPress={() => setStep('select')} hitSlop={8}>
                <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[styles.screenTitle, { color: palette.text }]}>
                Name Your List
              </Text>
              <View style={styles.topBarSpacer} />
            </View>

            <ScrollView
              contentContainerStyle={styles.namingContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.stepHeading, { color: palette.text }]}>
                Name Your List
              </Text>
              <Text style={[styles.stepSub, { color: palette.subtext }]}>
                {selectedCount} words selected
              </Text>

              <TextInput
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={listName}
                onChangeText={setListName}
                placeholder="Enter list name"
                placeholderTextColor={palette.subtext}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
                maxLength={60}
                selectTextOnFocus
              />

              {/* Summary */}
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <SummaryRow
                  label="Words"
                  value={String(selectedCount)}
                  palette={palette}
                />
                <SummaryRow label="Created via" value="Custom" palette={palette} />
              </View>

              <StudyButton
                label="Confirm"
                variant="primary"
                size="large"
                onPress={handleConfirm}
                disabled={listName.trim().length === 0}
                style={styles.actionBtn}
              />
            </ScrollView>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 1: Word selection ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          {/* Top bar */}
          <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.screenTitle, { color: palette.text }]}>
              Build Your Own
            </Text>
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
            />
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="always"
          >
        {/* "All" chip */}
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: palette.border, backgroundColor: palette.card },
            selectedCategory === null && { backgroundColor: palette.tint, borderColor: palette.tint },
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
            onPress={() =>
              setSelectedCategory(prev => (prev === cat ? null : cat))
            }
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
        </View>
      </TouchableWithoutFeedback>

      {/* Word list */}
      <FlatList
        data={filteredWords}
        keyExtractor={item => item.id}
        renderItem={renderWord}
        style={styles.list}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No words match your search.
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
          {!canProceed && (
            <Text style={[styles.counterHint, { color: palette.subtext }]}>
              (minimum {MIN_WORDS})
            </Text>
          )}
        </View>

        <StudyButton
          label="Add to My Lists"
          variant={canProceed ? 'primary' : 'inactive'}
          size="medium"
          onPress={handleProceed}
          disabled={!canProceed}
          style={styles.proceedBtn}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Summary row sub-component ─────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 8 },

  // Category chips
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

  // Word list
  list: { flex: 1 },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 32,
    paddingHorizontal: 24,
  },

  // Word row — mirrors list-setup.tsx
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

  // Bottom action bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  counterWrap: { flex: 1, gap: 2 },
  counter: { fontSize: 14, fontWeight: '700' },
  counterHint: { fontSize: 12 },
  proceedBtn: { flexShrink: 0 },

  // Naming step
  namingContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  stepHeading: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  stepSub: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  nameInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 18,
    fontWeight: '600',
  },
  summaryCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  actionBtn: { width: '100%', marginTop: 4 },
});
