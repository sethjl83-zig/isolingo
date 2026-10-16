import React from 'react';
import { View, TextInput, Image, Keyboard, StyleSheet, type ViewStyle, type ImageSourcePropType } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors } from '@/constants/theme';
import { KEYBOARD_DONE_ACCESSORY_ID } from './KeyboardDoneAccessory';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Show a Done button above the iOS keyboard. */
  showKeyboardDone?: boolean;
  containerStyle?: ViewStyle;
  icon?: ImageSourcePropType;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search words…',
  showKeyboardDone = false,
  containerStyle,
  icon,
}: SearchBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={[styles.wrap, { backgroundColor: palette.card, borderColor: palette.border }, icon ? styles.wrapWithIcon : null, containerStyle]}>
      {icon ? (
        <Image source={icon} style={styles.icon} accessibilityIgnoresInvertColors />
      ) : null}
      <TextInput
        style={[styles.input, icon ? styles.inputFlex : null, { color: palette.text }]}
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
  wrapWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { width: 16, height: 16 },
  input: { fontSize: 16 },
  inputFlex: { flex: 1, padding: 0 },
});
