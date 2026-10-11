/**
 * SCREEN — MY LISTS
 * Shows all named vocabulary pools for the active language.
 * Replaces the old Word Banks screen as the target of the
 * dashboard "My Vocabulary" button.
 */
import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/src/context/AppContext';
import type { Pool } from '@/src/types/pool';
import type { StudyType } from '@/src/types/state';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import StudyButton from '@/src/components/ui/StudyButton';

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
      ? `Already default for: ${alreadyLabels.join(' & ')}`
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

    return (
      <View
        style={[
          styles.poolCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {/* Name + meta */}
        <View style={styles.poolCardHeader}>
          <View style={styles.poolCardInfo}>
            <Text style={[styles.poolName, { color: palette.text }]} numberOfLines={1}>
              {pool.name}
            </Text>
            <Text style={[styles.poolMeta, { color: palette.subtext }]}>
              {pool.words.length}{' '}
              {pool.words.length === 1 ? 'word' : 'words'}
            </Text>

            {/* Default badges — shown inline below meta so they're always visible */}
            {(isDefaultGeneral || isDefaultGender) && (
              <View style={styles.badgeRow}>
                {isDefaultGeneral && (
                  <DefaultBadge label="General Vocab default" tint={palette.tint} />
                )}
                {isDefaultGender && (
                  <DefaultBadge label="Gender default" tint={palette.tint} />
                )}
              </View>
            )}
          </View>
        </View>

        {/* Action strip */}
        <View style={[styles.actionRow, { borderTopColor: palette.border }]}>
          <ActionButton
            label="View / Edit"
            color={palette.tint}
            onPress={() => handleViewEdit(pool)}
          />

          {!isFullyDefault && (
            <>
              <View style={[styles.actionDivider, { backgroundColor: palette.border }]} />
              <ActionButton
                label="Set as Default"
                color={palette.tint}
                onPress={() => handleSetDefault(pool)}
              />
            </>
          )}

          <View style={[styles.actionDivider, { backgroundColor: palette.border }]} />
          <ActionButton
            label="Delete"
            color="#E05050"
            onPress={() => handleDelete(pool)}
          />
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backBtn, { color: palette.tint }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.screenTitle, { color: palette.text }]}>My Lists</Text>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: palette.tint }]}
          onPress={() => router.push('/add-list')}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnLabel}>+ Add List</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pools}
        keyExtractor={p => p.id}
        renderItem={renderPool}
        contentContainerStyle={[
          styles.listContent,
          pools.length === 0 && styles.emptyContent,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No lists yet
            </Text>
            <Text style={[styles.emptyDesc, { color: palette.subtext }]}>
              Tap <Text style={{ fontWeight: '700' }}>+</Text> above to create
              your first vocabulary list
            </Text>
          </View>
        }
      />

      <Modal
        visible={defaultDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDefaultDialog(null)}
      >
        <Pressable style={styles.dialogOverlay} onPress={() => setDefaultDialog(null)}>
          <Pressable
            style={[styles.dialogSheet, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.dialogTitle, { color: palette.text }]}>
              {defaultDialog?.title}
            </Text>
            <Text style={[styles.dialogMessage, { color: palette.subtext }]}>
              {defaultDialog?.message}
            </Text>
            <View style={styles.dialogActions}>
              {defaultDialog?.options.map(option => (
                <StudyButton
                  key={option.text}
                  label={option.text}
                  variant="primary"
                  size="medium"
                  onPress={() => {
                    option.onPress();
                    setDefaultDialog(null);
                  }}
                  style={styles.dialogBtn}
                />
              ))}
              <StudyButton
                label="Cancel"
                variant="secondary"
                size="medium"
                onPress={() => setDefaultDialog(null)}
                style={styles.dialogBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small shared sub-components ───────────────────────────────────────────────

function DefaultBadge({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Top bar
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
  addBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  addBtnLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // List
  listContent: {
    padding: 20,
    gap: 14,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // Pool card
  poolCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  poolCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  poolCardInfo: { flex: 1, gap: 4 },
  poolName: { fontSize: 16, fontWeight: '700' },
  poolMeta: { fontSize: 13 },

  // Default badges — solid filled pills placed below the meta line
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  badge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Action strip
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 28,
  },
  dialogSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  dialogTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  dialogMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dialogActions: { gap: 10, marginTop: 8, alignItems: 'stretch' },
  dialogBtn: { alignSelf: 'stretch', minWidth: 0 },
});
