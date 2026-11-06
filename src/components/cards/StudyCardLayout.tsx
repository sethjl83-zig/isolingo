/**
 * Shared study-card shell: KeyboardAvoidingView + action bar + word-management strip.
 *
 * Flip, Submit/Next, and WordMgmtStrip sit inside the KeyboardAvoidingView so
 * they lift together and stay visible above the keyboard. The card body scrolls
 * in the space above them.
 */
import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WordMgmtStrip from '../ui/WordMgmtStrip';

export type StudyCardWord = { id: string; lemma: string };

interface Props {
  words: StudyCardWord[];
  bottomBar: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function StudyCardLayout({ words, bottomBar, children, style }: Props) {
  const insets = useSafeAreaInsets();
  // iOS reports the keyboard from the top of the screen, while this view
  // starts below the status bar. Android stays at 0.
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top : 0;

  return (
    <View style={[styles.container, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={styles.inner}>
          {children}
          {bottomBar}
          <WordMgmtStrip words={words} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  inner: { flex: 1 },
});
