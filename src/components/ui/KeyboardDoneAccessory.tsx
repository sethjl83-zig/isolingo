import React from 'react';
import { InputAccessoryView, View, Text, TouchableOpacity, Platform, Keyboard, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { HomeFonts } from '@/constants/homeFonts';
import { Colors } from '@/constants/theme';

export const KEYBOARD_DONE_ACCESSORY_ID = 'isolingo-keyboard-done';

export default function KeyboardDoneAccessory() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View
        style={[
          styles.bar,
          { backgroundColor: palette.card, borderTopColor: 'rgba(210,232,215,0.8)' },
        ]}
      >
        <TouchableOpacity
          onPress={Keyboard.dismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  done: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 17,
    color: '#5E51A4',
  },
});
