import React from 'react';
import {
  View,
  TextInput,
  Keyboard,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { KEYBOARD_DONE_ACCESSORY_ID } from './KeyboardDoneAccessory';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Show a Done button above the iOS keyboard. */
  showKeyboardDone?: boolean;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search words…',
  showKeyboardDone = false,
}: SearchBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={[styles.wrap, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <TextInput
        style={[styles.input, { color: palette.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.subtext}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={Keyboard.dismiss}
        inputAccessoryViewID={showKeyboardDone ? KEYBOARD_DONE_ACCESSORY_ID : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: { fontSize: 16 },
});
