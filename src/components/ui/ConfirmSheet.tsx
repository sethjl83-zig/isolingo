/**
 * In-app confirm sheet. Same layout as the designer's Set as Default dialog:
 * white rounded card, dimmed scrim, filled primary, outline secondary.
 * An overlay view, not a system alert and not a modal, so it does not resign
 * a focused text field. Tapping the scrim cancels. Android Back cancels.
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, BackHandler } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';

export type ConfirmSheetButton = {
  label: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type ConfirmSheetRequest = {
  title: string;
  message?: string;
  buttons: ConfirmSheetButton[];
};

type Props = ConfirmSheetRequest & {
  onDismiss: () => void;
};

export default function ConfirmSheet({ title, message, buttons, onDismiss }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const destructiveColor = Colors[scheme].destructive;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [onDismiss]);

  const ordered = [
    ...buttons.filter(button => button.style !== 'cancel'),
    ...buttons.filter(button => button.style === 'cancel'),
  ];

  return (
    <Pressable style={styles.scrim} onPress={onDismiss}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
        <View style={styles.actions}>
          {ordered.map((button, index) => {
            const cancel = button.style === 'cancel';
            const destructive = button.style === 'destructive';
            return (
              <TouchableOpacity
                key={`${button.label}-${index}`}
                style={[
                  cancel ? styles.outline : styles.filled,
                  !cancel && destructive ? { backgroundColor: destructiveColor } : null,
                ]}
                onPress={() => {
                  const action = button.onPress;
                  onDismiss();
                  action?.();
                }}
                activeOpacity={0.75}
              >
                <Text style={cancel ? styles.outlineLabel : styles.filledLabel}>{button.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    paddingTop: 243,
    paddingBottom: 24,
  },
  sheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  copy: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  title: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  message: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 14.8,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  actions: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  filled: {
    width: 220,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5E51A4',
  },
  filledLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  outline: {
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
  outlineLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
});
