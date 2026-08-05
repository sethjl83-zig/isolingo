/**
 * Shared study-card shell: KeyboardAvoidingView + action bar + word-management strip.
 *
 * WordMgmtStrip sits outside the KeyboardAvoidingView so the avoiding view only
 * needs to lift the Submit bar above the keyboard, not the management strip too.
 */
import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import WordMgmtStrip from '../ui/WordMgmtStrip';

export type StudyCardWord = { id: string; lemma: string };

interface Props {
  words: StudyCardWord[];
  bottomBar: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function StudyCardLayout({ words, bottomBar, children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inner}>
          {children}
          {bottomBar}
        </View>
      </KeyboardAvoidingView>
      <WordMgmtStrip words={words} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  inner: { flex: 1 },
});
