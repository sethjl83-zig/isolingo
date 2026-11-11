/**
 * SCREEN — ADD LIST
 * Choice screen: the user picks how they want to build a new vocabulary pool.
 *
 * Module-level launch-source state lets the Dashboard signal that the user
 * arrived here from a study-mode tap (no pools existed yet). Creation screens
 * read this to decide where to navigate after the pool is saved.
 */
import React, { useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, type ImageSourcePropType } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import type { StudyType } from '@/src/types/state';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const rowChevron = require('@/assets/images/lists/row-chevron.png');
const checklistIcon = require('@/assets/images/lists/icon-checklist.png');
const pencilIcon = require('@/assets/images/lists/icon-pencil.png');

// ── Launch-source tracking ────────────────────────────────────────────────────

export type AddListLaunchSource = 'my_lists' | 'study_mode';

let _addListSource: AddListLaunchSource = 'my_lists';
let _addListStudyType: StudyType | null = null;

/** Call this before navigating to /add-list from a study-mode button. */
export function setAddListLaunchSource(
  source: AddListLaunchSource,
  studyType?: StudyType,
): void {
  _addListSource = source;
  _addListStudyType = studyType ?? null;
}

/** Read by creation screens (curated-list, build-your-own). */
export function getAddListLaunchSource(): {
  source: AddListLaunchSource;
  studyType: StudyType | null;
} {
  return { source: _addListSource, studyType: _addListStudyType };
}

interface ChoiceCardProps {
  icon: ImageSourcePropType;
  well: string;
  title: string;
  description: string;
  onPress: () => void;
  palette: (typeof Colors)['light'];
}

function ChoiceCard({ icon, well, title, description, onPress, palette }: ChoiceCardProps) {
  return (
    <TouchableOpacity
      style={[styles.cardShadow]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.card, { borderColor: palette.listCardBorder }]}>
        <View style={[styles.iconWell, { backgroundColor: well }]}>
          <Image source={icon} style={styles.choiceIcon} accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{description}</Text>
        </View>
        <View style={[styles.chevronBtn, { backgroundColor: 'rgba(94,81,164,0.12)', borderColor: 'rgba(94,81,164,0.6)' }]}>
          <Image source={rowChevron} style={styles.chevron} accessibilityIgnoresInvertColors />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AddListScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View pointerEvents="none" style={styles.titleOverlay}>
          <Text style={styles.screenTitle} numberOfLines={1}>Add List</Text>
        </View>
        <View style={styles.headerRow} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: 'rgba(94,81,164,0.15)' }]}
          >
            <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>
          How do you want to build your list?
        </Text>

        <View style={styles.cardList}>
        <ChoiceCard
          icon={checklistIcon}
          well="rgba(56,161,154,0.12)"
          title="Study a Topic"
          description="Words organized by topic"
          onPress={() => router.push('/curated-list' as never)}
          palette={palette}
        />

        <ChoiceCard
          icon={pencilIcon}
          well="#FFF5E7"
          title="Build Your Own"
          description="Choose your own words"
          onPress={() => router.push('/build-your-own' as never)}
          palette={palette}
        />
        </View>
      </View>
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },

  topBar: {
    height: 36,
    marginHorizontal: 16,
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  backIcon: {
    width: 17,
    height: 17,
    transform: [{ rotate: '-90deg' }],
  },
  screenTitle: {
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: '#25262B',
    includeFontPadding: false,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 25,
    gap: 18,
  },
  cardList: { gap: 10 },

  sectionLabel: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },

  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  card: {
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  iconWell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIcon: { width: 32, height: 32 },
  cardText: { flex: 1, gap: 6 },
  cardTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: '#25262B',
  },
  cardDesc: {
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0,0,0,0.7)',
  },
  chevronBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 14,
    height: 13,
    transform: [{ rotate: '90deg' }],
  },
});
