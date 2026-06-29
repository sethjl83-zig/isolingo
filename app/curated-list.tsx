/**
 * SCREEN — CURATED LISTS
 * Browse approved categories, multi-select, then create one pool per category.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useColorScheme,
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

    // "Basic Words" combined entry goes first
    const basicWords = master.filter(w =>
      w.category.some(c => BASIC_SUBCATEGORIES.has(c.toLowerCase())),
    );
    result.push({
      key: BASIC_WORDS_KEY,
      displayName: 'Basic Words',
      words: basicWords,
    });

    // Regular per-category entries
    for (const cat of CURATED_CATEGORIES) {
      const words = master.filter(w => w.category.includes(cat));
      result.push({ key: cat, displayName: capitalise(cat), words });
    }

    return result;
  }, [language]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

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

  // ── Confirm — create one pool per selected category ───────────────────────
  const handleConfirm = useCallback(() => {
    if (!language || !canProceed) return;

    const existingPools = getLanguagePools(language);
    // Track names assigned in this batch to handle duplicates within the batch
    const takenNames = new Set(existingPools.map(p => p.name));

    for (const key of selectedKeys) {
      const entry = entries.find(e => e.key === key);
      if (!entry || entry.words.length === 0) continue;

      const poolName = uniquePoolName(entry.displayName, takenNames);
      takenNames.add(poolName); // reserve this name for subsequent iterations

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

    // Pop this screen + add-list, landing back on My Lists
    router.dismiss(2);
  }, [language, canProceed, selectedKeys, entries, getLanguagePools, createPool, router]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isReady || !language) return null;

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
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Curated Lists</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Selection summary */}
      <View style={[styles.summaryBar, { borderBottomColor: palette.border }]}>
        <Text style={[styles.summaryText, { color: palette.subtext }]}>
          {selectedCount === 0
            ? 'Tap a category to select it'
            : `${selectedCount} ${selectedCount === 1 ? 'category' : 'categories'} selected`}
        </Text>
      </View>

      {/* Category list */}
      <FlatList
        data={entries}
        keyExtractor={e => e.key}
        renderItem={renderEntry}
        style={styles.list}
        showsVerticalScrollIndicator
      />

      {/* Bottom action bar */}
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
          onPress={handleConfirm}
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
  confirmBtn: { width: '100%' },
});
