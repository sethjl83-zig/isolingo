/**
 * Removes every persisted Akuity value so the next launch looks like a first run.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPersistedState } from './persistedState';
import { clearDeckSizePrefs } from './deckSizePrefs';
import { clearAllSavedDecks } from './savedDecks';
import { clearAllStats } from './statsStorage';
import { clearSoundEnabled } from './soundPref';

const USER_NAME_KEY = '@isolingo/user_name';
const CELEBRATION_PENDING_KEY = '@isolingo/celebration_pending';

export async function wipeAppData(): Promise<void> {
  await Promise.all([
    clearPersistedState(),
    clearDeckSizePrefs(),
    clearAllSavedDecks(),
    clearAllStats(),
    clearSoundEnabled(),
    AsyncStorage.multiRemove([USER_NAME_KEY, CELEBRATION_PENDING_KEY]).catch(() => {}),
  ]);
}
