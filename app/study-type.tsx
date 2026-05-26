/**

 * SCREEN 0101.0 — STUDY TYPE SELECT

 * User chooses General Vocab or Gender, and picks a direction mode.

 */

import React, { useCallback, useState } from 'react';

import {

  View,

  Text,

  TouchableOpacity,

  StyleSheet,

  useColorScheme,

  Alert,

} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '@/constants/theme';

import { useAppContext } from '@/src/context/AppContext';

import type { StudyType, DirectionMode, WordFrequencySetting } from '@/src/types/state';

import type { VocabItem } from '@/src/types/vocab';

import StudyButton from '@/src/components/ui/StudyButton';

import GeneratedListModal, { type DraftWord } from '@/src/components/list-setup/GeneratedListModal';

import {

  buildFrequencySettings,

  extractNounsFromBank,

  pickReplacementWord,

} from '@/src/utils/vocabBank';



const LANGUAGE_LABELS: Record<string, string> = {

  de: 'German',

  fr: 'French',

  es: 'Spanish',

};



const LANGUAGE_FLAGS: Record<string, string> = {

  de: '🇩🇪',

  fr: '🇫🇷',

  es: '🇪🇸',

};



const DIRECTION_OPTIONS: { id: DirectionMode; label: string }[] = [

  { id: 'target_to_native', label: 'Target → Native only' },

  { id: 'native_to_target', label: 'Native → Target only' },

  { id: 'mixed', label: 'Mixed (random)' },

];



