/**
 * SCREEN — DIRECTION SELECT
 * Reached from Dashboard after tapping a study mode that already has a bank.
 * Reads studyTypeSelected from global state (set by dashboard before navigating here).
 * Lets the user pick a study direction, then starts the session.
 */
import React, { useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import type { StudyType, DirectionMode } from '@/src/types/state';
import type { Language } from '@/src/types/vocab';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const directionArrow = require('@/assets/images/study/direction-arrow.png');
const continueArrow = require('@/assets/images/study/continue-arrow.png');

const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};

function getDirectionOptions(langName: string): {
  id: DirectionMode;
  leading: string;
  trailing?: string;
  desc: string;
}[] {
  return [
    {
      id: 'target_to_native',
      leading: langName,
      trailing: 'English',
      desc: `See the ${langName} word, type English`,
    },
    {
      id: 'native_to_target',
      leading: 'English',
      trailing: langName,
      desc: `See English, type the ${langName} word`,
    },
    {
      id: 'mixed',
      leading: 'Mixed (Random)',
      desc: 'Both directions at random',
    },
  ];
}

const MODE_LABELS: Record<StudyType, string> = {
  general_vocab: 'General Vocabulary',
  gender: 'Gender',
};

export default function DirectionScreen() {
  const router = useRouter();
  const { state, setDirectionMode } = useAppContext();
  // Pool IDs and deck size are forwarded from select-study-list / deck-size to session.
  const { poolIds, deckSize } = useLocalSearchParams<{ poolIds?: string; deckSize?: string }>();

  // studyTypeSelected is set by the dashboard before navigating here.
  const studyType: StudyType = state.studyTypeSelected ?? 'general_vocab';
  const directionMode = state.directionMode;

  const langName = state.languageSelected
    ? (LANGUAGE_NAMES[state.languageSelected] ?? 'Target')
    : 'Target';
  const directionOptions = getDirectionOptions(langName);

  const handleStart = () => {
    router.replace({
      pathname: '/session',
      params: { poolIds: poolIds ?? '', deckSize: deckSize ?? '' },
    } as never);
  };

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
        <Text style={styles.screenTitle} pointerEvents="none">
          {MODE_LABELS[studyType]}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.directionBlock}>
          <View style={styles.titleBlock}>
            <Text style={styles.heading}>Study Direction</Text>
            <Text style={styles.subheading}>
              Choose how you want to see the cards
            </Text>
          </View>

          <View style={styles.options}>
            {directionOptions.map(opt => {
              const selected = directionMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.option, selected ? styles.optionOn : styles.optionOff]}
                  onPress={() => setDirectionMode(opt.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.optionText}>
                    <View style={styles.optionTitle}>
                      <Text style={styles.optionLabel}>{opt.leading}</Text>
                      {opt.trailing ? (
                        <>
                          <Image
                            source={directionArrow}
                            style={styles.directionArrow}
                            accessibilityIgnoresInvertColors
                          />
                          <Text style={styles.optionLabel}>{opt.trailing}</Text>
                        </>
                      ) : null}
                    </View>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[styles.radio, selected ? styles.radioOn : styles.radioOff]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleStart} activeOpacity={0.75}>
          <Text style={styles.primaryLabel}>Start Study</Text>
          <Image source={continueArrow} style={styles.primaryArrow} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

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

  content: {
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 32,
    gap: 80,
  },
  directionBlock: { gap: 18 },
  titleBlock: { gap: 4 },
  heading: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    color: '#25262B',
  },
  subheading: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  optionOn: { borderColor: '#5E51A4' },
  optionOff: { borderColor: '#DAECDF' },
  optionText: { flex: 1, gap: 6, marginRight: 12 },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 16,
    color: '#25262B',
  },
  directionArrow: { width: 16.5, height: 8.6 },
  optionDesc: {
    maxWidth: 183,
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(0,0,0,0.7)',
  },
  radio: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOn: { borderColor: '#5E51A4' },
  radioOff: { borderColor: 'rgba(0,0,0,0.2)' },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#5E51A4',
  },

  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#5E51A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  primaryLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  primaryArrow: { width: 12, height: 12 },
});
