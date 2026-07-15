/**
 * SCREEN — WELCOME
 * First-run screen. Collects the user's name and navigates to the
 * Dashboard, which renders the celebration overlay on top of itself.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';

export const USER_NAME_KEY          = '@isolingo/user_name';
export const CELEBRATION_PENDING_KEY = '@isolingo/celebration_pending';

// In-memory signal so the dashboard can synchronously detect a first-run celebration
// on its very first render, with zero async latency.
let _pendingCelebration: { name: string } | null = null;

/** Called by welcome screen just before navigating. Read once by the dashboard. */
export function takePendingCelebration(): { name: string } | null {
  const c = _pendingCelebration;
  _pendingCelebration = null;
  return c;
}

export default function WelcomeScreen() {
  const router  = useRouter();
  const scheme  = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [name, setName] = useState('');

  const canProceed = name.trim().length > 0;

  const handleGetStarted = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Persist name to storage
    await AsyncStorage.setItem(USER_NAME_KEY, trimmed);
    await AsyncStorage.setItem(CELEBRATION_PENDING_KEY, '1');

    // Set the in-memory flag so the dashboard's first render picks it up synchronously,
    // preventing any frame where the dashboard is visible without the overlay.
    _pendingCelebration = { name: trimmed };

    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* App name */}
        <View style={styles.titleSection}>
          <Text style={[styles.appName, { color: palette.text }]}>Akuity</Text>
        </View>

        {/* Prompt + input */}
        <View style={styles.centerSection}>
          <Text style={[styles.prompt, { color: palette.text }]}>
            What's your name?
          </Text>
          <TextInput
            style={[styles.input, {
              color: palette.text,
              borderBottomColor: palette.tint,
            }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={palette.subtext}
            returnKeyType="done"
            onSubmitEditing={handleGetStarted}
            autoCapitalize="words"
            maxLength={40}
          />
        </View>

        {/* Get Started button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: canProceed ? palette.tint : palette.border },
            ]}
            onPress={handleGetStarted}
            disabled={!canProceed}
            activeOpacity={0.82}
          >
            <Text style={[
              styles.buttonText,
              { color: canProceed ? '#FFFFFF' : palette.subtext },
            ]}>
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav:  { flex: 1 },

  titleSection: {
    flex: 0.25,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 10,
  },
  appName: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  centerSection: {
    flex: 0.45,
    justifyContent: 'center',
    paddingHorizontal: 38,
    gap: 30,
  },
  prompt: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 38,
  },
  input: {
    fontSize: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  bottomSection: {
    flex: 0.30,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
  },
  button: {
    width: '72%',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
