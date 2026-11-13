/**
 * SCREEN — STUDY A TOPIC
 * Single-select topic picker. Tapping a topic reuses a list with that exact
 * name, or creates one, then continues.
 */
import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { getAddListLaunchSource } from './add-list';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { getMasterDataset } from '@/src/data';
import type { VocabItem } from '@/src/types/vocab';
import type { Pool } from '@/src/types/pool';
import { generatePoolId } from '@/src/types/pool';
import { deckSizeForNewList, resolveSingleListLaunch } from '@/src/utils/listDeckLaunch';
import type { SingleListLaunch } from '@/src/utils/listDeckLaunch';
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

/** Topics with no designed asset. Drawn in the same 56 pt circle, at the designed glyph size. */
const VECTOR_TOPIC_ICONS: Record<
  string,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  travel: 'airplane',
  work: 'briefcase',
  health: 'medical-bag',
  emotions: 'emoticon-happy',
  shopping: 'cart',
  time: 'clock',
  objects: 'cube',
  culture: 'drama-masks',
  technology: 'laptop',
  leisure: 'party-popper',
  connectors: 'link-variant',
};

const VECTOR_ICON_SIZE = 28;

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface CuratedEntry {
  key: string;
  displayName: string;
  words: VocabItem[];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function openListLaunch(
  router: ReturnType<typeof useRouter>,
  launch: SingleListLaunch,
  replace: boolean,
) {
  const navigate = replace ? router.replace : router.push;
  if (launch.screen === 'deck-size') {
    navigate({
      pathname: '/deck-size',
      params: { poolIds: launch.poolIds, totalCount: launch.totalCount },
    } as never);
    return;
  }
  navigate({
    pathname: '/direction',
    params: {
      poolIds: launch.poolIds,
      deckSize: launch.deckSize,
      deckIds: launch.deckIds,
    },
  } as never);
}

export default function CuratedListScreen() {
  const router = useRouter();
  const { state, isReady, getLanguagePools, createPool, updatePool } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;
  const busyRef = useRef(false);

  useEffect(() => {
    if (isReady && !language) router.replace('/');
  }, [isReady, language, router]);

  useFocusEffect(
    useCallback(() => {
      busyRef.current = false;
    }, []),
  );

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

  const continueWithList = useCallback(async (pool: Pool) => {
    const { source } = getAddListLaunchSource();
    if (source === 'study_mode') {
      const studyType = state.studyTypeSelected ?? 'general_vocab';
      const launch = await resolveSingleListLaunch(pool, pool.language, studyType);
      openListLaunch(router, launch, false);
      return;
    }
    router.dismiss(2);
  }, [router, state.studyTypeSelected]);

  const handleTopicPress = useCallback(async (entry: CuratedEntry) => {
    if (!language || busyRef.current || entry.words.length === 0) return;
    busyRef.current = true;
    try {
      const existing = getLanguagePools(language).find(pool => pool.name === entry.displayName);
      const wordCount = existing ? existing.words.length : entry.words.length;
      let pool = existing;

      if (!pool) {
        pool = {
          id: generatePoolId(),
          name: entry.displayName,
          language,
          words: entry.words.map(item => ({ item, frequency: 'normal' as const })),
          deckSize: deckSizeForNewList(wordCount),
          deckSizeChosen: wordCount <= 10,
          createdVia: 'curated',
          pausedWordIds: [],
        };
        createPool(pool);
      } else if (wordCount <= 10 && !pool.deckSizeChosen) {
        pool = { ...pool, deckSize: wordCount, deckSizeChosen: true };
        updatePool(pool.id, { deckSize: wordCount, deckSizeChosen: true });
      }

      if (wordCount > 10 && !pool.deckSizeChosen) {
        const { source } = getAddListLaunchSource();
        router.push({
          pathname: '/deck-size',
          params: {
            poolIds: JSON.stringify([pool.id]),
            totalCount: String(wordCount),
            fromCreate: '1',
            afterCreate: source === 'study_mode' ? 'launch' : 'my-lists',
          },
        } as never);
        return;
      }

      await continueWithList(pool);
    } catch {
      busyRef.current = false;
    }
  }, [language, getLanguagePools, createPool, updatePool, router, continueWithList]);

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  if (!isReady || !language) return null;

  const renderEntry = ({ item: entry }: { item: CuratedEntry }) => {
    const isEmpty = entry.words.length === 0;
    const icon = CATEGORY_ICONS[entry.key];
    const vectorName = icon ? undefined : VECTOR_TOPIC_ICONS[entry.key];
    const fallback = icon ?? BOOK_ICON;
    const wellColor = {
      orange: hexAlpha(palette.listIconOrange, 0.12),
      purple: hexAlpha(palette.primary, 0.12),
      teal: hexAlpha(palette.teal, 0.12),
      food: hexAlpha(palette.listIconFood, 0.12),
      blue: hexAlpha(palette.listIconBlue, 0.12),
      nature: hexAlpha(palette.listIconNature, 0.12),
    }[fallback.well];

    return (
      <TouchableOpacity
        style={[styles.cardShadow, isEmpty && styles.rowDisabled]}
        onPress={() => { void handleTopicPress(entry); }}
        disabled={isEmpty}
        activeOpacity={isEmpty ? 1 : 0.75}
      >
        <View style={[styles.card, { borderColor: palette.listCardBorder }]}>
          {vectorName ? (
            <View style={[styles.iconWell, { backgroundColor: hexAlpha(palette.primary, 0.12) }]}>
              <MaterialCommunityIcons
                name={vectorName}
                size={VECTOR_ICON_SIZE}
                color={palette.primary}
              />
            </View>
          ) : fallback.baked ? (
            <Image source={fallback.source} style={styles.bakedWell} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.iconWell, { backgroundColor: wellColor }]}>
              <Image
                source={fallback.source}
                style={{ width: fallback.width, height: fallback.height }}
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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <View pointerEvents="none" style={styles.titleOverlay}>
          <Text style={styles.screenTitle} numberOfLines={1}>Study a Topic</Text>
        </View>
        <View style={styles.headerRow} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
          >
            <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.key}
        renderItem={renderEntry}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
      />
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
  safe: { flex: 1, backgroundColor: '#F7F5FD' },

  topBar: {
    height: 36,
    marginHorizontal: 16,
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  backIcon: {
    width: 17,
    height: 17,
    transform: [{ rotate: '-90deg' }],
  },
  screenTitle: {
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
    includeFontPadding: false,
  },

  list: { flex: 1, marginTop: 25 },
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
});
