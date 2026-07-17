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
import React, { useMemo, useState } from 'react';
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
import { saveDeckSizePref } from '@/src/storage/deckSizePrefs';
import { parsePoolIdsParam } from '@/src/utils/studyLaunch';
import { useAppContext } from '@/src/context/AppContext';
import StudyButton from '@/src/components/ui/StudyButton';

const ALL_SIZES: PoolDeckSize[] = [10, 15, 20, 25];

export default function DeckSizeScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { poolIds: poolIdsParam, totalCount: totalCountParam } =
    useLocalSearchParams<{ poolIds?: string | string[]; totalCount?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const poolIds = parsePoolIdsParam(poolIdsParam);
  const totalCount = parseInt(totalCountParam ?? '0', 10);
  const language = state.languageSelected;
  const studyType = state.studyTypeSelected ?? 'general_vocab';

  // Only expose sizes that do not exceed the available word count.
  const validSizes = useMemo(
    () => ALL_SIZES.filter(s => s <= totalCount),
    [totalCount],
  );

  // Default to the largest valid size.
  const [selected, setSelected] = useState<PoolDeckSize | null>(
    () => validSizes[validSizes.length - 1] ?? null,
  );
  const [saving, setSaving] = useState(false);

  const noValidSizes = validSizes.length === 0;

  const handleContinue = async () => {
    if (!selected || saving || !language || poolIds.length === 0) return;
    setSaving(true);
    await saveDeckSizePref(language, studyType, poolIds, selected);
    setSaving(false);
    router.push({
      pathname: '/direction',
      params: {
        poolIds: JSON.stringify(poolIds),
        deckSize: String(selected),
      },
    } as never);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Deck size</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.heading, { color: palette.text }]}>Select deck size</Text>
        <Text style={[styles.subheading, { color: palette.subtext }]}>
          {totalCount} {totalCount === 1 ? 'word' : 'words'} available across your selected{' '}
          {poolIds.length === 1 ? 'list' : 'lists'}
        </Text>

        {noValidSizes ? (
          <Text style={[styles.errorText, { color: palette.subtext }]}>
            Your selected lists don't have enough words for a session (minimum 10). Go back
            and add more words or choose different lists.
          </Text>
        ) : (
          <>
            {/* Wheel picker — same wrapper style as list-setup.tsx */}
            <View
              style={[
                styles.pickerWrap,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Picker
                selectedValue={selected}
                onValueChange={v => setSelected(v as PoolDeckSize)}
                style={[styles.picker, { color: palette.text }]}
                itemStyle={Platform.OS === 'ios' ? { color: palette.text } : undefined}
              >
                {validSizes.map(size => (
                  <Picker.Item
                    key={size}
                    label={`${size} words`}
                    value={size}
                  />
                ))}
              </Picker>
            </View>

            <Text style={[styles.note, { color: palette.subtext }]}>
              Your deck is a randomly drawn selection from your lists — words with higher
              frequency settings are more likely to be included.
            </Text>
          </>
        )}
      </View>

      {/* Footer */}
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
            disabled={!selected || noValidSizes}
          />
        )}
      </View>
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

  // Matches list-setup.tsx pickerWrap / picker styles
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

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
