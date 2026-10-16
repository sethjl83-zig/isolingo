/**
 * SCREEN — INDEX (router)
 * Immediately routes to /welcome (new users) or /dashboard (returning users).
 * Routing criterion: whether a user name has been saved to AsyncStorage.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { USER_NAME_KEY } from './welcome';

export default function IndexScreen() {
  const router = useRouter();
  const scheme  = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  useEffect(() => {
    AsyncStorage.getItem(USER_NAME_KEY).then(name => {
      router.replace(name ? '/dashboard' : '/welcome');
    });
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.tint} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
