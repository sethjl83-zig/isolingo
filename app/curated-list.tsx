/**
 * SCREEN — CURATED LISTS
 * Browse approved categories, multi-select, then create pools per category or combined.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useColorScheme,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
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

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { borderBottomColor: palette.border },
          isSelected && { backgroundColor: palette.feedback },
          isEmpty && styles.rowDisabled,
        ]}
        onPress={() => !isEmpty && toggleCategory(entry.key)}
        activeOpacity={isEmpty ? 1 : 0.7}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: isEmpty ? palette.border : palette.tint },
            isSelected && { backgroundColor: palette.tint },
          ]}
        >
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>

        <View style={styles.rowInfo}>
          <Text
            style={[
              styles.rowName,
              { color: isEmpty ? palette.subtext : palette.text },
            ]}
          >
            {entry.displayName}
          </Text>
          <Text style={[styles.rowCount, { color: palette.subtext }]}>
            {entry.words.length === 0
              ? 'No words available'
              : `${entry.words.length} ${entry.words.length === 1 ? 'word' : 'words'}`}
          </Text>
        </View>

        {isSelected && (
          <Text style={[styles.selectedBadge, { color: palette.tint }]}>✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Curated Lists</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={[styles.summaryBar, { borderBottomColor: palette.border }]}>
        <Text style={[styles.summaryText, { color: palette.subtext }]}>
          {selectedCount === 0
            ? 'Tap a category to select it'
            : `${selectedCount} ${selectedCount === 1 ? 'category' : 'categories'} selected`}
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.key}
        renderItem={renderEntry}
        style={styles.list}
        showsVerticalScrollIndicator
      />

      <View
        style={[
          styles.bottomBar,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <StudyButton
          label="Add to My Lists"
          variant={canProceed ? 'primary' : 'inactive'}
          size="large"
          onPress={handleAddPress}
          disabled={!canProceed}
          style={styles.confirmBtn}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
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

  summaryBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryText: { fontSize: 14, fontWeight: '500' },

  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowDisabled: { opacity: 0.45 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowCount: { fontSize: 13 },
  selectedBadge: { fontSize: 18, fontWeight: '700' },

  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },

  namingContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 16,
  },
  stepHeading: { fontSize: 24, fontWeight: '700' },
  stepSub: { fontSize: 15, marginTop: -8 },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  confirmBtn: { width: '100%', borderRadius: 28, minWidth: 0 },
});
