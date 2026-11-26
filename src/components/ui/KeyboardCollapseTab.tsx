import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/** Visible tab height. List content adds this much padding while the keyboard is open. */
export const KEYBOARD_COLLAPSE_TAB_HEIGHT = 28;

const TAB_WIDTH = 56;
/** Extra tap area above the visible face, kept inside this view so the press lands on the tab. */
const TAP_EXTENSION = 16;

type Props = {
  backgroundColor: string;
  chevronColor: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Draws a small dismiss tab on the top-left edge of the bottom bar while the
 * keyboard is open. The bar itself is `children` and stays in its normal place.
 */
export default function KeyboardCollapseTab({
  backgroundColor,
  chevronColor,
  style,
  children,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  const show = useCallback(() => {
    if (visibleRef.current) return;
    visibleRef.current = true;
    setMounted(true);
    requestAnimationFrame(() => {
      if (!visibleRef.current) return;
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [opacity]);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [opacity]);

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardDidHide', hide),
    ];
    if (Platform.OS === 'ios') {
      subs.push(
        Keyboard.addListener('keyboardWillShow', show),
        Keyboard.addListener('keyboardWillHide', hide),
      );
    }
    return () => {
      subs.forEach(sub => sub.remove());
    };
  }, [hide, show]);

  return (
    <View pointerEvents="box-none" style={mounted ? styles.wrapOpen : undefined}>
      {mounted ? (
        <Animated.View pointerEvents="box-none" style={[styles.slot, { opacity }]}>
          <Pressable
            onPress={Keyboard.dismiss}
            hitSlop={{ top: 0, bottom: 0, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
            style={styles.press}
          >
            <View style={[styles.face, { backgroundColor }]}>
              <MaterialCommunityIcons name="chevron-down" size={22} color={chevronColor} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
      <View style={style}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapOpen: { marginTop: -(KEYBOARD_COLLAPSE_TAB_HEIGHT + TAP_EXTENSION) },
  slot: {
    height: KEYBOARD_COLLAPSE_TAB_HEIGHT + TAP_EXTENSION,
    width: TAB_WIDTH,
    justifyContent: 'flex-end',
  },
  press: {
    flex: 1,
    width: TAB_WIDTH,
    justifyContent: 'flex-end',
  },
  face: {
    height: KEYBOARD_COLLAPSE_TAB_HEIGHT,
    width: TAB_WIDTH,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
    shadowOpacity: 0,
  },
});
