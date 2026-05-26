/**
 * SCREEN 0005 — ADD CUSTOM WORD
 * Form to add a user-defined vocabulary word to the master dataset + active bank.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import { getMasterDataset } from '@/src/data';
import type { VocabItem, PartOfSpeech, Gender, Language } from '@/src/types/vocab';
import StudyButton from '@/src/components/ui/StudyButton';

const POS_OPTIONS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb'];
const GENDER_OPTIONS: Gender[] = ['masculine', 'feminine', 'neuter'];
const CATEGORIES = [
  'people', 'animals', 'food', 'home', 'travel', 'work', 'objects',
  'nature', 'time', 'body', 'general',
];

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
    // Reject entries that include articles
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

export default function AddWordScreen() {
  const router = useRouter();
  const { state, addWordToMaster } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected ?? 'de';
  const isGenderMode = state.studyTypeSelected === 'gender';
  const posOptions: PartOfSpeech[] = isGenderMode ? ['noun'] : POS_OPTIONS;

  const [lemma, setLemma] = useState('');
  const [english, setEnglish] = useState('');
  const [pos, setPos] = useState<PartOfSpeech | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [plural, setPlural] = useState('');
  const [category, setCategory] = useState('general');

  const showGender = pos === 'noun';
  const showPlural = pos === 'noun';

  const handleSave = () => {
    const error = validateEntry(lemma, english, pos, gender, language);
    if (error) {
      Alert.alert('Check your entry', error);
      return;
    }

    const normalizedLemma = lemma.trim();
    const duplicate = getMasterDataset(language).some(
      w => w.lemma.toLowerCase() === normalizedLemma.toLowerCase(),
    );
    if (duplicate) {
      Alert.alert('Word already exists', 'This word is already in your vocabulary list.');
      return;
    }

    const alreadyInBank = state.activeVocabBank.some(
      w => w.lemma.toLowerCase() === normalizedLemma.toLowerCase(),
    );
    if (alreadyInBank) {
      Alert.alert('Word already in bank', 'This word is already in your active vocabulary.');
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
      category,
      competencies: pos === 'noun' ? ['vocab', 'gender'] : ['vocab'],
      user_added: 'y',
    };

    addWordToMaster(item);
    router.back();
  };

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
        <Text style={[styles.screenTitle, { color: palette.text }]}>Add a word</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[styles.formTitle, { color: palette.text }]}>
          Add a word to your vocabulary
        </Text>

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
        <View style={[styles.pickerWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Picker
            selectedValue={pos ?? ''}
            onValueChange={value => {
              const selected = value as PartOfSpeech | '';
              if (selected === '') {
                setPos(null);
                setGender(null);
              } else {
                setPos(selected);
                if (selected !== 'noun') setGender(null);
              }
            }}
            style={[styles.picker, { color: palette.text }]}
            itemStyle={
              Platform.OS === 'ios'
                ? { color: palette.text, fontSize: 16, height: 72 }
                : undefined
            }
            dropdownIconColor={palette.text}
          >
            <Picker.Item label="Select part of speech…" value="" />
            {posOptions.map(option => (
              <Picker.Item key={option} label={option} value={option} />
            ))}
          </Picker>
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
                  style={[
                    styles.chip,
                    { borderColor: palette.border, backgroundColor: palette.card },
                    gender === g && { backgroundColor: palette.tint, borderColor: palette.tint },
                  ]}
                  onPress={() => setGender(g)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: palette.text },
                      gender === g && { color: '#fff' },
                    ]}
                  >
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

        {/* Category */}
        <Text style={labelStyle}>Category (optional)</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                { borderColor: palette.border, backgroundColor: palette.card },
                category === cat && { backgroundColor: palette.tint, borderColor: palette.tint },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: palette.text },
                  category === cat && { color: '#fff' },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.saveRow}>
          <StudyButton label="Save" variant="primary" size="large" onPress={handleSave} />
          <StudyButton
            label="Cancel"
            variant="secondary"
            size="medium"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  pickerWrap: {
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 72 : 50,
    marginTop: Platform.OS === 'ios' ? -8 : 0,
    marginBottom: Platform.OS === 'ios' ? -8 : 0,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14 },
  saveRow: { flexDirection: 'row', gap: 12, marginTop: 28, alignItems: 'center' },
});
