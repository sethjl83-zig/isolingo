/**

 * SCREEN 5001 — VOCAB BANK MANAGER

 * View and adjust per-word study frequency for the active mode's vocab bank.

 * Changes persist immediately to AsyncStorage.

 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';

import {

  View,

  Text,

  FlatList,

  TouchableOpacity,

  StyleSheet,

  useColorScheme,

} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { Colors, GenderColors } from '@/constants/theme';

import { useAppContext } from '@/src/context/AppContext';

import type { VocabItem } from '@/src/types/vocab';

import type { StudyType, WordFrequencySetting } from '@/src/types/state';

import { normalizeFrequencySetting } from '@/src/types/state';

import { filterVocabBySearch, getWordLemmaColor } from '@/src/utils/vocabBank';

import StudyButton from '@/src/components/ui/StudyButton';

import SearchBar from '@/src/components/ui/SearchBar';

import FrequencySnapSlider from '@/src/components/ui/FrequencySnapSlider';



const MODE_LABELS: Record<StudyType, string> = {

  general_vocab: 'General Vocab',

  gender: 'Gender',

};



export default function VocabBankScreen() {

  const router = useRouter();

  const { state, setWordFrequency } = useAppContext();

  const scheme = useColorScheme() ?? 'light';

  const palette = Colors[scheme];



  const [searchQuery, setSearchQuery] = useState('');

  const studyType = state.studyTypeSelected;



  useEffect(() => {

    if (!state.languageSelected) {

      router.replace('/');

      return;

    }

    if (!studyType) {

      router.replace('/dashboard');

    }

  }, [state.languageSelected, studyType, router]);



  const sortedBank = useMemo(

    () =>

      [...state.activeVocabBank].sort((a, b) =>

        a.lemma.localeCompare(b.lemma, undefined, { sensitivity: 'base' }),

      ),

    [state.activeVocabBank],

  );



  const filteredBank = useMemo(

    () => filterVocabBySearch(sortedBank, searchQuery),

    [sortedBank, searchQuery],

  );



  const wordCount = state.activeVocabBank.length;



  const handleFrequencyChange = useCallback(

    (id: string, frequency: WordFrequencySetting) => {

      setWordFrequency(id, frequency);

    },

    [setWordFrequency],

  );



  const renderItem = ({ item }: { item: VocabItem }) => {

    const lemmaColor = getWordLemmaColor(item, palette.text, GenderColors);

    const frequency = normalizeFrequencySetting(state.wordFrequencySettings[item.id]);



    return (

      <View style={[styles.row, { borderBottomColor: palette.border }]}>

        <View style={styles.rowLeft}>

          <Text style={[styles.lemma, { color: lemmaColor }]}>{item.lemma}</Text>

          <Text style={[styles.english, { color: palette.subtext }]}>{item.english}</Text>

          {item.user_added === 'y' && (

            <Text style={[styles.customTag, { color: palette.tint }]}>Custom</Text>

          )}

        </View>

        <FrequencySnapSlider

          value={frequency}

          onChange={freq => handleFrequencyChange(item.id, freq)}

          compact

        />

      </View>

    );

  };



  if (!studyType) return null;



  return (

    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>

      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>

        <TouchableOpacity onPress={() => router.back()}>

          <Text style={[styles.topBarBtn, { color: palette.tint }]}>Back</Text>

        </TouchableOpacity>

        <Text style={[styles.topBarTitle, { color: palette.text }]}>My Vocab Bank</Text>

        <View style={styles.topBarSpacer} />

      </View>



      <View style={styles.header}>

        <Text style={[styles.counter, { color: palette.tint }]}>

          {MODE_LABELS[studyType]} · {wordCount} {wordCount === 1 ? 'word' : 'words'}

        </Text>

        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      </View>



      <View style={[styles.columnHeader, { borderBottomColor: palette.border, backgroundColor: palette.background }]}>

        <Text style={[styles.columnTitle, { color: palette.subtext }]}>Word</Text>

        <Text style={[styles.columnTitle, styles.columnRight, { color: palette.subtext }]}>Frequency</Text>

      </View>



      <FlatList

        data={filteredBank}

        keyExtractor={item => item.id}

        renderItem={renderItem}

        style={styles.list}

        keyboardShouldPersistTaps="handled"

        keyboardDismissMode="on-drag"

        ListEmptyComponent={

          <Text style={[styles.emptyText, { color: palette.subtext }]}>

            {searchQuery ? 'No words match your search.' : 'No words in your vocabulary yet.'}

          </Text>

        }

      />



      <View style={[styles.bottomBar, { borderTopColor: palette.border }]}>

        <StudyButton

          label="Add Word"

          variant="secondary"

          size="medium"

          onPress={() => router.push('/add-word')}

          style={styles.actionBtn}

        />

      </View>

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

  topBarTitle: { fontSize: 17, fontWeight: '600' },

  topBarSpacer: { minWidth: 60 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },

  counter: { fontSize: 16, fontWeight: '600' },

  columnHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 20,

    paddingVertical: 10,

    borderBottomWidth: 1,

  },

  columnTitle: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },

  columnRight: { textAlign: 'right', flex: 0, width: 120 },

  list: { flex: 1 },

  emptyText: { textAlign: 'center', fontSize: 15, marginTop: 32, paddingHorizontal: 20 },

  row: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingVertical: 14,

    paddingHorizontal: 20,

    borderBottomWidth: StyleSheet.hairlineWidth,

    gap: 12,

  },

  rowLeft: { flex: 1, gap: 2 },

  lemma: { fontSize: 17, fontWeight: '700' },

  english: { fontSize: 14 },

  customTag: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  bottomBar: {

    flexDirection: 'row',

    justifyContent: 'center',

    paddingHorizontal: 20,

    paddingVertical: 16,

    borderTopWidth: 1,

  },

  actionBtn: { width: 140 },

});


