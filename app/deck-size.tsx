/**
 * SCREEN — DECK SIZE
 * Inserted between select-study-list and direction.tsx.
 * Deck size is chosen from the sizes that fit the selected lists.
 *
 * Only deck sizes that fit within the combined pool word count appear as
 * selectable items; sizes that would exceed it are omitted entirely.
 *
 * On confirm, saves the choice as the remembered preference for this exact
 * pool combination, then proceeds to the direction-select screen.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HomeFonts } from '@/constants/homeFonts';
import type { PoolDeckSize } from '@/src/types/pool';
import { getDeckSizePref, saveDeckSizePref } from '@/src/storage/deckSizePrefs';
import { parsePoolIdsParam } from '@/src/utils/studyLaunch';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { useAppContext } from '@/src/context/AppContext';
import ErrorBoundary from '@/src/components/ErrorBoundary';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const deckCards = require('@/assets/images/study/deck-cards.png');
const chevronDown = require('@/assets/images/study/chevron-down.png');
const infoIcon = require('@/assets/images/study/info.png');
const continueArrow = require('@/assets/images/study/continue-arrow.png');

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

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={8}
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
      </TouchableOpacity>
      <Text style={styles.screenTitle} pointerEvents="none">{title}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  showArrow = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  showArrow?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, (disabled || busy) && styles.primaryBtnDisabled]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.75}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Text style={styles.primaryLabel}>{label}</Text>
          {showArrow ? (
            <Image source={continueArrow} style={styles.primaryArrow} accessibilityIgnoresInvertColors />
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
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
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Deck Size" onBack={onBack} />
      <View style={styles.content}>
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.errorText}>{message}</Text>
        <PrimaryButton label="Go Back" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

function DeckSizeContent() {
  const router = useRouter();
  const { state } = useAppContext();
  const { poolIds: poolIdsParam, totalCount: totalCountParam } =
    useLocalSearchParams<{ poolIds?: string | string[]; totalCount?: string | string[] }>();
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Deck Size" onBack={handleBack} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#5E51A4" />
          <Text style={styles.loadingText}>
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
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Deck Size" onBack={handleBack} />

      <View style={styles.content}>
        <View style={styles.selectBlock}>
          <View style={styles.titleBlock}>
            <Text style={styles.heading}>Select Deck Size</Text>
            <Text style={styles.subheading}>
              {totalCount} {totalCount === 1 ? 'word' : 'words'} available in your selected{' '}
              {poolIds.length === 1 ? 'list' : 'lists'}
            </Text>
          </View>

          {prefLoadFailed ? (
            <Text style={styles.warningText}>
              Your saved deck size could not be loaded. Showing the default size instead.
            </Text>
          ) : null}

          {saveError ? (
            <Text style={styles.warningText}>{saveError}</Text>
          ) : null}

          {pickerReady ? (
            <View style={styles.menuWrap}>
              <TouchableOpacity
                style={styles.sizeField}
                onPress={() => setMenuOpen(open => !open)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${selected} words`}
              >
                <View style={styles.sizeFieldLead}>
                  <Image source={deckCards} style={styles.deckCards} accessibilityIgnoresInvertColors />
                  <Text style={styles.sizeValue}>{selected} words</Text>
                </View>
                <Image source={chevronDown} style={styles.chevron} accessibilityIgnoresInvertColors />
              </TouchableOpacity>
              {menuOpen ? (
                <View style={styles.menu}>
                  {validSizes.map(size => (
                    <TouchableOpacity
                      key={size}
                      style={styles.menuRow}
                      onPress={() => {
                        setSelected(size);
                        setMenuOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: size === selected }}
                    >
                      <Text style={[styles.menuLabel, size === selected && styles.menuLabelOn]}>
                        {size} words
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.errorText}>
              Deck size options are unavailable right now. Go back and try again.
            </Text>
          )}
        </View>

        {pickerReady ? (
          <View style={styles.noteCard}>
            <Image source={infoIcon} style={styles.infoIcon} accessibilityIgnoresInvertColors />
            <Text style={styles.note}>
              Your deck is a randomly drawn selection from your lists — words with higher
              frequency settings are more likely to be included.
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!pickerReady}
          busy={saving}
          showArrow
        />
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
      exitLabel="Go Back"
    >
      <DeckSizeContent />
    </ErrorBoundary>
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
    paddingTop: 35,
    gap: 40,
  },
  selectBlock: { gap: 18, alignItems: 'center' },
  titleBlock: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },

  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },

  heading: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  subheading: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },

  menuWrap: { alignSelf: 'stretch', gap: 8 },
  sizeField: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sizeFieldLead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deckCards: { width: 21, height: 21 },
  sizeValue: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.5)',
  },
  chevron: { width: 10.5, height: 6 },
  menu: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  menuRow: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  menuLabel: {
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.5)',
  },
  menuLabelOn: { color: '#5E51A4' },

  noteCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(94,81,164,0.06)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  infoIcon: { width: 20, height: 20 },
  note: {
    flex: 1,
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#5E51A4',
  },

  errorText: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  warningText: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },

  primaryBtn: {
    alignSelf: 'stretch',
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
  primaryBtnDisabled: { opacity: 0.4 },
  primaryLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  primaryArrow: { width: 12, height: 12 },
});
