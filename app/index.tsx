/**

 * SCREEN 0001 — HOME

 * Language selection with flag buttons.

 * Returning users with a saved language go directly to Mode Select.

 */

import React, { useEffect, useRef } from 'react';

import {

  View,

  Text,

  TouchableOpacity,

  StyleSheet,

  useColorScheme,

  ActivityIndicator,

} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';

import { useAppContext } from '@/src/context/AppContext';

import type { Language } from '@/src/types/vocab';



const LANGUAGES: {

  id: Language;

  label: string;

  flag: string;

}[] = [

  { id: 'es', label: 'Spanish', flag: '🇪🇸' },

  { id: 'fr', label: 'French', flag: '🇫🇷' },

  { id: 'de', label: 'German', flag: '🇩🇪' },

];



export default function HomeScreen() {

  const router = useRouter();

  const { state, isReady, showLanguagePicker, selectLanguage } = useAppContext();

  const scheme = useColorScheme() ?? 'light';

  const palette = Colors[scheme];

  const hasAutoRouted = useRef(false);



  const isReturningUser = state.languageSelected !== null;



  useEffect(() => {

    if (!isReady || hasAutoRouted.current || showLanguagePicker) return;

    if (isReturningUser) {

      hasAutoRouted.current = true;

      router.replace('/study-type');

    }

  }, [isReady, isReturningUser, showLanguagePicker, router]);



  const handleSelect = (lang: Language) => {

    selectLanguage(lang);

    router.replace('/study-type');

  };



  if (!isReady || (isReturningUser && !showLanguagePicker)) {

    return (

      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>

        <View style={styles.loading}>

          <ActivityIndicator size="large" color={palette.tint} />

        </View>

      </SafeAreaView>

    );

  }



  return (

    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>

      <View style={styles.container}>

        <Text style={[styles.welcome, { color: palette.text }]}>Welcome!</Text>

        <Text style={[styles.subtitle, { color: palette.subtext }]}>

          Please choose your language

        </Text>



        <View style={styles.buttonGroup}>

          {LANGUAGES.map(lang => (

            <TouchableOpacity

              key={lang.id}

              style={[

                styles.langButton,

                { backgroundColor: palette.card, borderColor: palette.border },

              ]}

              onPress={() => handleSelect(lang.id)}

              activeOpacity={0.75}

            >

              <View style={styles.flagContainer}>

                <Text style={styles.flagEmoji}>{lang.flag}</Text>

              </View>

              <Text style={[styles.langLabel, { color: palette.text }]}>

                {lang.label}

              </Text>

            </TouchableOpacity>

          ))}

        </View>

      </View>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  safe: { flex: 1 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  container: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 32,

    gap: 16,

  },

  welcome: { fontSize: 32, fontWeight: '700', marginBottom: 4 },

  subtitle: { fontSize: 16, marginBottom: 24 },

  buttonGroup: { width: '100%', gap: 16 },

  langButton: {

    flexDirection: 'row',

    alignItems: 'center',

    borderRadius: 14,

    borderWidth: 1,

    overflow: 'hidden',

    height: 68,

  },

  flagContainer: {

    width: 80,

    height: '100%',

    alignItems: 'center',

    justifyContent: 'center',

  },

  flagEmoji: { fontSize: 40 },

  langLabel: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },

});

