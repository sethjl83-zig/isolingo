/**
 * SCREEN — BUILD YOUR OWN
 * Two-step flow:
 *   Step 1 — Browse + filter the master vocab list, tap to select words (min 10)
 *   Step 2 — Name the list and confirm pool creation
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View, Text, Image, TouchableOpacity, FlatList, ScrollView, StyleSheet, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
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
import type { Pool } from '@/src/types/pool';
import { generatePoolId, snapToDeckSize } from '@/src/types/pool';
import SearchBar from '@/src/components/ui/SearchBar';
import SearchModeToggle from '@/src/components/ui/SearchModeToggle';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const MIN_WORDS = 10;
const backChevron = require('@/assets/images/lists/back-chevron.png');
const checkIcon = require('@/assets/images/lists/check-white.png');

/** Words saved on New Word while Build Your Own is still open. */
let pendingBuildWords: VocabItem[] = [];

type BuildDraft = {
  step: 'select' | 'naming';
  searchQuery: string;
  searchMode: VocabSearchMode;
  selectedCategory: string | null;
  selectedIds: string[];
  newWords: VocabItem[];
  listName: string;
};

/** Keeps the in-progress list if this screen remounts on the way back from New Word. */
let buildDraft: BuildDraft | null = null;

export function holdBuildYourOwnWord(item: VocabItem): void {
  pendingBuildWords = [...pendingBuildWords, item];
}

function takePendingBuildWords(): VocabItem[] {
  const words = pendingBuildWords;
  pendingBuildWords = [];
  return words;
}

function clearBuildDraft(): void {
  buildDraft = null;
  pendingBuildWords = [];
}

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  const navigation = useNavigation();
  const keepDraft = useRef(true);
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
  const [step, setStep] = useState<Step>(buildDraft?.step ?? 'select');
  const [searchQuery, setSearchQuery] = useState(buildDraft?.searchQuery ?? '');
  const [searchMode, setSearchMode] = useState<VocabSearchMode>(buildDraft?.searchMode ?? 'target');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(buildDraft?.selectedCategory ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(buildDraft?.selectedIds ?? []),
  );
  const [newWords, setNewWords] = useState<VocabItem[]>(buildDraft?.newWords ?? []);

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [listName, setListName] = useState(buildDraft?.listName ?? '');

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

  const listedWords = useMemo(() => {
    const newIds = new Set(newWords.map(word => word.id));
    return [...newWords, ...filteredWords.filter(word => !newIds.has(word.id))];
  }, [newWords, filteredWords]);

  const searchPlaceholder =
    searchMode === 'target'
      ? `Search ${getLanguageDisplayName(language)} words…`
      : 'Search English words…';

  const selectedCount = selectedIds.size + newWords.length;
  const canProceed = selectedCount >= MIN_WORDS;

  useFocusEffect(
    useCallback(() => {
      const arrived = takePendingBuildWords();
      if (arrived.length === 0) return;
      setNewWords(prev => {
        const seen = new Set(prev.map(word => word.id));
        const added = arrived.filter(word => !seen.has(word.id));
        return added.length > 0 ? [...added, ...prev] : prev;
      });
    }, []),
  );

  useEffect(() => {
    if (!keepDraft.current) return;
    buildDraft = {
      step,
      searchQuery,
      searchMode,
      selectedCategory,
      selectedIds: [...selectedIds],
      newWords,
      listName,
    };
  }, [step, searchQuery, searchMode, selectedCategory, selectedIds, newWords, listName]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      keepDraft.current = false;
      clearBuildDraft();
    });
  }, [navigation]);

  const leaveBuild = useCallback(() => {
    router.back();
  }, [router]);

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

  const removeNewWord = useCallback((id: string) => {
    setNewWords(prev => prev.filter(word => word.id !== id));
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
    const selectedWords = [
      ...newWords,
      ...masterWords.filter(w => selectedIds.has(w.id)),
    ];
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
    clearBuildDraft();

    const { source } = getAddListLaunchSource();
    if (source === 'study_mode') {
      router.replace('/select-study-list' as never);
    } else {
      router.dismiss(2);
    }
  }, [language, masterWords, selectedIds, newWords, listName, getLanguagePools, createPool, router]);

  useAndroidBackHandler(
    useCallback(() => {
      if (step === 'naming') {
        setStep('select');
      } else {
        leaveBuild();
      }
      return true;
    }, [step, leaveBuild]),
  );

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isReady || !language) return null;

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderWord = ({ item }: { item: VocabItem }) => {
    const isNew = newWords.some(word => word.id === item.id);
    const isSelected = isNew || selectedIds.has(item.id);
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    return (
      <TouchableOpacity
        style={styles.cardShadow}
        onPress={() => (isNew ? removeNewWord(item.id) : toggleSelection(item.id))}
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'naming') {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: '#F7F5FD' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => setStep('select')}
                hitSlop={8}
                accessibilityLabel="Back"
                style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
              >
                <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
              </TouchableOpacity>
              <Text style={styles.screenTitle} pointerEvents="none">
                Name Your List
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.namingContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.stepHeading}>
                Name Your List
              </Text>
              <Text style={styles.stepSub}>
                {selectedCount} words selected
              </Text>

              <TextInput
                style={styles.nameInput}
                value={listName}
                onChangeText={setListName}
                placeholder="Enter list name"
                placeholderTextColor="rgba(0,0,0,0.5)"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
                maxLength={60}
                selectTextOnFocus
              />

              <View style={[styles.summaryCard, { borderColor: palette.listCardBorder }]}>
                <SummaryRow label="Words" value={String(selectedCount)} showDivider />
                <SummaryRow label="Created via" value="Custom" />
              </View>
            </ScrollView>

            <View style={styles.bottomBar}>
              <StudyButton
                label="Confirm"
                variant="primary"
                size="medium"
                onPress={handleConfirm}
                disabled={listName.trim().length === 0}
                style={styles.primaryBtn}
                textStyle={styles.primaryLabel}
              />
            </View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 1: Word selection ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={leaveBuild}
              hitSlop={8}
              accessibilityLabel="Back"
              style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
            >
              <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
            </TouchableOpacity>
            <Text style={styles.screenTitle} pointerEvents="none">
              Build Your Own
            </Text>
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
        data={listedWords}
        keyExtractor={item => item.id}
        renderItem={renderWord}
        extraData={newWords}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No words match your search.
          </Text>
        }
      />

      <View style={styles.bottomBar}>
        <StudyButton
          label={`Add to My Lists (${selectedCount} Selected)`}
          variant="primary"
          size="medium"
          onPress={handleProceed}
          disabled={!canProceed}
          style={styles.primaryBtn}
          textStyle={styles.primaryLabel}
        />
        <StudyButton
          label="Create New Word"
          variant="secondary"
          size="medium"
          onPress={() => router.push({ pathname: '/add-word', params: { fromBuild: '1' } } as never)}
          style={styles.createWordBtn}
          textStyle={styles.primaryLabel}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Summary row sub-component ─────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  showDivider = false,
}: {
  label: string;
  value: string;
  showDivider?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, showDivider && styles.summaryDivider]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    backgroundColor: '#F7F5FD',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
    gap: 12,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  createWordBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5E51A4',
  },
  primaryLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },

  namingContent: {
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 32,
    gap: 16,
  },
  stepHeading: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
  },
  stepSub: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
    marginTop: -8,
  },
  nameInput: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(210,232,215,0.8)',
  },
  summaryLabel: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 14,
    color: '#636265',
  },
  summaryValue: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 14,
    color: '#25262B',
  },
});
