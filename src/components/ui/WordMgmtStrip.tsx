/**
 * WordMgmtStrip — word-management row shown at the bottom of every study card.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Pressable, BackHandler } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeFonts } from '@/constants/homeFonts';
import { useSessionWordMgmt } from '@/src/context/SessionWordMgmtContext';
import WordFrequencyModal, { type WordFrequencyTarget } from './WordFrequencyModal';
import WordPickerModal from './WordPickerModal';

const BUTTONS = [
  { id: 'remove', label: 'Remove', icon: require('@/assets/images/gameplay/remove.png') },
  { id: 'replace', label: 'Replace', icon: require('@/assets/images/gameplay/replace.png') },
  { id: 'frequency', label: 'Frequency', icon: require('@/assets/images/gameplay/frequency.png') },
  { id: 'pause', label: 'Pause', icon: require('@/assets/images/gameplay/pause.png') },
] as const;

type PickerFlow = 'remove' | 'replace' | 'pause';

interface Props {
  words: WordFrequencyTarget[];
}

interface ConfirmDialog {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

const ConfirmContext = createContext<(dialog: ConfirmDialog) => void>(() => {});

export function WordMgmtConfirmHost({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmDialog | null>(null);

  useEffect(() => {
    if (!dialog) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDialog(null);
      return true;
    });
    return () => sub.remove();
  }, [dialog]);

  return (
    <ConfirmContext.Provider value={setDialog}>
      <View style={styles.host}>
        {children}
        {dialog ? (
          <Pressable style={styles.scrim} onPress={() => setDialog(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.copy}>
                <Text style={styles.title}>{dialog.title}</Text>
                {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.filled}
                  onPress={() => {
                    const confirm = dialog.onConfirm;
                    setDialog(null);
                    confirm?.();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.filledLabel}>{dialog.confirmLabel}</Text>
                </TouchableOpacity>
                {dialog.cancelLabel ? (
                  <TouchableOpacity
                    style={styles.outline}
                    onPress={() => setDialog(null)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.outlineLabel}>{dialog.cancelLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </ConfirmContext.Provider>
  );
}

export default function WordMgmtStrip({ words }: Props) {
  const insets = useSafeAreaInsets();
  const { removeWord, replaceWord, pauseWord, editsSavedDeck } = useSessionWordMgmt();
  const showConfirm = useContext(ConfirmContext);
  const [frequencyVisible, setFrequencyVisible] = useState(false);
  const [pickerFlow, setPickerFlow] = useState<PickerFlow | null>(null);

  const showRemoveConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      showConfirm({
        title: editsSavedDeck
          ? 'Remove this word from your deck?'
          : 'Skip this word for the rest of this session?',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => removeWord(word.id),
      });
    },
    [removeWord, editsSavedDeck, showConfirm],
  );

  const showReplaceConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      showConfirm({
        title: editsSavedDeck
          ? 'Replace this word in your deck?'
          : 'Replace this word in your current session?',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          const result = replaceWord(word.id);
          if (!result.success) {
            if (result.error === 'No other words are available in this list.') {
              showConfirm({ title: result.error, confirmLabel: 'OK' });
            } else {
              showConfirm({
                title: 'Could not replace word',
                message: result.error ?? 'Please try again.',
                confirmLabel: 'OK',
              });
            }
          }
        },
      });
    },
    [replaceWord, editsSavedDeck, showConfirm],
  );

  const showPauseConfirm = useCallback(
    (word: WordFrequencyTarget) => {
      showConfirm({
        title: 'Pause this word?',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          const result = pauseWord(word.id);
          if (!result.success) {
            showConfirm({
              title: 'Could not pause word',
              message: result.error ?? 'Please try again.',
              confirmLabel: 'OK',
            });
          }
        },
      });
    },
    [pauseWord, showConfirm],
  );

  const startFlow = useCallback(
    (flow: PickerFlow) => {
      if (words.length === 1) {
        if (flow === 'remove') showRemoveConfirm(words[0]);
        else if (flow === 'replace') showReplaceConfirm(words[0]);
        else showPauseConfirm(words[0]);
        return;
      }
      setPickerFlow(flow);
    },
    [words, showRemoveConfirm, showReplaceConfirm, showPauseConfirm],
  );

  const handleWordPicked = useCallback(
    (word: WordFrequencyTarget) => {
      const flow = pickerFlow;
      setPickerFlow(null);
      if (flow === 'remove') showRemoveConfirm(word);
      else if (flow === 'replace') showReplaceConfirm(word);
      else if (flow === 'pause') showPauseConfirm(word);
    },
    [pickerFlow, showRemoveConfirm, showReplaceConfirm, showPauseConfirm],
  );

  const pickerTitle =
    pickerFlow === 'replace'
      ? 'Which word would you like to replace?'
      : pickerFlow === 'pause'
      ? 'Which word would you like to pause?'
      : 'Which word would you like to remove?';

  return (
    <>
      <View style={[styles.strip, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {BUTTONS.map(btn => (
          <TouchableOpacity
            key={btn.id}
            style={styles.btn}
            onPress={() => {
              if (btn.id === 'frequency') setFrequencyVisible(true);
              if (btn.id === 'remove') startFlow('remove');
              if (btn.id === 'replace') startFlow('replace');
              if (btn.id === 'pause') startFlow('pause');
            }}
            activeOpacity={0.7}
          >
            <Image source={btn.icon} style={styles.icon} />
            <Text style={styles.label}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <WordFrequencyModal
        visible={frequencyVisible}
        words={words}
        onDismiss={() => setFrequencyVisible(false)}
      />

      <WordPickerModal
        visible={pickerFlow !== null}
        title={pickerTitle}
        words={words}
        onSelect={handleWordPicked}
        onDismiss={() => setPickerFlow(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    paddingTop: 243,
    paddingBottom: 24,
  },
  sheet: {
    width: 313,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  copy: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  title: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 22,
    color: '#25262B',
    textAlign: 'center',
  },
  message: {
    fontFamily: HomeFonts.interRegular,
    fontWeight: 'normal',
    fontSize: 14.8,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
  },
  actions: { gap: 10, alignItems: 'center', alignSelf: 'stretch' },
  filled: {
    width: 220,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5E51A4',
  },
  filledLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  outline: {
    width: 220,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5E51A4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  outlineLabel: {
    fontFamily: HomeFonts.interSemiBold,
    fontWeight: 'normal',
    fontSize: 16,
    lineHeight: 24,
    color: '#5E51A4',
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(210,232,215,0.8)',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  icon: { width: 14, height: 14 },
  label: {
    fontFamily: HomeFonts.jakartaSemiBold,
    fontWeight: 'normal',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0,0,0,0.6)',
  },
});
