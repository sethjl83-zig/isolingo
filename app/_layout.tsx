import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Appearance } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/src/context/AppContext';
import ErrorBoundary from '@/src/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});
Appearance.setColorScheme('light');

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const fontsReady = fontsLoaded || !!fontError || fontWaitExpired;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const timeout = setTimeout(() => {
      setFontWaitExpired(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary title="App error">
        <AppProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome"   options={{ animation: 'none' }} />
            <Stack.Screen name="dashboard" options={{ animation: 'none' }} />
            <Stack.Screen name="direction" />
            <Stack.Screen name="my-lists" />
            <Stack.Screen name="add-list" />
            <Stack.Screen name="curated-list" />
            <Stack.Screen name="build-your-own" />
            <Stack.Screen name="random-list" />
            <Stack.Screen name="select-study-list" />
            <Stack.Screen name="deck-size" />
            <Stack.Screen name="stats" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="session" />
            <Stack.Screen name="vocab-bank" />
            <Stack.Screen name="add-word" />
            <Stack.Screen name="add-existing-word" />
          </Stack>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
