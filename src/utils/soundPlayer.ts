/**
 * Correct and incorrect answer sounds.
 * Stays silent when Settings has sound off, and never throws if playback fails.
 */
import { Audio } from 'expo-av';
import { getSoundEnabled } from '@/src/storage/soundPref';

const sources = {
  correct: require('../../assets/Sounds/Correct.wav'),
  incorrect: require('../../assets/Sounds/Incorrect.wav'),
} as const;

type Cue = keyof typeof sources;

const loaded: Partial<Record<Cue, Audio.Sound>> = {};
const loading: Partial<Record<Cue, Promise<Audio.Sound | null>>> = {};

async function loadCue(cue: Cue): Promise<Audio.Sound | null> {
  const existing = loaded[cue];
  if (existing) return existing;
  const pending = loading[cue];
  if (pending) return pending;

  const request = Audio.Sound.createAsync(sources[cue])
    .then(({ sound }) => {
      loaded[cue] = sound;
      return sound;
    })
    .catch(() => null)
    .finally(() => {
      delete loading[cue];
    });
  loading[cue] = request;
  return request;
}

async function play(cue: Cue): Promise<void> {
  try {
    const enabled = await getSoundEnabled();
    if (!enabled) return;
    const sound = await loadCue(cue);
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // Sound is optional. A missing file or audio error must not interrupt the card.
  }
}

export function playCorrect(): void {
  void play('correct');
}

export function playIncorrect(): void {
  void play('incorrect');
}
