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
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { HomeFonts } from '@/constants/homeFonts';

const hero = require('@/assets/images/welcome/hero.png');
const userIcon = require('@/assets/images/welcome/user.png');
const arrow = require('@/assets/images/welcome/arrow.png');

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
  const insets  = useSafeAreaInsets();

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
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(0, 120 - insets.top) },
          ]}
        >
          <View style={styles.column}>
          <View style={styles.brand}>
            <Text style={[styles.appName, { color: palette.primary }]}>Akuity</Text>
            <View style={styles.heroClip}>
              <Image source={hero} style={styles.hero} resizeMode="stretch" accessible={false} />
            </View>
          </View>

          <View style={styles.form}>
            <Text style={[styles.prompt, { color: palette.text }]}>
              What’s your name?
            </Text>
            <View style={styles.fields}>
              <View style={[styles.field, { backgroundColor: palette.background }]}>
                <Image source={userIcon} style={styles.userIcon} resizeMode="contain" accessible={false} />
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  returnKeyType="done"
                  onSubmitEditing={handleGetStarted}
                  autoCapitalize="words"
                  maxLength={40}
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: palette.primary },
                  !canProceed && styles.buttonDisabled,
                ]}
                onPress={handleGetStarted}
                disabled={!canProceed}
                activeOpacity={0.82}
              >
                <Text style={styles.buttonText}>Get Started</Text>
                <Image source={arrow} style={styles.arrow} resizeMode="contain" accessible={false} />
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav:  { flex: 1 },
  content: {
    alignItems: 'center',
    paddingBottom: 34,
  },
  column: {
    width: '100%',
    maxWidth: 393,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  brand: {
    width: 303,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 25,
  },
  appName: {
    width: '100%',
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 45,
    lineHeight: 54,
    textAlign: 'center',
  },
  heroClip: {
    width: '100%',
    aspectRatio: 285 / 219,
    overflow: 'hidden',
  },
  hero: {
    position: 'absolute',
    width: '115.44%',
    height: '100.15%',
    left: '-10.55%',
    top: '0.14%',
  },
  form: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 30,
    marginTop: 30,
  },
  prompt: {
    width: 294,
    maxWidth: '100%',
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  fields: {
    alignSelf: 'stretch',
    gap: 45,
  },
  field: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  userIcon: {
    width: 18,
    height: 18,
  },
  input: {
    flex: 1,
    fontFamily: HomeFonts.jakartaMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    backgroundColor: 'transparent',
  },
  button: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  arrow: {
    width: 12,
    height: 12,
  },
});
