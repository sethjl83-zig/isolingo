/**
 * WordMgmtStrip — non-functional word-management row shown at the bottom of
 * every study card. Functionality will be wired up in a later pass.
 *
 * The strip handles its own safe-area bottom padding and the hairline divider
 * above it so callers don't need to worry about device-specific offsets.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

const BUTTONS = [
  { id: 'remove',    label: 'Remove' },
  { id: 'replace',   label: 'Replace' },
  { id: 'frequency', label: 'Frequency' },
  { id: 'pause',     label: 'Pause' },
] as const;

export default function WordMgmtStrip() {
  const scheme  = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const insets  = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.strip,
        {
          borderTopColor: palette.border,
          paddingBottom: Math.max(insets.bottom, 14),
        },
      ]}
    >
      {BUTTONS.map(btn => (
        <TouchableOpacity
          key={btn.id}
          style={[styles.btn, { borderColor: palette.border }]}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color: palette.subtext }]}>
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
