/**
 * SCREEN — MY LISTS
 * Shows all named vocabulary pools for the active language.
 * Replaces the old Word Banks screen as the target of the
 * dashboard "My Vocabulary" button.
 */
import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Alert, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import type { Pool } from '@/src/types/pool';
import type { StudyType } from '@/src/types/state';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const plusIcon = require('@/assets/images/lists/plus.png');
const trashIcon = require('@/assets/images/lists/trash.png');
const rowChevron = require('@/assets/images/lists/row-chevron.png');
const emptyClipboard = require('@/assets/images/lists/empty-clipboard.png');
const gearIcon = require('@/assets/images/study/gear.png');
const dialogBook = require('@/assets/images/study/dialog-book.png');
const dialogBookTeal = require('@/assets/images/study/dialog-book-teal.png');
const dialogGender = require('@/assets/images/study/dialog-gender.png');
const dialogBoth = require('@/assets/images/study/dialog-both.png');

const ALREADY_DEFAULT_PREFIX = 'Already Default for:';

const DEFAULT_OPTION_STYLE: Record<string, {
  source: number;
  width: number;
  height: number;
  well: string;
  text: string;
  fill: string;
}> = {
  'General Vocab': {
    source: dialogBook,
    width: 13.5,
    height: 16,
    well: '#5E51A4',
    text: '#5E51A4',
    fill: 'rgba(94,81,164,0.15)',
  },
  Gender: {
    source: dialogGender,
    width: 12.8,
    height: 18,
    well: '#5E51A4',
    text: '#5E51A4',
    fill: 'rgba(94,81,164,0.15)',
  },
  Both: {
    source: dialogBoth,
    width: 16.5,
    height: 10,
    well: '#38A19A',
    text: '#38A19A',
    fill: 'rgba(56,161,154,0.15)',
  },
};

type ListIconWell = 'purple' | 'orange' | 'teal' | 'blue';

interface ListIcon {
  source: number;
  well: ListIconWell;
  width: number;
  height: number;
}

const BOOK_ICON: ListIcon = {
  source: require('@/assets/images/lists/icon-books.png'),
  well: 'orange',
  width: 28,
  height: 28,
};

/** Exact curated display names that have their own Figma icon. */
const CATEGORY_ICONS: Record<string, ListIcon> = {
  People: {
    source: require('@/assets/images/lists/icon-people.png'),
    well: 'purple',
    width: 30,
    height: 30,
  },
  Home: {
    source: require('@/assets/images/lists/icon-home.png'),
    well: 'teal',
    width: 27,
    height: 29,
  },
  Animals: {
    source: require('@/assets/images/lists/icon-paw.png'),
    well: 'blue',
    width: 28,
    height: 28,
  },
  'Basic Words': BOOK_ICON,
};

function iconForPool(pool: Pool): ListIcon {
  if (pool.createdVia !== 'curated') return BOOK_ICON;
  return CATEGORY_ICONS[pool.name] ?? BOOK_ICON;
}

const HEADER_HEIGHT = 39;
const SUBTITLE_GAP = 22;
const SUBTITLE_HEIGHT = 17;
/** Empty-state top on the 852 pt "No List Yet" frame, measured from the top of the phone. */
const EMPTY_STATE_FRAME_Y = 345;

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type DefaultDialogOption = { text: string; onPress: () => void };

interface DefaultDialogState {
  title: string;
  message: string;
  options: DefaultDialogOption[];
}

