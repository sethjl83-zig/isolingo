import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HomeFonts } from '@/constants/homeFonts';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const infoIcon = require('@/assets/images/gameplay/info.png');

/** Today's one-line box: 15 padding, the 20-pt line or the 20-pt icon, 15 padding. */
function oneLineHeight() {
  const line = 20 * PixelRatio.getFontScale();
  return 15 + Math.max(20, line) + 15;
}

interface Props {
  tone: 'info' | 'correct';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Production only. Locks the box to one line and puts `note` in a strip under it. */
  singleLine?: boolean;
  note?: string | null;
}

/** Purple info note from Gameplay 2C. Correct uses the same card in teal. */
export default function FeedbackNote({ tone, children, style, singleLine, note }: Props) {
  const correct = tone === 'correct';
  const box = (
    <View
      style={[
        styles.note,
        correct && styles.correct,
        singleLine && { height: oneLineHeight(), marginTop: 0 },
        singleLine ? null : style,
      ]}
    >
      <Image
        source={infoIcon}
        style={styles.icon}
        tintColor={correct ? '#38A19A' : undefined}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );

  if (!singleLine) return box;

  return (
    <View style={style}>
      {box}
      {note ? <FeedbackExtra text={note} /> : null}
    </View>
  );
}

function FeedbackExtra({ text }: { text: string }) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [opacity, text]);

  return (
    <Animated.View
      style={[
        styles.extra,
        { opacity, backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <Text
        style={[
          styles.extraText,
          { color: palette.subtext },
          Platform.OS === 'android' ? styles.androidText : null,
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(94,81,164,0.06)',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  correct: {
    backgroundColor: 'rgba(56,161,154,0.08)',
  },
  icon: { width: 20, height: 20 },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  extra: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  extraText: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 13,
    lineHeight: 18,
  },
  androidText: { includeFontPadding: false },
});
