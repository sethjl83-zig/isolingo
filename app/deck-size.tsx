/**
 * SCREEN — DECK SIZE
 * Inserted between select-study-list and direction.tsx.
 * Uses @react-native-picker/picker (already in the project) for a native
 * wheel-style scroll picker — matches the look used in list-setup.tsx.
 *
 * Only deck sizes that fit within the combined pool word count appear as
 * selectable items; sizes that would exceed it are omitted entirely.
 *
 * On confirm, saves the choice as the remembered preference for this exact
 * pool combination, then proceeds to the direction-select screen.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import type { PoolDeckSize } from '@/src/types/pool';
import { getDeckSizePref, saveDeckSizePref } from '@/src/storage/deckSizePrefs';
import { parsePoolIdsParam } from '@/src/utils/studyLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { useAppContext } from '@/src/context/AppContext';
import StudyButton from '@/src/components/ui/StudyButton';
import ErrorBoundary from '@/src/components/ErrorBoundary';

const ALL_SIZES: PoolDeckSize[] = [10, 15, 20, 25];

function parseTotalCountParam(
  totalCountParam: string | string[] | undefined,
): number {
  const raw = Array.isArray(totalCountParam) ? totalCountParam[0] : totalCountParam;
  if (raw == null || raw.trim() === '') return 0;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function computeValidSizes(totalCount: number): PoolDeckSize[] {
  if (!Number.isFinite(totalCount) || totalCount <= 0) return [];
  return ALL_SIZES.filter(size => size <= totalCount);
}

function DeckSizeMessageScreen({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Deck size</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.heading, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{message}</Text>
      </View>

      <View
        style={[
          styles.footer,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        <StudyButton label="Go back" variant="primary" size="large" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

function DeckSizeContent() {
  const router = useRouter();
  const { state } = useAppContext();
  const { poolIds: poolIdsParam, totalCount: totalCountParam } =
    useLocalSearchParams<{ poolIds?: string | string[]; totalCount?: string | string[] }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const poolIds = useMemo(() => parsePoolIdsParam(poolIdsParam), [poolIdsParam]);
  const totalCount = useMemo(
    () => parseTotalCountParam(totalCountParam),
    [totalCountParam],
  );
  const validSizes = useMemo(() => computeValidSizes(totalCount), [totalCount]);

  const language = state.languageSelected;
  const studyType = state.studyTypeSelected ?? 'general_vocab';

  const [selected, setSelected] = useState<PoolDeckSize | null>(null);
  const [loadingPref, setLoadingPref] = useState(true);
  const [prefLoadFailed, setPrefLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const noValidSizes = validSizes.length === 0;
  const hasInvalidPoolIds = poolIds.length === 0;
  const hasInvalidSetup = !language || hasInvalidPoolIds;

  const pickerReady =
    !loadingPref &&
    !hasInvalidSetup &&
    !noValidSizes &&
    selected !== null &&
    validSizes.includes(selected);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPref() {
      if (hasInvalidSetup) {
        setSelected(null);
        setLoadingPref(false);
        return;
      }

      if (noValidSizes) {
        setSelected(null);
        setLoadingPref(false);
        return;
      }

      setLoadingPref(true);
      setPrefLoadFailed(false);

      try {
        const saved = await getDeckSizePref(language, studyType, poolIds);
        if (cancelled) return;

        if (saved !== null && validSizes.includes(saved)) {
          setSelected(saved);
        } else {
          setSelected(validSizes[validSizes.length - 1] ?? null);
        }
      } catch (err) {
        console.warn('[DeckSizeScreen] getDeckSizePref failed', err);
        if (!cancelled) {
          setPrefLoadFailed(true);
          setSelected(validSizes[validSizes.length - 1] ?? null);
        }
      } finally {
        if (!cancelled) setLoadingPref(false);
      }
    }

    loadSavedPref();

    return () => {
      cancelled = true;
    };
  }, [language, studyType, poolIds, validSizes, hasInvalidSetup, noValidSizes]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useAndroidBackHandler(
    useCallback(() => {
      handleBack();
      return true;
    }, [handleBack]),
  );

  const handleContinue = useCallback(async () => {
    if (!selected || saving || !language || poolIds.length === 0 || !pickerReady) return;

    setSaving(true);
    setSaveError(null);

    try {
      await saveDeckSizePref(language, studyType, poolIds, selected);
    } catch (err) {
      console.warn('[DeckSizeScreen] saveDeckSizePref failed', err);
      setSaveError('Your deck size could not be saved, but you can still continue.');
    } finally {
      setSaving(false);
    }

    router.push({
      pathname: '/direction',
      params: {
        poolIds: JSON.stringify(poolIds),
        deckSize: String(selected),
      },
    } as never);
  }, [selected, saving, language, studyType, poolIds, pickerReady, router]);

  if (hasInvalidSetup) {
    return (
      <DeckSizeMessageScreen
        title="Unable to load deck size"
        message={
          !language
            ? 'No language is selected. Go back and choose a language on the dashboard.'
            : 'We could not read your selected study lists. Go back, choose your lists again, and try continuing.'
        }
        onBack={handleBack}
      />
    );
  }

  if (loadingPref) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
          <TouchableOpacity onPress={handleBack} hitSlop={8}>
            <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Deck size</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>
            Loading deck size options…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (noValidSizes) {
    return (
      <DeckSizeMessageScreen
        title="Not enough words"
        message={
          totalCount <= 0
            ? 'We could not determine how many words are available in your selected lists. Go back and try again.'
            : 'Your selected lists do not have enough words for a session (minimum 10). Go back and add more words or choose different lists.'
        }
        onBack={handleBack}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Deck size</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.heading, { color: palette.text }]}>Select deck size</Text>
        <Text style={[styles.subheading, { color: palette.subtext }]}>
          {totalCount} {totalCount === 1 ? 'word' : 'words'} available across your selected{' '}
          {poolIds.length === 1 ? 'list' : 'lists'}
        </Text>

        {prefLoadFailed ? (
          <Text style={[styles.warningText, { color: palette.subtext }]}>
            Your saved deck size could not be loaded. Showing the default size instead.
          </Text>
        ) : null}

        {saveError ? (
          <Text style={[styles.warningText, { color: palette.subtext }]}>{saveError}</Text>
        ) : null}

        {pickerReady ? (
          <>
            <View
              style={[
                styles.pickerWrap,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Picker
                selectedValue={selected}
                onValueChange={value => {
                  if (typeof value === 'number' && validSizes.includes(value as PoolDeckSize)) {
                    setSelected(value as PoolDeckSize);
                  }
                }}
                style={[styles.picker, { color: palette.text }]}
                itemStyle={Platform.OS === 'ios' ? { color: palette.text } : undefined}
              >
                {validSizes.map(size => (
                  <Picker.Item key={size} label={`${size} words`} value={size} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.note, { color: palette.subtext }]}>
              Your deck is a randomly drawn selection from your lists — words with higher
              frequency settings are more likely to be included.
            </Text>
          </>
        ) : (
          <Text style={[styles.errorText, { color: palette.subtext }]}>
            Deck size options are unavailable right now. Go back and try again.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.footer,
          { borderTopColor: palette.border, backgroundColor: palette.background },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={palette.tint} />
        ) : (
          <StudyButton
            label="Continue"
            variant="primary"
            size="large"
            onPress={handleContinue}
            disabled={!pickerReady}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function DeckSizeScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      title="Deck size unavailable"
      onExit={() => router.back()}
      exitLabel="Go back"
    >
      <DeckSizeContent />
    </ErrorBoundary>
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
  backBtn: { fontSize: 15, fontWeight: '500', minWidth: 60 },
  screenTitle: { fontSize: 17, fontWeight: '700' },
  topBarSpacer: { minWidth: 60 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    alignItems: 'center',
    gap: 20,
  },

  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 15, textAlign: 'center' },

  heading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: -8,
  },

  pickerWrap: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  picker: {
    height: Platform.OS === 'ios' ? 180 : 50,
  },

  note: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