export default function StudyTypeScreen() {

  const router = useRouter();

  const {

    state,

    isReady,

    requestLanguageChange,

    selectStudyType,

    setDirectionMode,

    setVocabBank,

    hasModeBank,

    getModeBank,

  } = useAppContext();

  const scheme = useColorScheme() ?? 'light';

  const palette = Colors[scheme];



  const language = state.languageSelected;

  const directionMode = state.directionMode;



  const [selectedMode, setSelectedMode] = useState<StudyType>('general_vocab');

  const [reviewVisible, setReviewVisible] = useState(false);

  const [draftWords, setDraftWords] = useState<DraftWord[]>([]);



  useFocusEffect(

    useCallback(() => {

      if (!isReady) return;

      if (!language) {

        router.replace('/');

      }

    }, [isReady, language, router]),

  );



  if (!isReady || !language) return null;



  const openGenderAutoReview = () => {

    const generalBank = getModeBank('general_vocab');

    if (!generalBank) {

      router.push('/list-setup');

      return;

    }



    const nounBank = extractNounsFromBank(generalBank);

    if (nounBank.activeVocabBank.length === 0) {

      Alert.alert(

        'No nouns available',

        'Your General Vocab bank has no nouns to copy. Please set up your Gender bank manually.',

      );

      router.push('/list-setup');

      return;

    }



    setDraftWords(

      nounBank.activeVocabBank.map(item => ({

        item,

        frequency: nounBank.wordFrequencySettings[item.id] ?? 'normal',

      })),

    );

    setReviewVisible(true);

  };



  const handleModePress = (studyType: StudyType) => {

    setSelectedMode(studyType);

    selectStudyType(studyType);



    if (hasModeBank(studyType)) {

      router.push('/session');

      return;

    }



    if (studyType === 'gender' && hasModeBank('general_vocab')) {

      openGenderAutoReview();

      return;

    }



    router.push('/list-setup');

  };



  const handleVocabBankPress = () => {

    selectStudyType(selectedMode);



    if (hasModeBank(selectedMode)) {

      router.push('/vocab-bank');

      return;

    }



    router.push('/list-setup');

  };



  const handleRemoveDraftWord = (index: number): VocabItem | null => {

    const replacement = pickReplacementWord(

      language,

      new Set(draftWords.map(entry => entry.item.id)),

      'gender',

    );

    if (!replacement) {

      Alert.alert('No replacements', 'No other nouns are available from the master list.');

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



  const confirmGenderAutoPopulate = () => {

    const bank = draftWords.map(entry => entry.item);

    const frequencySettings = buildFrequencySettings(

      bank,

      Object.fromEntries(draftWords.map(entry => [entry.item.id, entry.frequency])),

    );

    setVocabBank(bank, frequencySettings);

    setReviewVisible(false);

    router.push('/session');

  };



  return (

    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>

      <View style={styles.container}>

        <View style={styles.langHeader}>

          <Text style={styles.flagSmall}>{LANGUAGE_FLAGS[language]}</Text>

          <Text style={[styles.langLabel, { color: palette.text }]}>

            {LANGUAGE_LABELS[language]}

          </Text>

        </View>



        <Text style={[styles.subtitle, { color: palette.subtext }]}>

          Choose what you want to study

        </Text>



        <View style={styles.primaryActions}>

          <StudyButton

            label="General Vocab"

            variant={selectedMode === 'general_vocab' ? 'primary' : 'secondary'}

            size="large"

            onPress={() => handleModePress('general_vocab')}

          />

          <StudyButton

            label="Gender"

            variant={selectedMode === 'gender' ? 'primary' : 'secondary'}

            size="large"

            onPress={() => handleModePress('gender')}

          />

        </View>



        <View style={[styles.directionBox, { backgroundColor: palette.card, borderColor: palette.border }]}>

          <Text style={[styles.directionLabel, { color: palette.subtext }]}>

            Study direction

          </Text>

          {DIRECTION_OPTIONS.map(opt => (

            <TouchableOpacity

              key={opt.id}

              style={styles.radioRow}

              onPress={() => setDirectionMode(opt.id)}

              activeOpacity={0.7}

            >

              <View style={[styles.radioOuter, { borderColor: palette.tint }]}>

                {directionMode === opt.id && (

                  <View style={[styles.radioInner, { backgroundColor: palette.tint }]} />

                )}

              </View>

              <Text style={[styles.radioText, { color: palette.text }]}>{opt.label}</Text>

            </TouchableOpacity>

          ))}

        </View>



        <StudyButton

          label="My Vocab Bank"

          variant="secondary"

          size="medium"

          onPress={handleVocabBankPress}

          style={styles.vocabBtn}

        />



        <StudyButton

          label="Change Language"

          variant="secondary"

          size="small"

          onPress={() => {

            requestLanguageChange();

            router.replace('/');

          }}

          style={styles.homeBtn}

        />

      </View>



      <GeneratedListModal

        visible={reviewVisible}

        words={draftWords}

        onRemove={handleRemoveDraftWord}

        onFrequencyChange={handleDraftFrequencyChange}

        onConfirm={confirmGenderAutoPopulate}

        onCancel={() => setReviewVisible(false)}

      />

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  safe: { flex: 1 },

  container: {

    flex: 1,

    alignItems: 'center',

    paddingHorizontal: 32,

    paddingTop: 32,

    paddingBottom: 32,

    gap: 20,

  },

  langHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    marginBottom: 4,

  },

  flagSmall: { fontSize: 28 },

  langLabel: { fontSize: 24, fontWeight: '700' },

  subtitle: { fontSize: 16, marginBottom: 8 },

  primaryActions: { width: '100%', gap: 14 },

  directionBox: {

    width: '100%',

    borderRadius: 14,

    borderWidth: 1,

    padding: 16,

    gap: 12,

    marginTop: 4,

  },

  directionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  radioOuter: {

    width: 20,

    height: 20,

    borderRadius: 10,

    borderWidth: 2,

    alignItems: 'center',

    justifyContent: 'center',

  },

  radioInner: { width: 10, height: 10, borderRadius: 5 },

  radioText: { fontSize: 15 },

  vocabBtn: { width: '100%' },

  homeBtn: { marginTop: 'auto' },

});

