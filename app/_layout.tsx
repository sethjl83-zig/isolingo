import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/src/context/AppContext';
import ErrorBoundary from '@/src/components/ErrorBoundary';

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ErrorBoundary title="App error">
        <AppProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome"   options={{ animation: 'none' }} />
            <Stack.Screen name="dashboard" options={{ animation: 'none' }} />
            <Stack.Screen name="direction" />
            <Stack.Screen name="word-banks" />
            <Stack.Screen name="my-lists" />
            <Stack.Screen name="add-list" />
            <Stack.Screen name="curated-list" />
            <Stack.Screen name="build-your-own" />
            <Stack.Screen name="random-list" />
            <Stack.Screen name="select-study-list" />
            <Stack.Screen name="deck-size" />
            <Stack.Screen name="stats" />
            <Stack.Screen name="list-setup" />
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
