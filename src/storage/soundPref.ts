/**
 * Sound-effects preference. Missing key means on.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOUND_ENABLED_KEY = '@isolingo/sound_enabled';

export async function getSoundEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Best-effort.
  }
}

export async function clearSoundEnabled(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SOUND_ENABLED_KEY);
  } catch {
    // Best-effort.
  }
}
