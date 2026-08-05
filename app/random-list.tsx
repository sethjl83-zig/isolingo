/**
 * SCREEN — RANDOM LIST
 * Two-step flow:
 *   Step 1 — Pick a word count (stepper, min 10, any integer)
 *   Step 2 — Name the list and confirm pool creation
 */
import React, { useState, useMemo, useCallback } from 'react';
import { getAddListLaunchSource } from './add-list';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { getMasterDataset } from '@/src/data';
import type { Pool } from '@/src/types/pool';
import { generatePoolId, snapToDeckSize } from '@/src/types/pool';
import type { VocabItem } from '@/src/types/vocab';
import StudyButton from '@/src/components/ui/StudyButton';

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
          <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
            <TouchableOpacity
              onPress={step === 'naming' ? () => setStep('count') : () => router.back()}
              hitSlop={8}
            >
              <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.screenTitle, { color: palette.text }]}>
              {step === 'count' ? 'Random List' : 'Name Your List'}
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >

            {step === 'count' ? (
              /* ── Step 1: Word count ────────────────────────────────────── */
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: palette.text }]}>
                  How many words?
                </Text>
                <Text style={[styles.stepSub, { color: palette.subtext }]}>
                  Minimum {MIN_WORDS} · {maxWords} available
                </Text>

                {/* Stepper */}
                <View style={[styles.stepper, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      { borderRightColor: palette.border },
                      wordCount <= MIN_WORDS && styles.stepperBtnDisabled,
                    ]}
                    onPress={decrement}
                    disabled={wordCount <= MIN_WORDS}
                    activeOpacity={0.6}
                  >
                    <Text style={[
                      styles.stepperBtnLabel,
                      { color: wordCount <= MIN_WORDS ? palette.subtext : palette.tint },
                    ]}>
                      −
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.stepperInput, { color: palette.text }]}
                    value={countInput}
                    onChangeText={setCountInput}
                    onBlur={() => applyCount(countInput)}
                    onSubmitEditing={() => applyCount(countInput)}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    textAlign="center"
                  />

                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      { borderLeftColor: palette.border },
                      wordCount >= maxWords && styles.stepperBtnDisabled,
                    ]}
                    onPress={increment}
                    disabled={wordCount >= maxWords}
                    activeOpacity={0.6}
                  >
                    <Text style={[
                      styles.stepperBtnLabel,
                      { color: wordCount >= maxWords ? palette.subtext : palette.tint },
                    ]}>
                      +
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.wordUnit, { color: palette.subtext }]}>
                  {wordCount === 1 ? 'word' : 'words'} selected at random from the full vocabulary list
                </Text>

                <StudyButton
                  label="Generate"
                  variant="primary"
                  size="large"
                  onPress={handleGenerate}
                  disabled={wordCount < MIN_WORDS}
                  style={styles.actionBtn}
                />
              </View>

            ) : (
              /* ── Step 2: Naming ─────────────────────────────────────────── */
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: palette.text }]}>
                  Name your list
                </Text>
                <Text style={[styles.stepSub, { color: palette.subtext }]}>
                  {pickedWords.length} randomly selected words
                </Text>

                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
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

                <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <SummaryRow label="Words" value={String(pickedWords.length)} palette={palette} />
                  <SummaryRow label="Created via" value="Random" palette={palette} />
                </View>

                <StudyButton
                  label="Confirm"
                  variant="primary"
                  size="large"
                  onPress={handleConfirm}
                  disabled={listName.trim().length === 0}
                  style={styles.actionBtn}
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
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

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

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },

  stepContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
  },

  stepHeading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepSub: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    width: 220,
    height: 60,
  },
  stepperBtn: {
    width: 56,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRightWidth: 1,
    borderLeftWidth: 1,
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnLabel: { fontSize: 28, lineHeight: 32, fontWeight: '300' },
  stepperInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    height: '100%',
  },

  wordUnit: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -6,
    paddingHorizontal: 32,
  },

  actionBtn: {
    width: '100%',
    marginTop: 12,
  },

  // Naming
  nameInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 18,
    fontWeight: '600',
  },

  summaryCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
});
