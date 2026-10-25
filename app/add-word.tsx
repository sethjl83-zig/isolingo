/**
 * SCREEN — NEW WORD
 * Form to create a user-defined vocabulary word and add it directly into one
 * or more of the user's existing pools.
 *
 * IMPORTANT: this screen does NOT touch the master vocab dataset. The new word
 * lives only in the pool(s) the user selects and will never appear in Curated
 * Lists, Build Your Own, or Random.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Image, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import type { VocabItem, PartOfSpeech, Gender, Language } from '@/src/types/vocab';
import type { Pool } from '@/src/types/pool';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { holdBuildYourOwnWord } from './build-your-own';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const checkIcon = require('@/assets/images/lists/check-white.png');
const fieldGlobe = require('@/assets/images/lists/field-globe.png');
const fieldLanguage = require('@/assets/images/lists/field-language.png');
const fieldUser = require('@/assets/images/lists/field-user.png');

const CATEGORY_ICONS: Record<string, { source: number; width: number; height: number }> = {
  people: { source: require('@/assets/images/lists/chip-people.png'), width: 16, height: 16 },
  animals: { source: require('@/assets/images/lists/chip-animals.png'), width: 14, height: 14 },
  food: { source: require('@/assets/images/lists/chip-food.png'), width: 17, height: 17 },
  home: { source: require('@/assets/images/lists/chip-home.png'), width: 15, height: 13 },
  travel: { source: require('@/assets/images/lists/chip-travel.png'), width: 12, height: 12 },
  work: { source: require('@/assets/images/lists/chip-work.png'), width: 14, height: 12 },
  objects: { source: require('@/assets/images/lists/chip-objects.png'), width: 18, height: 18 },
  nature: { source: require('@/assets/images/lists/chip-nature.png'), width: 14, height: 14 },
  time: { source: require('@/assets/images/lists/chip-time.png'), width: 13, height: 13 },
  body: { source: require('@/assets/images/lists/chip-body.png'), width: 14, height: 14 },
  general: { source: require('@/assets/images/lists/chip-general.png'), width: 12, height: 12 },
};

const POS_OPTIONS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb'];
const GENDER_OPTIONS: Gender[] = ['masculine', 'feminine', 'neuter'];
const CATEGORIES = [
  'people', 'animals', 'food', 'home', 'travel', 'work', 'objects',
  'nature', 'time', 'body', 'general',
];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function choiceSurface(selected: boolean) {
  return selected
    ? { backgroundColor: '#38A19A', borderColor: '#38A19A' }
    : { backgroundColor: '#FFFFFF', borderColor: 'rgba(94,81,164,0.2)' };
}

function choiceLabel(selected: boolean) {
  return { color: selected ? '#FFFFFF' : 'rgba(0,0,0,0.5)' };
}

function categorySurface(selected: boolean) {
  return {
    backgroundColor: '#FFFFFF',
    borderColor: selected ? '#38A19A' : 'rgba(94,81,164,0.2)',
  };
}

function categoryLabel(selected: boolean) {
  return { color: selected ? '#38A19A' : 'rgba(0,0,0,0.5)' };
}

function buildId(language: Language, lemma: string): string {
  return `${language}_${lemma.toLowerCase().replace(/[^a-z0-9]/g, '_')}_custom_${Date.now()}`;
}

function validateEntry(
  lemma: string,
  english: string,
  pos: PartOfSpeech | null,
  gender: Gender | null,
  language: Language,
): string | null {
  if (!lemma.trim()) return 'Please enter the target language word.';
  if (!english.trim()) return 'Please enter the English translation.';
  if (!pos) return 'Please select a part of speech.';
  if (pos === 'noun') {
    if (!gender) return 'Please select a gender for this noun.';
    const articlePatterns: Record<Language, RegExp> = {
      de: /^(der|die|das)\s/i,
      fr: /^(le|la|l'|les)\s/i,
      es: /^(el|la|los|las)\s/i,
    };
    if (articlePatterns[language].test(lemma.trim())) {
      return 'Enter the bare noun only — no article (e.g. "Hund", not "der Hund").';
    }
  }
  return null;
}

// ── Pool checklist row ────────────────────────────────────────────────────────

function PoolCheckRow({
  pool,
  checked,
  onToggle,
  palette,
  isFirst,
  isLast,
}: {
  pool: Pool;
  checked: boolean;
  onToggle: () => void;
  palette: (typeof Colors)['light'];
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.poolRow, isFirst && styles.poolRowFirst, isLast && styles.poolRowLast]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.checkbox,
          checked
            ? { borderColor: palette.teal, backgroundColor: palette.teal }
            : { borderColor: 'rgba(0,0,0,0.4)', backgroundColor: 'transparent' },
        ]}
      >
        {checked && (
          <Image source={checkIcon} style={styles.checkIcon} accessibilityIgnoresInvertColors />
        )}
      </View>
      <Text style={styles.poolName} numberOfLines={1}>
        {pool.name}
      </Text>
      <Text style={styles.poolCount}>
        {pool.words.length} {pool.words.length === 1 ? 'word' : 'words'}
      </Text>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddWordScreen() {
  const router = useRouter();
  const { fromBuild } = useLocalSearchParams<{ fromBuild?: string | string[] }>();
  const isFromBuild = fromBuild === '1' || (Array.isArray(fromBuild) && fromBuild.includes('1'));
  const { state, updatePool, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected ?? 'de';

  const allPools = useMemo(
    () => getLanguagePools(language),
    [language, getLanguagePools],
  );
  const hasPools = allPools.length > 0;

  // ── Form state ────────────────────────────────────────────────────────────
  const [lemma, setLemma] = useState('');
  const [english, setEnglish] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [gender, setGender] = useState<Gender | null>(null);
  const [plural, setPlural] = useState('');
  const [categories, setCategories] = useState<string[]>(['general']);
  const [selectedPoolIds, setSelectedPoolIds] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );
  };

  const togglePool = (poolId: string) => {
    setSelectedPoolIds(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) { next.delete(poolId); } else { next.add(poolId); }
      return next;
    });
  };

  const showGender = pos === 'noun';
  const showPlural = pos === 'noun';
  const canSave = isFromBuild || (hasPools && selectedPoolIds.size > 0);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const error = validateEntry(lemma, english, pos, gender, language);
    if (error) {
      Alert.alert('Check your entry', error);
      return;
    }

    const normalizedLemma = lemma.trim().toLowerCase();
    const englishNormalized = english
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .join(', ');

    const item: VocabItem = {
      id: buildId(language, lemma),
      targetLanguage: language,
      english: englishNormalized,
      senseLabel: null,
      lemma: lemma.trim(),
      partOfSpeech: pos!,
      gender: pos === 'noun' ? gender : null,
      plural: pos === 'noun' && plural.trim() ? plural.trim() : null,
      category: categories.length > 0 ? categories : ['general'],
      competencies: pos === 'noun' ? ['vocab', 'gender'] : ['vocab'],
      user_added: 'y',
    };

    if (isFromBuild) {
      holdBuildYourOwnWord(item);
      router.back();
      return;
    }

    if (!hasPools) return;

    if (selectedPoolIds.size === 0) {
      Alert.alert('No list selected', 'Please choose at least one list to add this word to.');
      return;
    }

    // Duplicate check — only within the selected pools (not the master dataset)
    const selectedPools = allPools.filter(p => selectedPoolIds.has(p.id));
    const duplicate = selectedPools.some(pool =>
      pool.words.some(pw => pw.item.lemma.toLowerCase() === normalizedLemma),
    );
    if (duplicate) {
      Alert.alert(
        'Word already in list',
        'This word already exists in one or more of your selected lists.',
      );
      return;
    }

    // Write directly into each selected pool — master dataset is NOT touched.
    for (const pool of selectedPools) {
      updatePool(pool.id, {
        words: [...pool.words, { item, frequency: 'normal' }],
      });
    }

    router.back();
  };

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  const languageName = language === 'de' ? 'German' : language === 'fr' ? 'French' : 'Spanish';
  const labelStyle = styles.label;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Cancel"
          style={styles.backBtn}
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
        <Text style={styles.screenTitle} pointerEvents="none">New Word</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        <View style={styles.field}>
          <Text style={labelStyle}>{languageName} Word (Bare Form)</Text>
          <View style={styles.inputRow}>
            <Image source={fieldGlobe} style={styles.fieldIcon} accessibilityIgnoresInvertColors />
            <TextInput
              style={styles.input}
              value={lemma}
              onChangeText={setLemma}
              placeholder={`Enter ${languageName} word`}
              placeholderTextColor="rgba(0,0,0,0.5)"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>English Translation</Text>
          <View style={styles.inputRow}>
            <Image source={fieldLanguage} style={styles.fieldIcon} accessibilityIgnoresInvertColors />
            <TextInput
              style={styles.input}
              value={english}
              onChangeText={setEnglish}
              placeholder="e.g. dog (separate multiple with commas)"
              placeholderTextColor="rgba(0,0,0,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>Part of Speech</Text>
          <View style={styles.chipRow}>
            {POS_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, choiceSurface(pos === option)]}
                onPress={() => {
                  setPos(option);
                  if (option !== 'noun') setGender(null);
                }}
              >
                <Text style={[styles.chipText, choiceLabel(pos === option)]}>
                  {titleCase(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {showGender && (
          <View style={styles.field}>
            <Text style={labelStyle}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.filter(g =>
                language === 'de' ? true : g !== 'neuter',
              ).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, choiceSurface(gender === g)]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, choiceLabel(gender === g)]}>
                    {titleCase(g)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {showPlural && (
          <View style={styles.field}>
            <Text style={labelStyle}>Plural Form (Optional)</Text>
            <View style={styles.inputRow}>
              <Image source={fieldUser} style={styles.fieldUserIcon} accessibilityIgnoresInvertColors />
              <TextInput
                style={styles.input}
                value={plural}
                onChangeText={setPlural}
                placeholder="Enter plural form"
                placeholderTextColor="rgba(0,0,0,0.5)"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={labelStyle}>Categories (Optional — select all that apply)</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(cat => {
              const active = categories.includes(cat);
              const icon = CATEGORY_ICONS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, categorySurface(active)]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Image
                    source={icon.source}
                    style={{ width: icon.width, height: icon.height, tintColor: active ? '#38A19A' : '#000000', opacity: active ? 1 : 0.5 }}
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={[styles.categoryText, categoryLabel(active)]}>
                    {titleCase(cat)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isFromBuild ? null : (
        <View style={styles.field}>
        <Text style={styles.label}>
          Add to which list(s)?
        </Text>

        {hasPools ? (
          <>
            <View style={styles.poolList}>
              {allPools.map((pool, index) => (
                <PoolCheckRow
                  key={pool.id}
                  pool={pool}
                  checked={selectedPoolIds.has(pool.id)}
                  onToggle={() => togglePool(pool.id)}
                  palette={palette}
                  isFirst={index === 0}
                  isLast={index === allPools.length - 1}
                />
              ))}
            </View>
            {selectedPoolIds.size === 0 && (
              <Text style={styles.poolHint}>
                Select at least one list.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.noPoolsBox}>
            <Text style={styles.noPoolsText}>
              You need at least one list before adding a new word. Create one in My Vocabulary first.
            </Text>
          </View>
        )}
        </View>
        )}

        {/* Actions */}
        <View style={styles.saveRow}>
          <StudyButton
            label="Cancel"
            variant="secondary"
            size="medium"
            onPress={() => router.back()}
            style={[styles.actionBtn, styles.cancelBorder]}
            textStyle={styles.actionLabel}
          />
          <StudyButton
            label="Save Word"
            variant="primary"
            size="medium"
            onPress={handleSave}
            disabled={!canSave}
            style={styles.actionBtn}
            textStyle={styles.actionLabel}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },
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
    backgroundColor: 'rgba(94,81,164,0.15)',
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
  form: { paddingHorizontal: 16, paddingTop: 25, paddingBottom: 32, gap: 20 },
  field: { gap: 6, width: '100%' },
  label: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.8)',
  },
  inputRow: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fieldIcon: { width: 18, height: 18 },
  fieldUserIcon: { width: 19.5, height: 16.6 },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 8 },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
  },

  poolList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  poolRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  poolRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  poolRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIcon: { width: 13, height: 13 },
  poolName: {
    flex: 1,
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14.8,
    color: '#25262B',
  },
  poolCount: {
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 16,
    color: '#5E51A4',
  },
  poolHint: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.6)',
  },
  noPoolsBox: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#DAECDF',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 6,
  },
  noPoolsText: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0,0,0,0.6)',
  },

  saveRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    alignItems: 'stretch',
    width: '100%',
  },
  actionBtn: { flex: 1, height: 48, minWidth: 0, paddingVertical: 0, borderRadius: 12 },
  cancelBorder: { borderWidth: 1, borderColor: '#5E51A4' },
  actionLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
});