export default function MyListsScreen() {
  const router = useRouter();
  const {
    state,
    isReady,
    getLanguagePools,
    getDefaultPools,
    deletePool,
    setDefaultPool,
  } = useAppContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [defaultDialog, setDefaultDialog] = useState<DefaultDialogState | null>(null);

  const language = state.languageSelected;

  useEffect(() => {
    if (isReady && !language) {
      router.replace('/');
    }
  }, [isReady, language, router]);

  useAndroidBackHandler(
    useCallback(() => {
      router.back();
      return true;
    }, [router]),
  );

  if (!isReady || !language) return null;

  const pools = getLanguagePools(language);

  // Pool IDs that are currently set as default for each study type
  const defaultGeneralIds = getDefaultPools('general_vocab', language).map(p => p.id);
  const defaultGenderIds  = getDefaultPools('gender', language).map(p => p.id);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleViewEdit = (pool: Pool) => {
    // Pass poolId so vocab-bank reads words directly from the pool,
    // not from the old modeBanks / activeVocabBank structure.
    router.push({ pathname: '/vocab-bank', params: { poolId: pool.id } });
  };

  const handleSetDefault = (pool: Pool) => {
    const isDefaultGeneral = defaultGeneralIds.includes(pool.id);
    const isDefaultGender  = defaultGenderIds.includes(pool.id);

    // Build a clear status line so the user knows what's already set
    const alreadyLabels: string[] = [];
    if (isDefaultGeneral) alreadyLabels.push('General Vocab');
    if (isDefaultGender)  alreadyLabels.push('Gender');

    const title = alreadyLabels.length
      ? `Already Default for: ${alreadyLabels.join(' & ')}`
      : 'Set as Default';

    const message = alreadyLabels.length
      ? `"${pool.name}" is already the default list for ${alreadyLabels.join(' & ')}. Set it as default for the remaining type(s) below:`
      : `Which study mode should "${pool.name}" be the default list for?`;

    const options: DefaultDialogOption[] = [];

    // Show only the study types not yet assigned to this pool
    if (!isDefaultGeneral) {
      options.push({
        text: 'General Vocab',
        onPress: () => setDefaultPool('general_vocab' as StudyType, language, [pool.id]),
      });
    }
    if (!isDefaultGender) {
      options.push({
        text: 'Gender',
        onPress: () => setDefaultPool('gender' as StudyType, language, [pool.id]),
      });
    }
    // "Both" only appears when neither is set yet
    if (!isDefaultGeneral && !isDefaultGender) {
      options.push({
        text: 'Both',
        onPress: () => {
          setDefaultPool('general_vocab' as StudyType, language, [pool.id]);
          setDefaultPool('gender' as StudyType, language, [pool.id]);
        },
      });
    }

    setDefaultDialog({ title, message, options });
  };

  const handleDelete = (pool: Pool) => {
    Alert.alert(
      'Delete List',
      `Delete "${pool.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePool(pool.id, language),
        },
      ],
    );
  };

  // ── Pool row renderer ──────────────────────────────────────────────────────

  const renderPool = ({ item: pool }: { item: Pool }) => {
    const isDefaultGeneral = defaultGeneralIds.includes(pool.id);
    const isDefaultGender  = defaultGenderIds.includes(pool.id);
    const isFullyDefault   = isDefaultGeneral && isDefaultGender;
    const icon = iconForPool(pool);
    const wellColor = {
      purple: hexAlpha(palette.primary, 0.12),
      orange: hexAlpha(palette.listIconOrange, 0.12),
      teal: hexAlpha(palette.teal, 0.12),
      blue: hexAlpha(palette.listIconBlue, 0.12),
    }[icon.well];

    return (
      <View style={styles.cardShadow}>
        <View style={[styles.poolCard, { borderColor: palette.listCardBorder }]}>
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FF']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.poolCardHeader}>
            <View style={[styles.iconWell, { backgroundColor: wellColor }]}>
              <Image
                source={icon.source}
                style={{ width: icon.width, height: icon.height }}
                accessibilityIgnoresInvertColors
              />
            </View>
            <View style={styles.poolCardInfo}>
              <Text style={styles.poolName} numberOfLines={1}>
                {pool.name}
              </Text>
              <Text style={styles.poolMeta}>
                {pool.words.length}{' '}
                {pool.words.length === 1 ? 'word' : 'words'}
              </Text>
              {(isDefaultGeneral || isDefaultGender) && (
                <View style={styles.badgeRow}>
                  {isDefaultGeneral && (
                    <DefaultBadge label="General Vocab Default" fill="#E0DCF0" tint={palette.primary} />
                  )}
                  {isDefaultGender && (
                    <DefaultBadge label="Gender Default" fill="#E0DCF0" tint={palette.primary} />
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.actionRow}>
            {!isFullyDefault && (
              <TouchableOpacity
                onPress={() => handleSetDefault(pool)}
                activeOpacity={0.65}
                hitSlop={6}
              >
                <Text style={[styles.setDefault, { color: palette.primary }]}>Set as Default</Text>
              </TouchableOpacity>
            )}
            <View style={styles.iconActions}>
              <TouchableOpacity
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: hexAlpha(palette.destructive, 0.12),
                    borderColor: hexAlpha(palette.destructive, 0.6),
                  },
                ]}
                onPress={() => handleDelete(pool)}
                activeOpacity={0.7}
                accessibilityLabel="Delete"
              >
                <Image source={trashIcon} style={styles.trashIcon} accessibilityIgnoresInvertColors />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: hexAlpha(palette.primary, 0.15),
                    borderColor: hexAlpha(palette.primary, 0.6),
                  },
                ]}
                onPress={() => handleViewEdit(pool)}
                activeOpacity={0.7}
                accessibilityLabel="View / Edit"
              >
                <Image source={rowChevron} style={styles.rowChevron} accessibilityIgnoresInvertColors />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: hexAlpha(palette.primary, 0.15) }]}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>

        <Text style={styles.screenTitle} pointerEvents="none">
          My Lists
        </Text>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: palette.primary }]}
          onPress={() => router.push('/add-list')}
          activeOpacity={0.8}
          accessibilityLabel="Add List"
        >
          <Image source={plusIcon} style={styles.plusIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Create and manage your word lists.</Text>

      <FlatList
        data={pools}
        keyExtractor={p => p.id}
        renderItem={renderPool}
        contentContainerStyle={[
          styles.listContent,
          pools.length === 0 && styles.emptyContent,
        ]}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyState,
              {
                marginTop: Math.max(
                  0,
                  EMPTY_STATE_FRAME_Y -
                    insets.top -
                    HEADER_HEIGHT -
                    SUBTITLE_GAP -
                    SUBTITLE_HEIGHT,
                ),
              },
            ]}
          >
            <View style={styles.emptyIconWell}>
              <Image source={emptyClipboard} style={styles.emptyIcon} accessibilityIgnoresInvertColors />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>
                No Lists Yet
              </Text>
              <Text style={styles.emptyDesc}>
                Tap <Text style={styles.emptyPlus}>+</Text> above to create
                your first vocabulary list
              </Text>
            </View>
          </View>
        }
      />

      <Modal
        visible={defaultDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDefaultDialog(null)}
      >
        <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogOverlay}>
        <Pressable style={styles.dialogBackdrop} onPress={() => setDefaultDialog(null)}>
          <Pressable style={styles.dialogSheet} onPress={() => {}}>
            {defaultDialog?.title.startsWith(ALREADY_DEFAULT_PREFIX) ? (
              defaultDialog.title.slice(ALREADY_DEFAULT_PREFIX.length).trim() === 'Gender' ? (
                <View style={styles.dialogBadge}>
                  <Image
                    source={dialogGender}
                    style={styles.dialogGender}
                    tintColor="#5E51A4"
                    accessibilityIgnoresInvertColors
                  />
                </View>
              ) : (
                <View style={styles.dialogBadgeTeal}>
                  <Image source={dialogBookTeal} style={styles.dialogBookTeal} accessibilityIgnoresInvertColors />
                </View>
              )
            ) : (
              <View style={styles.dialogBadge}>
                <Image source={gearIcon} style={styles.dialogGear} accessibilityIgnoresInvertColors />
              </View>
            )}
            <View style={styles.dialogCopy}>
              {defaultDialog?.title.startsWith(ALREADY_DEFAULT_PREFIX) ? (
                <Text style={styles.alreadyTitle}>
                  {`${ALREADY_DEFAULT_PREFIX}\n`}
                  <Text style={styles.alreadyAccent}>
                    {defaultDialog.title.slice(ALREADY_DEFAULT_PREFIX.length).trim()}
                  </Text>
                </Text>
              ) : (
                <Text style={styles.dialogTitle}>{defaultDialog?.title}</Text>
              )}
              <Text style={styles.dialogMessage}>{defaultDialog?.message}</Text>
            </View>
            <View style={styles.dialogActions}>
              {defaultDialog?.options.map(option => {
                const look = DEFAULT_OPTION_STYLE[option.text];
                return (
                  <TouchableOpacity
                    key={option.text}
                    style={[styles.dialogOption, { backgroundColor: look?.fill ?? 'rgba(94,81,164,0.15)' }]}
                    onPress={() => {
                      option.onPress();
                      setDefaultDialog(null);
                    }}
                    activeOpacity={0.75}
                  >
                    {look ? (
                      <View style={[styles.dialogOptionWell, { backgroundColor: look.well }]}>
                        <Image
                          source={look.source}
                          style={{ width: look.width, height: look.height }}
                          accessibilityIgnoresInvertColors
                        />
                      </View>
                    ) : null}
                    <Text style={[styles.dialogOptionLabel, { color: look?.text ?? '#5E51A4' }]}>
                      {option.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.dialogCancel}
                onPress={() => setDefaultDialog(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.dialogCancelLabel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small shared sub-components ───────────────────────────────────────────────

function DefaultBadge({ label, fill, tint }: { label: string; fill: string; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: fill }]}>
      <Text style={[styles.badgeText, { color: tint }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    height: HEADER_HEIGHT,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 24,
    lineHeight: 29,
    color: '#25262B',
  },
  addBtn: {
    width: 39,
    height: 39,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  plusIcon: { width: 21, height: 20 },

  subtitle: {
    marginTop: SUBTITLE_GAP,
    marginHorizontal: 16,
    height: SUBTITLE_HEIGHT,
    fontFamily: HomeFonts.jakartaRegular,
    fontSize: 14,
    lineHeight: SUBTITLE_HEIGHT,
    color: 'rgba(0,0,0,0.6)',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 24,
    gap: 10,
  },
  emptyContent: {
    flexGrow: 1,
    paddingTop: 0,
  },

  cardShadow: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  poolCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    gap: 10,
  },
  poolCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolCardInfo: { flex: 1, gap: 6 },
  poolName: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#25262B',
  },
  poolMeta: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 13.5,
    lineHeight: 16,
    color: 'rgba(0,0,0,0.6)',
  },

  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: HomeFonts.interMedium,
    fontSize: 11,
  },

  cardDivider: {
    height: 1,
    marginHorizontal: -3,
    backgroundColor: 'rgba(210,232,215,0.8)',
  },
  actionRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  setDefault: {
    fontFamily: HomeFonts.interMedium,
    fontSize: 13,
    lineHeight: 16,
  },
  iconActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIcon: { width: 17, height: 17 },
  rowChevron: {
    width: 14,
    height: 13,
    transform: [{ rotate: '90deg' }],
  },

  emptyState: {
    width: 268,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 15,
  },
  emptyIconWell: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { width: 80, height: 80 },
  emptyCopy: { gap: 8, alignSelf: 'stretch' },
  emptyTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.45)',
  },
  emptyDesc: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.4)',
  },
  emptyPlus: {
    fontFamily: HomeFonts.interMedium,
  },

  dialogScroll: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  dialogOverlay: { flexGrow: 1 },
  dialogBackdrop: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: 243,
    paddingBottom: 24,
  },
  dialogSheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  dialogBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(94,81,164,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogGear: { width: 35, height: 35 },
  dialogGender: { width: 25, height: 35 },
  dialogBadgeTeal: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(56,161,154,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBookTeal: { width: 29.5, height: 35 },
  dialogCopy: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  dialogTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  alreadyTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  alreadyAccent: { color: '#38A19A' },
  dialogMessage: {
    fontFamily: HomeFonts.interRegular,
    fontSize: 14.8,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  dialogActions: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  dialogOption: {
    width: 220,
    borderRadius: 10,
    paddingHorizontal: 30,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dialogOptionWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogOptionLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  dialogCancel: {
    width: 220,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dialogCancelLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
});
