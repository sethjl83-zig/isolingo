/**
 * SCREEN — CURATED LISTS
 * Browse approved categories, multi-select, then create pools per category or combined.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Alert, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, ScrollView } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { getMasterDataset } from '@/src/data';
import type { VocabItem } from '@/src/types/vocab';
import type { Pool } from '@/src/types/pool';
import { generatePoolId, snapToDeckSize } from '@/src/types/pool';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

// ── Category config ───────────────────────────────────────────────────────────

/** Regular single-category entries, in spec-defined order. */
const CURATED_CATEGORIES = [
  'people',
  'body',
  'home',
  'food',
  'animals',
  'nature',
  'travel',
  'work',
  'health',
  'emotions',
  'shopping',
  'time',
  'objects',
  'culture',
  'technology',
  'leisure',
  'connectors',
] as const;

/**
 * The four "basic" sub-categories that are shown as a single combined option.
 * Words in any of these categories are included in the "Basic Words" pool.
 */
const BASIC_SUBCATEGORIES = new Set([
  'basic nouns',
  'basic verbs',
  'basic adjectives',
  'basic adverbs',
]);

/** Sentinel key for the combined Basic Words entry. */
const BASIC_WORDS_KEY = '__basic_words__';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const checkIcon = require('@/assets/images/lists/check-white.png');

type IconWell = 'orange' | 'purple' | 'teal' | 'food' | 'blue' | 'nature';

interface CategoryIcon {
  source: number;
  well: IconWell;
  width: number;
  height: number;
  /** The asset already includes its circular well. */
  baked?: boolean;
}

const BOOK_ICON: CategoryIcon = {
  source: require('@/assets/images/lists/icon-books.png'),
  well: 'orange',
  width: 28,
  height: 28,
};

const CATEGORY_ICONS: Record<string, CategoryIcon> = {
  [BASIC_WORDS_KEY]: BOOK_ICON,
  people: {
    source: require('@/assets/images/lists/icon-people.png'),
    well: 'purple',
    width: 30,
    height: 30,
  },
  home: {
    source: require('@/assets/images/lists/icon-home.png'),
    well: 'teal',
    width: 28,
    height: 30,
  },
  food: {
    source: require('@/assets/images/lists/icon-food.png'),
    well: 'food',
    width: 30,
    height: 30,
  },
  body: {
    source: require('@/assets/images/lists/icon-body-well.png'),
    well: 'blue',
    width: 56,
    height: 56,
    baked: true,
  },
  nature: {
    source: require('@/assets/images/lists/icon-nature.png'),
    well: 'nature',
    width: 30,
    height: 30,
  },
  animals: {
    source: require('@/assets/images/lists/icon-paw.png'),
    well: 'blue',
    width: 28,
    height: 28,
  },
};

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CuratedEntry {
  key: string;
  displayName: string;
  words: VocabItem[];
}

type ScreenStep = 'select' | 'naming';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Capitalise the first letter of a string. */
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Find a unique pool name relative to both existing and already-queued pools.
 * Appends " 2", " 3", … until the name is free.
 */
function uniquePoolName(baseName: string, takenNames: Set<string>): string {
  if (!takenNames.has(baseName)) return baseName;
  let n = 2;
  while (takenNames.has(`${baseName} ${n}`)) n++;
  return `${baseName} ${n}`;
}

