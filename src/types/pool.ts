import type { Language, VocabItem } from './vocab';

/**
 * Per-word study frequency within a pool.
 * Intentionally mirrors WordFrequencySetting so the two can be used
 * interchangeably during migration without importing from state.ts.
 */
export type PoolWordFrequency = 'low' | 'normal' | 'high';

export type PoolCreatedVia = 'curated' | 'custom' | 'random';

/** Valid deck sizes a pool can be configured with. */
export type PoolDeckSize = 10 | 15 | 20 | 25;

/** A VocabItem bundled with its per-word study frequency for this pool. */
export interface PoolWord {
  item: VocabItem;
  frequency: PoolWordFrequency;
}

/**
 * A named vocabulary pool — the new source of truth replacing modeBanks.
 *
 * Each language may have any number of pools. Pools replace the old
 * two-bank-per-language model (general_vocab / gender).
 */
export interface Pool {
  /** Unique stable identifier (generated at creation time). */
  id: string;
  /** User-facing name shown in pool lists and pickers. */
  name: string;
  /** Target language this pool belongs to. */
  language: Language;
  /** Words in the pool, each carrying its own frequency setting. */
  words: PoolWord[];
  /**
   * Saved default number of words drawn per study session from this pool.
   * UI offers 10 / 15 / 20 / 25.
   */
  deckSize: PoolDeckSize;
  /** How the pool was originally created (reference only, not user-facing). */
  createdVia: PoolCreatedVia;
  /** IDs of words the user has temporarily paused from appearing in sessions. */
  pausedWordIds: string[];
}

/**
 * Maps study type + language → the pool ID(s) selected as the default for
 * that combination. An array allows future multi-pool sessions; for now
 * exactly one ID is expected.
 */
export interface DefaultPoolIds {
  general_vocab: Partial<Record<Language, string[]>>;
  gender: Partial<Record<Language, string[]>>;
}

export const EMPTY_DEFAULT_POOL_IDS: DefaultPoolIds = {
  general_vocab: {},
  gender: {},
};

// ── Pool creation utilities ───────────────────────────────────────────────────

/** Stable unique ID for a newly created pool. */
export function generatePoolId(): string {
  return `pool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Return the largest valid PoolDeckSize that does not exceed `n`.
 * This ensures a session deck never requests more words than the pool contains.
 *
 * Examples: 10→10, 12→10, 15→15, 17→15, 20→20, 22→20, 25+→25
 */
export function snapToDeckSize(n: number): PoolDeckSize {
  if (n >= 25) return 25;
  if (n >= 20) return 20;
  if (n >= 15) return 15;
  return 10; // minimum; also covers n < 10 as a safe fallback
}
