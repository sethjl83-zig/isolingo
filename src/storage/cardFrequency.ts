/**
 * Relative mix of Gender Matching, Word Relationships, and Production.
 * Percents are integers and always sum to 100.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardType } from '../types/cards';

export const CARD_FREQUENCY_KEY = '@isolingo/card_frequency';

export type CardFrequency = Record<CardType, number>;

export const DEFAULT_CARD_FREQUENCY: CardFrequency = {
  CARD_1001: 10,
  CARD_1002: 20,
  CARD_1006: 70,
};

const CARD_TYPES: CardType[] = ['CARD_1001', 'CARD_1002', 'CARD_1006'];

let cached: CardFrequency | null = null;

function clampPercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Scale three counts so they are integers that sum to 100. */
function scaleToHundred(counts: CardFrequency): CardFrequency {
  const sum = CARD_TYPES.reduce((total, type) => total + counts[type], 0);
  if (sum === 100) return { ...counts };
  if (sum <= 0) return { ...DEFAULT_CARD_FREQUENCY };

  const raw = CARD_TYPES.map(type => (counts[type] / sum) * 100);
  const floored = raw.map(value => Math.floor(value));
  let leftover = 100 - floored.reduce((total, value) => total + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - floored[index] }))
    .sort((a, b) => b.frac - a.frac);
  const assigned = [...floored];
  for (let i = 0; i < leftover; i += 1) {
    assigned[order[i].index] += 1;
  }
  return {
    CARD_1001: assigned[0],
    CARD_1002: assigned[1],
    CARD_1006: assigned[2],
  };
}

export function normalizeCardFrequency(raw: unknown): CardFrequency {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CARD_FREQUENCY };
  const record = raw as Partial<Record<CardType, unknown>>;
  return scaleToHundred({
    CARD_1001: clampPercent(record.CARD_1001),
    CARD_1002: clampPercent(record.CARD_1002),
    CARD_1006: clampPercent(record.CARD_1006),
  });
}

export function getCardFrequencySync(): CardFrequency {
  return { ...(cached ?? DEFAULT_CARD_FREQUENCY) };
}

export async function loadCardFrequency(): Promise<CardFrequency> {
  try {
    const raw = await AsyncStorage.getItem(CARD_FREQUENCY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cached = normalizeCardFrequency(parsed);
  } catch {
    cached = { ...DEFAULT_CARD_FREQUENCY };
  }
  return getCardFrequencySync();
}

export async function saveCardFrequency(frequency: CardFrequency): Promise<void> {
  const normalized = normalizeCardFrequency(frequency);
  cached = normalized;
  try {
    await AsyncStorage.setItem(CARD_FREQUENCY_KEY, JSON.stringify(normalized));
  } catch {
    // Best-effort.
  }
}

export async function clearCardFrequency(): Promise<void> {
  cached = null;
  try {
    await AsyncStorage.removeItem(CARD_FREQUENCY_KEY);
  } catch {
    // Best-effort.
  }
}
