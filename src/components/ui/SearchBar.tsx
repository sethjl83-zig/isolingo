import React from 'react';
import { View, TextInput, Image, Keyboard, StyleSheet, type ViewStyle, type ImageSourcePropType } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';
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
    <View style={[styles.wrap, icon ? styles.wrapWithIcon : null, containerStyle]}>
      {icon ? (
        <Image source={icon} style={styles.icon} accessibilityIgnoresInvertColors />
      ) : null}
      <TextInput
        style={[styles.input, icon ? styles.inputFlex : null]}
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
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: 'rgba(0,0,0,0.4)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 0,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  wrapWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { width: 16, height: 16 },
  input: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 16,
    color: '#25262B',
    padding: 0,
  },
  inputFlex: { flex: 1, padding: 0 },
});
