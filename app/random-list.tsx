/**
 * SCREEN — RANDOM LIST
 * Two-step flow:
 *   Step 1 — Pick a word count (stepper, min 10, any integer)
 *   Step 2 — Name the list and confirm pool creation
 */
import React, { useState, useMemo, useCallback } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, ScrollView } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { getMasterDataset } from '@/src/data';
import type { Pool } from '@/src/types/pool';
import { generatePoolId, snapToDeckSize } from '@/src/types/pool';
import type { VocabItem } from '@/src/types/vocab';
import StudyButton from '@/src/components/ui/StudyButton';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const minusIcon = require('@/assets/images/lists/stepper-minus.png');
const plusIcon = require('@/assets/images/lists/stepper-plus.png');
const generateArrow = require('@/assets/images/lists/generate-arrow.png');

const MIN_WORDS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick `count` items randomly from `words` (no study-type filtering). */
function pickRandom(words: VocabItem[], count: number): VocabItem[] {
  const pool = [...words];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Find the next "List N" name that is one above the maximum N already used
 * across all existing pools for the language.
 */
function nextListName(existingPools: Pool[]): string {
  const nums = existingPools
    .map(p => {
      const m = p.name.match(/^List (\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `List ${max + 1}`;
}

/** Clamp a number to [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Step = 'count' | 'naming';

export default function RandomListScreen() {
  const router = useRouter();
  const { state, isReady, getLanguagePools, createPool } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const language = state.languageSelected;

  // Master dataset for the current language
  const masterWords = useMemo(
    () => (language ? getMasterDataset(language) : []),
    [language],
  );
  const maxWords = masterWords.length;

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [wordCount, setWordCount] = useState(Math.min(20, maxWords));
  // The raw string the user types into the count input — kept in sync with wordCount
  const [countInput, setCountInput] = useState(String(Math.min(20, maxWords)));

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('count');
  const [pickedWords, setPickedWords] = useState<VocabItem[]>([]);
  const [listName, setListName] = useState('');

  // ── Stepper helpers ───────────────────────────────────────────────────────

  const applyCount = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        const clamped = clamp(parsed, MIN_WORDS, maxWords);
        setWordCount(clamped);
        setCountInput(String(clamped));
      }
    },
    [maxWords],
  );

  const increment = useCallback(() => {
    const next = clamp(wordCount + 1, MIN_WORDS, maxWords);
    setWordCount(next);
    setCountInput(String(next));
  }, [wordCount, maxWords]);

  const decrement = useCallback(() => {
    const next = clamp(wordCount - 1, MIN_WORDS, maxWords);
    setWordCount(next);
    setCountInput(String(next));
  }, [wordCount, maxWords]);

  // ── Flow handlers ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (!language || !isReady) return;
    const words = pickRandom(masterWords, wordCount);
    const existingPools = getLanguagePools(language);
    setPickedWords(words);
    setListName(nextListName(existingPools));
    setStep('naming');
  }, [language, isReady, masterWords, wordCount, getLanguagePools]);

  const handleConfirm = useCallback(() => {
    if (!language || pickedWords.length === 0) return;

    const trimmed = listName.trim() || nextListName(getLanguagePools(language));
    const deckSize = snapToDeckSize(Math.min(pickedWords.length, 25));

    const pool: Pool = {
      id: generatePoolId(),
      name: trimmed,
      language,
      words: pickedWords.map(item => ({ item, frequency: 'normal' })),
      deckSize,
      createdVia: 'random',
      pausedWordIds: [],
    };

    createPool(pool);

    const { source } = getAddListLaunchSource();
    if (source === 'study_mode') {
      // Replace this screen with the list picker so the user can study the
      // newly created pool immediately (back button pops to add-list, but
      // select-study-list's own back button navigates straight to dashboard).
      router.replace('/select-study-list' as never);
    } else {
      // Normal path: pop this screen and add-list, landing on My Lists.
      router.dismiss(2);
    }
  }, [language, pickedWords, listName, getLanguagePools, createPool, router]);

  useAndroidBackHandler(
    useCallback(() => {
      if (step === 'naming') {
        setStep('count');
      } else {
        router.back();
      }
      return true;
    }, [step, router]),
  );

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!isReady || !language) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.flex}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={step === 'naming' ? () => setStep('count') : () => router.back()}
              hitSlop={8}
              accessibilityLabel="Back"
              style={[styles.backBtn, { backgroundColor: 'rgba(94,81,164,0.15)' }]}
            >
              <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
            </TouchableOpacity>
            <Text style={styles.screenTitle} pointerEvents="none">
              {step === 'count' ? 'Random List' : 'Name Your List'}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >

            {step === 'count' ? (
              /* ── Step 1: Word count ────────────────────────────────────── */
              <View style={styles.stepContainer}>
                <View style={styles.countBlock}>
                  <Text style={styles.stepHeading}>
                    How Many Words?
                  </Text>
                  <Text style={styles.stepSub}>
                    Minimum {MIN_WORDS} ({maxWords} available)
                  </Text>

                  <View style={[styles.stepper, { borderColor: palette.listCardBorder }]}>
                    <TouchableOpacity
                      onPress={decrement}
                      disabled={wordCount <= MIN_WORDS}
                      activeOpacity={0.6}
                      style={wordCount <= MIN_WORDS && styles.stepperBtnDisabled}
                    >
                      <Image source={minusIcon} style={styles.minusIcon} accessibilityIgnoresInvertColors />
                    </TouchableOpacity>
                    <View style={styles.stepperMid}>
                      <View style={styles.stepperRule} />
                      <TextInput
                        style={styles.stepperInput}
                        value={countInput}
                        onChangeText={setCountInput}
                        onBlur={() => applyCount(countInput)}
                        onSubmitEditing={() => applyCount(countInput)}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        selectTextOnFocus
                        textAlign="center"
                      />
                      <View style={styles.stepperRule} />
                    </View>
                    <TouchableOpacity
                      onPress={increment}
                      disabled={wordCount >= maxWords}
                      activeOpacity={0.6}
                      style={wordCount >= maxWords && styles.stepperBtnDisabled}
                    >
                      <Image source={plusIcon} style={styles.plusIcon} accessibilityIgnoresInvertColors />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.wordUnit}>
                    {wordCount === 1 ? 'word' : 'words'} selected at random from the full vocabulary list
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.generateBtn, wordCount < MIN_WORDS && styles.generateDisabled]}
                  onPress={handleGenerate}
                  disabled={wordCount < MIN_WORDS}
                  activeOpacity={0.8}
                >
                  <Text style={styles.generateLabel}>Generate</Text>
                  <Image source={generateArrow} style={styles.generateArrow} accessibilityIgnoresInvertColors />
                </TouchableOpacity>
              </View>

            ) : (
              /* ── Step 2: Naming ─────────────────────────────────────────── */
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: palette.text }]}>
                  Name Your List
                </Text>
                <Text style={[styles.stepSub, { color: palette.subtext }]}>
                  {pickedWords.length} randomly selected words
                </Text>

                <TextInput
                  style={styles.nameInput}
                  value={listName}
                  onChangeText={setListName}
                  placeholder="Enter list name"
                  placeholderTextColor={palette.subtext}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                  maxLength={60}
                  selectTextOnFocus
                />

                <View style={styles.summaryCard}>
                  <SummaryRow
                    label="Words"
                    value={String(pickedWords.length)}
                    palette={palette}
                    showDivider
                  />
                  <SummaryRow label="Created via" value="Random" palette={palette} />
                </View>

                <StudyButton
                  label="Confirm"
                  variant="primary"
                  size="large"
                  onPress={handleConfirm}
                  disabled={listName.trim().length === 0}
                  style={styles.confirmBtn}
                  textStyle={styles.confirmLabel}
                />
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

