/**
 * SCREEN — NEW WORD
 * Form to create a user-defined vocabulary word and add it directly into one
 * or more of the user's existing pools.
 *
 * IMPORTANT: this screen does NOT touch the master vocab dataset. The new word
 * lives only in the pool(s) the user selects and will never appear in Curated
 * Lists, Build Your Own, or Random.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { VocabItem, PartOfSpeech, Gender, Language } from '@/src/types/vocab';
import type { Pool } from '@/src/types/pool';
import StudyButton from '@/src/components/ui/StudyButton';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const POS_OPTIONS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb'];
const GENDER_OPTIONS: Gender[] = ['masculine', 'feminine', 'neuter'];
const CATEGORIES = [
  'people', 'animals', 'food', 'home', 'travel', 'work', 'objects',
  'nature', 'time', 'body', 'general',
];

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
}: {
  pool: Pool;
  checked: boolean;
  onToggle: () => void;
  palette: (typeof Colors)['light'];
}) {
  return (
    <TouchableOpacity
      style={[
        styles.poolRow,
        {
          backgroundColor: checked ? palette.feedback : palette.card,
          borderColor: checked ? palette.tint : palette.border,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: palette.tint,
            backgroundColor: checked ? palette.tint : 'transparent',
          },
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.poolInfo}>
        <Text style={[styles.poolName, { color: palette.text }]} numberOfLines={1}>
          {pool.name}
        </Text>
        <Text style={[styles.poolCount, { color: palette.subtext }]}>
          {pool.words.length} {pool.words.length === 1 ? 'word' : 'words'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddWordScreen() {
  const router = useRouter();
  const { state, updatePool, getLanguagePools } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected ?? 'de';
  const isGenderMode = state.studyTypeSelected === 'gender';
  const posOptions: PartOfSpeech[] = isGenderMode ? ['noun'] : POS_OPTIONS;

  const allPools = useMemo(
    () => getLanguagePools(language),
    [language, getLanguagePools],
  );
  const hasPools = allPools.length > 0;

  // ── Form state ────────────────────────────────────────────────────────────
  const [lemma, setLemma] = useState('');
  const [english, setEnglish] = useState('');
  const [pos, setPos] = useState<PartOfSpeech | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [plural, setPlural] = useState('');
  const [categories, setCategories] = useState<string[]>(['general']);
  const [selectedPoolIds, setSelectedPoolIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isGenderMode) {
      setPos('noun');
    }
  }, [isGenderMode]);

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
  const canSave = hasPools && selectedPoolIds.size > 0;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!hasPools) return; // button is disabled anyway

    if (selectedPoolIds.size === 0) {
      Alert.alert('No list selected', 'Please choose at least one list to add this word to.');
      return;
    }

    const error = validateEntry(lemma, english, pos, gender, language);
    if (error) {
      Alert.alert('Check your entry', error);
      return;
    }

    const normalizedLemma = lemma.trim().toLowerCase();

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

  const inputStyle = [
    styles.input,
    { backgroundColor: palette.card, borderColor: palette.border, color: palette.text },
  ];
  const labelStyle = [styles.label, { color: palette.subtext }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.topBarBtn, { color: palette.tint }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>New Word</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[styles.formTitle, { color: palette.text }]}>New Word</Text>

        {/* Target language word */}
        <Text style={labelStyle}>
          {language === 'de' ? 'German' : language === 'fr' ? 'French' : 'Spanish'} word (bare form)
        </Text>
        <TextInput
          style={inputStyle}
          value={lemma}
          onChangeText={setLemma}
          placeholder={
            language === 'de' ? 'e.g. Hund' : language === 'fr' ? 'e.g. chien' : 'e.g. perro'
          }
          placeholderTextColor={palette.subtext}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {/* English translation */}
        <Text style={labelStyle}>English translation</Text>
        <TextInput
          style={inputStyle}
          value={english}
          onChangeText={setEnglish}
          placeholder="e.g. dog (separate multiple with commas)"
          placeholderTextColor={palette.subtext}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Part of speech */}
        <Text style={labelStyle}>Part of speech</Text>
        <View style={styles.chipRow}>
          {posOptions.map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, pillSurface(pos === option, palette)]}
              onPress={() => {
                setPos(option);
                if (option !== 'noun') setGender(null);
              }}
            >
              <Text style={[styles.chipText, pillLabel(pos === option, palette)]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gender (nouns only) */}
        {showGender && (
          <>
            <Text style={labelStyle}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.filter(g =>
                language === 'de' ? true : g !== 'neuter',
              ).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, pillSurface(gender === g, palette)]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, pillLabel(gender === g, palette)]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Plural (nouns only) */}
        {showPlural && (
          <>
            <Text style={labelStyle}>Plural form (optional)</Text>
            <TextInput
              style={inputStyle}
              value={plural}
              onChangeText={setPlural}
              placeholder="Plural form"
              placeholderTextColor={palette.subtext}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </>
        )}

        {/* Category chips */}
        <Text style={labelStyle}>Categories (Optional — select all that apply)</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(cat => {
            const active = categories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, pillSurface(active, palette)]}
                onPress={() => toggleCategory(cat)}
              >
                <Text style={[styles.chipText, pillLabel(active, palette)]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Pool selection ───────────────────────────────────────────────── */}
        <Text style={[styles.label, styles.poolSectionLabel, { color: palette.subtext }]}>
          Add to which list(s)?
        </Text>

        {hasPools ? (
          <View style={styles.poolList}>
            {allPools.map(pool => (
              <PoolCheckRow
                key={pool.id}
                pool={pool}
                checked={selectedPoolIds.has(pool.id)}
                onToggle={() => togglePool(pool.id)}
                palette={palette}
              />
            ))}
            {selectedPoolIds.size === 0 && (
              <Text style={[styles.poolHint, { color: palette.subtext }]}>
                Select at least one list.
              </Text>
            )}
          </View>
        ) : (
          <View style={[styles.noPoolsBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.noPoolsText, { color: palette.subtext }]}>
              You need at least one list before adding a new word. Create one in My Vocabulary first.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.saveRow}>
          <StudyButton
            label="Save"
            variant="primary"
            size="medium"
            onPress={handleSave}
            disabled={!canSave}
            style={styles.actionBtn}
          />
          <StudyButton
            label="Cancel"
            variant="secondary"
            size="medium"
            onPress={() => router.back()}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
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
  topBarBtn: { fontSize: 15, fontWeight: '500', minWidth: 60 },
  topBarSpacer: { minWidth: 60 },
  screenTitle: { fontSize: 17, fontWeight: '600' },
  form: { paddingHorizontal: 20, paddingVertical: 20, gap: 8 },
  formTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14 },

  // Pool selection
  poolSectionLabel: { marginTop: 20 },
  poolList: { gap: 8, marginTop: 6 },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
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
  poolInfo: { flex: 1, gap: 2 },
  poolName: { fontSize: 15, fontWeight: '600' },
  poolCount: { fontSize: 12 },
  poolHint: { fontSize: 13, marginTop: 4 },
  noPoolsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 6,
  },
  noPoolsText: { fontSize: 14, lineHeight: 21 },

  saveRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
  },
  actionBtn: { flex: 1, minWidth: 0 },
});
