/**
 * SCREEN — SETTINGS
 * Sound preference, card frequency, links, and Start Over. Opened from the Home gear.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CommonActions, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { HomeFonts } from '@/constants/homeFonts';
import { useAppContext } from '@/src/context/AppContext';
import { getSoundEnabled, setSoundEnabled } from '@/src/storage/soundPref';
import {
  loadCardFrequency,
  saveCardFrequency,
  DEFAULT_CARD_FREQUENCY,
  type CardFrequency,
} from '@/src/storage/cardFrequency';
import type { CardType } from '@/src/types/cards';
import { useAndroidBackHandler } from '@/src/hooks/useAndroidBackHandler';
import { discardBuildYourOwnDraft } from './build-your-own';

const backChevron = require('@/assets/images/lists/back-chevron.png');
const rowChevron = require('@/assets/images/lists/row-chevron.png');

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const PRIVACY_URL = 'https://akuity.app/privacy';
const SUPPORT_MAIL = 'mailto:support@akuity.app';
const FEATURE_MAIL = 'mailto:support@akuity.app?subject=Feature%20Request';
const RATE_URL = 'https://apps.apple.com/app/id6792583710';

const FREQUENCY_ROWS: { type: CardType; label: string }[] = [
  { type: 'CARD_1001', label: 'Gender Matching' },
  { type: 'CARD_1002', label: 'Word Relationships' },
  { type: 'CARD_1006', label: 'Production' },
];

function stepFrequency(current: CardFrequency, type: CardType, delta: number): CardFrequency {
  const next = Math.max(0, Math.min(100, current[type] + delta));
  return { ...current, [type]: next };
}

function PercentStepper({
  label,
  value,
  onStep,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepBtn, value <= 0 && styles.stepBtnDisabled]}
          onPress={() => onStep(-1)}
          disabled={value <= 0}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.stepBtnLabel}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}%</Text>
        <TouchableOpacity
          style={[styles.stepBtn, value >= 100 && styles.stepBtnDisabled]}
          onPress={() => onStep(1)}
          disabled={value >= 100}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.stepBtnLabel}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Couldn’t open that link');
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { resetApp } = useAppContext();
  const [soundOn, setSoundOn] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [frequency, setFrequency] = useState<CardFrequency>(DEFAULT_CARD_FREQUENCY);
  const frequencyTotal = frequency.CARD_1001 + frequency.CARD_1002 + frequency.CARD_1006;
  const frequencyValid = frequencyTotal === 100;

  useEffect(() => {
    let cancelled = false;
    getSoundEnabled().then(enabled => {
      if (!cancelled) setSoundOn(enabled);
    });
    loadCardFrequency().then(saved => {
      if (!cancelled) setFrequency(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useAndroidBackHandler(
    useCallback(() => {
      if (wiping) return true;
      handleBack();
      return true;
    }, [handleBack, wiping]),
  );

  const handleSound = (enabled: boolean) => {
    setSoundOn(enabled);
    void setSoundEnabled(enabled);
  };

  const handleFrequencyStep = (type: CardType, delta: number) => {
    setFrequency(current => stepFrequency(current, type, delta));
  };

  const handleResetFrequency = () => {
    setFrequency({ ...DEFAULT_CARD_FREQUENCY });
  };

  const handleSaveFrequency = () => {
    if (frequency.CARD_1001 + frequency.CARD_1002 + frequency.CARD_1006 !== 100) return;
    void saveCardFrequency(frequency);
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start Over',
      'This will delete all your lists, progress, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            void confirmStartOver();
          },
        },
      ],
    );
  };

  const confirmStartOver = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      await resetApp();
      discardBuildYourOwnDraft();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'welcome' }],
        }),
      );
    } catch {
      setWiping(false);
      Alert.alert('Couldn’t start over', 'Your data is still on this device. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={8}
          accessibilityLabel="Back"
          disabled={wiping}
        >
          <Image source={backChevron} style={styles.backIcon} accessibilityIgnoresInvertColors />
        </TouchableOpacity>
        <Text style={styles.screenTitle} pointerEvents="none">Settings</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.card}>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Sound Effects</Text>
          <Switch
            value={soundOn}
            onValueChange={handleSound}
            trackColor={{ false: '#E0DCF0', true: '#5E51A4' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0DCF0"
            accessibilityLabel="Sound Effects"
          />
        </View>
      </View>

      <View style={[styles.card, styles.freqCard]}>
        <Text style={styles.sectionTitle}>Card Frequency</Text>
        {FREQUENCY_ROWS.map(row => (
          <PercentStepper
            key={row.type}
            label={row.label}
            value={frequency[row.type]}
            onStep={delta => handleFrequencyStep(row.type, delta)}
          />
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.stepperLabel}>Total</Text>
          <Text style={[styles.totalValue, frequencyValid ? styles.totalValid : styles.totalInvalid]}>
            {frequencyTotal}%
          </Text>
        </View>
        {frequencyValid ? null : (
          <Text style={styles.totalWarning}>Percentages must add up to 100%</Text>
        )}
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleResetFrequency}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Reset to Recommended"
        >
          <Text style={styles.resetLabel}>Reset to Recommended</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !frequencyValid && styles.saveBtnDisabled]}
          onPress={handleSaveFrequency}
          disabled={!frequencyValid}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !frequencyValid }}
        >
          <Text style={[styles.saveLabel, !frequencyValid && styles.saveLabelDisabled]}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={handleStartOver}
          activeOpacity={0.7}
          disabled={wiping}
          accessibilityRole="button"
          accessibilityLabel="Start Over"
        >
          <Text style={styles.destructiveLabel}>Start Over</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => openExternal(PRIVACY_URL)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Image source={rowChevron} style={styles.chevron} accessibilityIgnoresInvertColors />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => openExternal(SUPPORT_MAIL)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Contact Support"
        >
          <Text style={styles.rowLabel}>Contact Support</Text>
          <Image source={rowChevron} style={styles.chevron} accessibilityIgnoresInvertColors />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => openExternal(FEATURE_MAIL)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Request a Feature"
        >
          <Text style={styles.rowLabel}>Request a Feature</Text>
          <Image source={rowChevron} style={styles.chevron} accessibilityIgnoresInvertColors />
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            style={styles.row}
            onPress={() => openExternal(RATE_URL)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Rate Akuity"
          >
            <Text style={styles.rowLabel}>Rate Akuity</Text>
            <Image source={rowChevron} style={styles.chevron} accessibilityIgnoresInvertColors />
          </TouchableOpacity>
        ) : null}

        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F5FD' },
  topBar: {
    height: 39,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,81,164,0.15)',
  },
  backIcon: {
    width: 17,
    height: 17,
    transform: [{ rotate: '-90deg' }],
  },
  topBarSpacer: { width: 36, height: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  screenTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 24,
    lineHeight: 29,
    color: '#25262B',
  },
  card: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#FEFEFE',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: {
    flex: 1,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
  },
  destructiveLabel: {
    flex: 1,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#F74856',
  },
  versionValue: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(0,0,0,0.6)',
  },
  chevron: {
    width: 14,
    height: 13,
    transform: [{ rotate: '90deg' }],
  },
  freqCard: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepperLabel: {
    flex: 1,
    fontFamily: HomeFonts.interMedium,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
  },
  stepper: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 20,
    lineHeight: 24,
    color: '#5E51A4',
  },
  stepValue: {
    minWidth: 52,
    textAlign: 'center',
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#25262B',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalValue: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
  },
  totalValid: { color: '#38A19A' },
  totalInvalid: { color: '#F74856' },
  totalWarning: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20,
    color: '#F74856',
  },
  resetBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#5E51A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(94,81,164,0.4)' },
  saveLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  saveLabelDisabled: { color: '#636265' },
});