// ── Small sub-component ───────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  palette,
  showDivider = false,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
  showDivider?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryRow,
        showDivider && styles.summaryDivider,
      ]}
    >
      <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F7F5FD' },

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

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 35,
    paddingBottom: 40,
  },

  stepContainer: { gap: 40 },
  countBlock: { alignItems: 'center', gap: 18 },

  stepHeading: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
    color: '#25262B',
  },
  stepSub: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
    marginTop: -8,
  },

  stepper: {
    width: 243,
    height: 61,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stepperMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: '100%',
  },
  stepperRule: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(210,232,215,0.8)',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  minusIcon: { width: 18, height: 24 },
  plusIcon: { width: 24, height: 24 },
  stepperInput: {
    width: 48,
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 26,
    lineHeight: 31,
    color: '#25262B',
    textAlign: 'center',
    padding: 0,
  },

  wordUnit: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
  },

  generateBtn: {
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
  generateDisabled: { opacity: 0.4 },
  generateLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  generateArrow: { width: 12, height: 12 },

  nameInput: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  confirmLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  confirmBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    minWidth: 0,
    paddingVertical: 0,
  },

  summaryCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DAECDF',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(210,232,215,0.8)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: { fontSize: 14, fontFamily: HomeFonts.interRegular },
  summaryValue: { fontSize: 14, fontFamily: HomeFonts.interSemiBold },
});