function nextCombinedListName(existingPools: Pool[]): string {
  const nums = existingPools
    .map(p => {
      const m = p.name.match(/^Combined List (\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `Combined List ${max + 1}`;
}

function getSelectedEntries(
  entries: CuratedEntry[],
  selectedKeys: Set<string>,
): CuratedEntry[] {
  return entries.filter(e => selectedKeys.has(e.key) && e.words.length > 0);
}

function defaultCombinedListName(
  selectedEntries: CuratedEntry[],
  existingPools: Pool[],
): string {
  if (selectedEntries.length > 3) {
    return nextCombinedListName(existingPools);
  }
  return selectedEntries.map(e => e.displayName).join(' + ');
}

function combineWords(selectedEntries: CuratedEntry[]): VocabItem[] {
  const seen = new Set<string>();
  const result: VocabItem[] = [];
  for (const entry of selectedEntries) {
    for (const word of entry.words) {
      if (!seen.has(word.id)) {
        seen.add(word.id);
        result.push(word);
      }
    }
  }
  return result;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CuratedListScreen() {
  const router = useRouter();
  const { state, isReady, getLanguagePools, createPool } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  // ── Build curated entries from master dataset ──────────────────────────────
  const entries: CuratedEntry[] = useMemo(() => {
    if (!language) return [];
    const master = getMasterDataset(language);

    const result: CuratedEntry[] = [];

    const basicWords = master.filter(w =>
      w.category.some(c => BASIC_SUBCATEGORIES.has(c.toLowerCase())),
    );
    result.push({
      key: BASIC_WORDS_KEY,
      displayName: 'Basic Words',
      words: basicWords,
    });

    const seenKeys = new Set<string>();
    for (const cat of CURATED_CATEGORIES) {
      const key = cat.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const words = master.filter(w =>
        w.category.some(c => c.toLowerCase() === key),
      );
      result.push({ key, displayName: capitalise(key), words });
    }

    return result;
  }, [language]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<ScreenStep>('select');
  const [listName, setListName] = useState('');
  const [combinedWordCount, setCombinedWordCount] = useState(0);

  const toggleCategory = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectedCount = selectedKeys.size;
  const canProceed = selectedCount > 0;

  const navigateAfterCreate = useCallback(() => {
    const { source } = getAddListLaunchSource();
    if (source === 'study_mode') {
      router.replace('/select-study-list' as never);
    } else {
      router.dismiss(2);
    }
  }, [router]);

  const createSeparatePools = useCallback(() => {
    if (!language || !canProceed) return;

    const existingPools = getLanguagePools(language);
    const takenNames = new Set(existingPools.map(p => p.name));

    for (const key of selectedKeys) {
      const entry = entries.find(e => e.key === key);
      if (!entry || entry.words.length === 0) continue;

      const poolName = uniquePoolName(entry.displayName, takenNames);
      takenNames.add(poolName);

      const pool: Pool = {
        id: generatePoolId(),
        name: poolName,
        language,
        words: entry.words.map(item => ({ item, frequency: 'normal' })),
        deckSize: snapToDeckSize(Math.min(entry.words.length, 25)),
        createdVia: 'curated',
        pausedWordIds: [],
      };

      createPool(pool);
    }

    navigateAfterCreate();
  }, [
    language,
    canProceed,
    selectedKeys,
    entries,
    getLanguagePools,
    createPool,
    navigateAfterCreate,
  ]);

  const startCombineFlow = useCallback(() => {
    if (!language || !canProceed) return;

    const selectedEntries = getSelectedEntries(entries, selectedKeys);
    const words = combineWords(selectedEntries);
    if (words.length === 0) return;

    const existingPools = getLanguagePools(language);
    setCombinedWordCount(words.length);
    setListName(defaultCombinedListName(selectedEntries, existingPools));
    setStep('naming');
  }, [language, canProceed, entries, selectedKeys, getLanguagePools]);

  const handleConfirmCombined = useCallback(() => {
    if (!language || !canProceed) return;

    const selectedEntries = getSelectedEntries(entries, selectedKeys);
    const words = combineWords(selectedEntries);
    if (words.length === 0) return;

    const existingPools = getLanguagePools(language);
    const takenNames = new Set(existingPools.map(p => p.name));
    const trimmed = listName.trim();
    const baseName =
      trimmed || defaultCombinedListName(selectedEntries, existingPools);
    const poolName = uniquePoolName(baseName, takenNames);

    const pool: Pool = {
      id: generatePoolId(),
      name: poolName,
      language,
      words: words.map(item => ({ item, frequency: 'normal' })),
      deckSize: snapToDeckSize(Math.min(words.length, 25)),
      createdVia: 'curated',
      pausedWordIds: [],
    };

    createPool(pool);
    navigateAfterCreate();
  }, [
    language,
    canProceed,
    entries,
    selectedKeys,
    listName,
    getLanguagePools,
    createPool,
    navigateAfterCreate,
  ]);

  const handleAddPress = useCallback(() => {
    if (!canProceed) return;

    if (selectedCount === 1) {
      createSeparatePools();
      return;
    }

    Alert.alert('Create separate lists or combine into one?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Separate Lists',
        onPress: createSeparatePools,
      },
      {
        text: 'Combine into One List',
        onPress: startCombineFlow,
      },
    ]);
  }, [canProceed, selectedCount, createSeparatePools, startCombineFlow]);

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

  // ── Naming step (combined list) ───────────────────────────────────────────
  if (step === 'naming') {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: palette.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={styles.flex}>
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
              <Text style={[styles.stepHeading, { color: palette.text }]}>
                Name Your List
              </Text>
              <Text style={[styles.stepSub, { color: palette.subtext }]}>
                {combinedWordCount} {combinedWordCount === 1 ? 'word' : 'words'} from{' '}
                {selectedCount} {selectedCount === 1 ? 'category' : 'categories'}
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
                onSubmitEditing={handleConfirmCombined}
                maxLength={60}
                selectTextOnFocus
              />

              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <View
                  style={[
                    styles.summaryRow,
                    {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: palette.subtext }]}>Words</Text>
                  <Text style={[styles.summaryValue, { color: palette.text }]}>
                    {combinedWordCount}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: palette.subtext }]}>
                    Created via
                  </Text>
                  <Text style={[styles.summaryValue, { color: palette.text }]}>Curated</Text>
                </View>
              </View>

              <StudyButton
                label="Confirm"
                variant="primary"
                size="large"
                onPress={handleConfirmCombined}
                disabled={listName.trim().length === 0}
                style={styles.confirmBtn}
              />
            </ScrollView>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderEntry = ({ item: entry }: { item: CuratedEntry }) => {
    const isSelected = selectedKeys.has(entry.key);
    const isEmpty = entry.words.length === 0;
    const icon = CATEGORY_ICONS[entry.key] ?? BOOK_ICON;
    const wellColor = {
      orange: hexAlpha(palette.listIconOrange, 0.12),
      purple: hexAlpha(palette.primary, 0.12),
      teal: hexAlpha(palette.teal, 0.12),
      food: hexAlpha(palette.listIconFood, 0.12),
      blue: hexAlpha(palette.listIconBlue, 0.12),
      nature: hexAlpha(palette.listIconNature, 0.12),
    }[icon.well];

    return (
      <TouchableOpacity
        style={[styles.cardShadow, isEmpty && styles.rowDisabled]}
        onPress={() => !isEmpty && toggleCategory(entry.key)}
        activeOpacity={isEmpty ? 1 : 0.75}
      >
        <View style={[styles.card, { borderColor: palette.listCardBorder }]}>
          {icon.baked ? (
            <Image source={icon.source} style={styles.bakedWell} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.iconWell, { backgroundColor: wellColor }]}>
              <Image
                source={icon.source}
                style={{ width: icon.width, height: icon.height }}
                accessibilityIgnoresInvertColors
              />
            </View>
          )}
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, isEmpty && { color: 'rgba(0,0,0,0.45)' }]}>
              {entry.displayName}
            </Text>
            <Text style={styles.rowCount}>
              {entry.words.length === 0
                ? 'No words available'
                : `${entry.words.length} ${entry.words.length === 1 ? 'word' : 'words'}`}
            </Text>
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
        <Text style={styles.screenTitle} pointerEvents="none">Curated Lists</Text>
      </View>

      <Text style={styles.summaryText}>
        {selectedCount === 0
          ? 'Tap a category to select it'
          : `${selectedCount} ${selectedCount === 1 ? 'category' : 'categories'} selected`}
      </Text>

      <FlatList
        data={entries}
        keyExtractor={e => e.key}
        renderItem={renderEntry}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
      />

      <View style={styles.bottomBar}>
        <StudyButton
          label={`Add to My Lists (${selectedCount} Selected)`}
          variant="primary"
          size="medium"
          onPress={handleAddPress}
          disabled={!canProceed}
          style={styles.categoryConfirmBtn}
          textStyle={styles.confirmLabel}
        />
      </View>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: '#F7F5FD' },
  flex: { flex: 1 },

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

  summaryText: {
    marginTop: 25,
    marginHorizontal: 16,
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 10,
  },

  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  card: {
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowDisabled: { opacity: 0.45 },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bakedWell: { width: 56, height: 56 },
  rowInfo: { flex: 1, gap: 6 },
  rowName: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#25262B',
  },
  rowCount: {
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
  },
  confirmBtn: {
    width: 255,
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  categoryConfirmBtn: {
    alignSelf: 'stretch',
    height: 48,
    minWidth: 0,
    paddingVertical: 0,
    borderRadius: 12,
  },
  confirmLabel: {
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontFamily: HomeFonts.interRegular,
    backgroundColor: '#FFFFFF',
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
  summaryLabel: { fontSize: 14, fontFamily: HomeFonts.interRegular },
  summaryValue: { fontSize: 14, fontFamily: HomeFonts.interSemiBold },
});
