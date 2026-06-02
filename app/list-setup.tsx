/**
 * SCREEN — LIST SETUP
 * New users choose a system-generated list or pick their own words (10–25).
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, GenderColors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import { getMasterDataset } from '@/src/data';
import {
  filterVocabBySearch,
  filterForStudyType,
  pickRandomWords,
  pickReplacementWord,
  getUniqueCategories,
  getWordLemmaColor,
  buildFrequencySettings,
} from '@/src/utils/vocabBank';
import { MIN_BANK_SIZE, MAX_BANK_SIZE, type WordFrequencySetting, type StudyType } from '@/src/types/state';
import type { VocabItem } from '@/src/types/vocab';
import StudyButton from '@/src/components/ui/StudyButton';
import SearchBar from '@/src/components/ui/SearchBar';
import GeneratedListModal, { type DraftWord } from '@/src/components/list-setup/GeneratedListModal';

type SetupMode = 'choice' | 'random' | 'custom';

const LANGUAGE_LABELS: Record<string, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocab',
  gender: 'Gender',
};

const COUNT_OPTIONS = [10, 15, 20, 25];

export default function ListSetupScreen() {
  const router = useRouter();
  const { state, setVocabBank } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;
  const studyType = state.studyTypeSelected;

  const masterList = useMemo(() => {
    if (!language || !studyType) return [];
    return filterForStudyType(getMasterDataset(language), studyType);
  }, [language, studyType]);

  const categories = useMemo(() => getUniqueCategories(masterList), [masterList]);

  const [mode, setMode] = useState<SetupMode>('choice');
  const [wordCount, setWordCount] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewVisible, setReviewVisible] = useState(false);
  const [draftWords, setDraftWords] = useState<DraftWord[]>([]);

  useEffect(() => {
    if (!language) {
      router.replace('/');
      return;
    }
    if (!studyType) {
      router.replace('/dashboard');
    }
  }, [language, studyType, router]);

  if (!language || !studyType) return null;

  const categoryFiltered = selectedCategory
    ? masterList.filter(w => w.category === selectedCategory)
    : masterList;
  const filteredMaster = filterVocabBySearch(categoryFiltered, searchQuery);
  const selectedCount = selectedIds.size;

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_BANK_SIZE) {
        next.add(id);
      } else {
        Alert.alert('Maximum reached', `You can select up to ${MAX_BANK_SIZE} words.`);
      }
      return next;
    });
  };

  const openGeneratedReview = (bank: VocabItem[]) => {
    setDraftWords(
      bank.map(item => ({
        item,
        frequency: 'normal' as WordFrequencySetting,
      })),
    );
    setReviewVisible(true);
  };

  const handleGenerateRandom = () => {
    if (masterList.length < wordCount) {
      Alert.alert('Not enough words', 'The master list does not have enough words.');
      return;
    }
    openGeneratedReview(pickRandomWords(language, wordCount, studyType));
  };

  const handleRemoveDraftWord = (index: number): VocabItem | null => {
    const excludeIds = new Set(draftWords.map(entry => entry.item.id));
    const replacement = pickReplacementWord(language, excludeIds, studyType);
    if (!replacement) {
      Alert.alert('No replacements', 'No other words are available from the master list.');
      return null;
    }
    setDraftWords(prev => {
      const next = [...prev];
      next[index] = { item: replacement, frequency: 'normal' };
      return next;
    });
    return replacement;
  };

  const handleDraftFrequencyChange = (index: number, frequency: WordFrequencySetting) => {
    setDraftWords(prev => {
      const next = [...prev];
      next[index] = { ...next[index], frequency };
      return next;
    });
  };

  const confirmDraftList = () => {
    const bank = draftWords.map(entry => entry.item);
    const frequencySettings = buildFrequencySettings(
      bank,
      Object.fromEntries(draftWords.map(entry => [entry.item.id, entry.frequency])),
    );
    // Pass studyType explicitly so SET_VOCAB_BANK can write to modeBanks[studyType]
    // without relying on state.studyTypeSelected being committed in the reducer.
    setVocabBank(bank, frequencySettings, studyType ?? undefined);
    setReviewVisible(false);
    router.replace('/dashboard');
  };

  const handleSaveCustom = () => {
    if (selectedCount < MIN_BANK_SIZE) {
      Alert.alert(
        'Select more words',
        `Please select at least ${MIN_BANK_SIZE} words (currently ${selectedCount}).`,
      );
      return;
    }
    const bank = masterList.filter(w => selectedIds.has(w.id));
    // Pass studyType explicitly — same reason as above.
    setVocabBank(bank, undefined, studyType ?? undefined);
    router.replace('/dashboard');
  };

  const goBackToModeSelect = () => {
    router.replace('/dashboard');
  };

  const renderCustomItem = ({ item }: { item: VocabItem }) => {
    const isSelected = selectedIds.has(item.id);
    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    return (
      <TouchableOpacity
        style={[
          styles.wordRow,
          { borderBottomColor: palette.border, backgroundColor: isSelected ? palette.feedback : palette.background },
        ]}
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.checkbox, { borderColor: palette.tint }, isSelected && { backgroundColor: palette.tint }]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.wordInfo}>
          <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>
          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (mode === 'choice') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: palette.text }]}>Set up your word list</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {LANGUAGE_LABELS[language]} · {MODE_LABELS[studyType]}
            {studyType === 'gender' ? ' · nouns only' : ''}
          </Text>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => setMode('random')}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionTitle, { color: palette.text }]}>System-generated list</Text>
            <Text style={[styles.optionDesc, { color: palette.subtext }]}>
              Pick a list size and we'll randomly select words from the master vocabulary.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => setMode('custom')}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionTitle, { color: palette.text }]}>Choose your own</Text>
            <Text style={[styles.optionDesc, { color: palette.subtext }]}>
              Browse the full master list and select {MIN_BANK_SIZE}–{MAX_BANK_SIZE} words yourself.
            </Text>
          </TouchableOpacity>

          <StudyButton
            label="Back"
            variant="secondary"
            size="small"
            onPress={goBackToModeSelect}
            style={styles.backBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'random') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: palette.text }]}>System-generated list</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            How many words would you like to study?
          </Text>

          <View style={[styles.pickerWrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Picker
              selectedValue={wordCount}
              onValueChange={v => setWordCount(Number(v))}
              style={[styles.picker, { color: palette.text }]}
              itemStyle={Platform.OS === 'ios' ? { color: palette.text } : undefined}
            >
              {COUNT_OPTIONS.map(n => (
                <Picker.Item key={n} label={`${n} words`} value={n} />
              ))}
            </Picker>
          </View>

          <StudyButton label="Generate List" variant="primary" size="large" onPress={handleGenerateRandom} />
          <StudyButton label="Back" variant="secondary" size="medium" onPress={() => setMode('choice')} />
        </View>

        <GeneratedListModal
          visible={reviewVisible}
          words={draftWords}
          onRemove={handleRemoveDraftWord}
          onFrequencyChange={handleDraftFrequencyChange}
          onConfirm={confirmDraftList}
          onCancel={() => setReviewVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>
          <View style={styles.customHeader}>
            <Text style={[styles.title, { color: palette.text }]}>Choose your words</Text>
            <Text style={[styles.counter, { color: palette.tint }]}>
              {MODE_LABELS[studyType]}
              {studyType === 'gender' ? ' · nouns only · ' : ' · '}
              {selectedCount} / {MAX_BANK_SIZE} selected
              {selectedCount < MIN_BANK_SIZE ? ` (min ${MIN_BANK_SIZE})` : ''}
            </Text>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryRow}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { borderColor: palette.border, backgroundColor: palette.card },
                selectedCategory === null && { backgroundColor: palette.tint, borderColor: palette.tint },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, { color: selectedCategory === null ? '#fff' : palette.text }]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  { borderColor: palette.border, backgroundColor: palette.card },
                  selectedCategory === cat && { backgroundColor: palette.tint, borderColor: palette.tint },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, { color: selectedCategory === cat ? '#fff' : palette.text }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredMaster}
            keyExtractor={item => item.id}
            renderItem={renderCustomItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
          />

          <View style={[styles.bottomBar, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
            <StudyButton label="Save" variant="primary" size="medium" onPress={handleSaveCustom} style={styles.bottomBtn} />
            <StudyButton label="Back" variant="secondary" size="medium" onPress={() => setMode('choice')} style={styles.bottomBtn} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, marginBottom: 8 },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  optionTitle: { fontSize: 18, fontWeight: '700' },
  optionDesc: { fontSize: 14, lineHeight: 20 },
  backBtn: { marginTop: 'auto', alignSelf: 'center' },
  pickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
  },
  picker: { height: Platform.OS === 'ios' ? 180 : 50 },
  customHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },
  counter: { fontSize: 15, fontWeight: '600' },
  categoryScroll: { maxHeight: 48, marginBottom: 4 },
  categoryRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  categoryChipText: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  list: { flex: 1 },
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
  lemma: { fontSize: 16, fontWeight: '600' },
  english: { fontSize: 13 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  bottomBtn: { width: 140 },
});
