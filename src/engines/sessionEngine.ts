import type { CardData, CardType } from '../types/cards';
import type { AppState, DirectionMode } from '../types/state';
import { selectCardType } from './cardRotationEngine';
import { generateCard, generateCard1006, isIdenticalToEnglish } from './cardGenerator';
import { buildDeck, selectFromDeck, getMinSpacing } from './repetitionEngine';
import type { VocabItem } from '../types/vocab';

// ── Session state ─────────────────────────────────────────────────────────────

export interface SessionState {
  /** Card types in reverse-chronological order (index 0 = most recent). */
  recentCardTypes: CardType[];
  /** Directions in reverse-chronological order. */
  recentDirections: string[];
  /**
   * Word IDs of the last ~40 cards played, most-recent first.
   * Used to enforce the unique-word spacing rule between repeats.
   */
  recentWordIds: string[];
  /**
   * Noun IDs that appeared on the most-recently completed Card1001.
   * The next Card1001 must not use the exact same group.
   */
  lastCard1001NounIds: string[];
  /** Remaining entries in the current frequency cycle deck (word IDs). */
  deck: string[];
  /** Fingerprint of the bank when the deck was built; triggers a rebuild on change. */
  deckBankHash: string;
}

export function makeSessionState(): SessionState {
  return {
    recentCardTypes: [],
    recentDirections: [],
    recentWordIds: [],
    lastCard1001NounIds: [],
    deck: [],
    deckBankHash: '',
  };
}

// ── Direction resolution ──────────────────────────────────────────────────────

function resolveDirection(
  directionMode: DirectionMode,
  recentDirections: string[],
): 'native_to_target' | 'target_to_native' {
  if (directionMode === 'native_to_target') return 'native_to_target';
  if (directionMode === 'target_to_native') return 'target_to_native';

  // Mixed: avoid 3+ consecutive same direction
  const last3 = recentDirections.slice(0, 3);
  if (last3.length >= 3 && last3.every(d => d === last3[0])) {
    return last3[0] === 'native_to_target' ? 'target_to_native' : 'native_to_target';
  }
  return Math.random() < 0.5 ? 'native_to_target' : 'target_to_native';
}

// ── Bank utilities ────────────────────────────────────────────────────────────

function computeBankHash(bank: VocabItem[]): string {
  return bank.map(w => w.id).sort().join(',');
}

// ── Card generation ───────────────────────────────────────────────────────────

/**
 * Generates the next study card.
 * Returns both the card and an updated session that includes the deck
 * advancement (so the same word is not picked again until it cycles back).
 * Returns `{ card: null, updatedSession }` when no card can be produced.
 */
export function generateNextCard(
  state: AppState,
  session: SessionState,
): { card: CardData | null; updatedSession: SessionState } {
  const {
    languageSelected,
    studyTypeSelected,
    directionMode,
    activeVocabBank,
    wordStats,
    wordFrequencySettings,
    sessionCardIndex,
  } = state;

  if (!languageSelected || !studyTypeSelected) {
    return { card: null, updatedSession: session };
  }

  // Bank for this study type
  const bank: VocabItem[] =
    studyTypeSelected === 'gender'
      ? activeVocabBank.filter(w => w.partOfSpeech === 'noun' && w.gender !== null)
      : activeVocabBank;

  if (bank.length === 0) return { card: null, updatedSession: session };

  // ── Deck management ──────────────────────────────────────────────────────
  const bankHash = computeBankHash(bank);
  let deck = session.deck;
  if (session.deckBankHash !== bankHash || deck.length === 0) {
    deck = buildDeck(bank, wordFrequencySettings);
  }

  const bankById = new Map<string, VocabItem>(bank.map(w => [w.id, w]));
  const minSpacing = getMinSpacing(bank.length);

  // ── Card type & direction ─────────────────────────────────────────────────
  const cardType = selectCardType(studyTypeSelected, directionMode, session.recentCardTypes);
  const direction = resolveDirection(directionMode, session.recentDirections);

  // ── Identical-word exclusion set (t-t-n, non-gender mode only) ────────────
  // In gender mode the user is tested on gender not translation, so identical
  // words like "Hotel" → "hotel" are still educationally valid.
  const identicalIds =
    direction === 'target_to_native' && studyTypeSelected !== 'gender'
      ? new Set(bank.filter(isIdenticalToEnglish).map(w => w.id))
      : new Set<string>();

  // ── Word selection for Card1006 (deck-based) ──────────────────────────────
  let updatedDeck = deck;
  let preSelectedItem: VocabItem | undefined;

  if (cardType === 'CARD_1006') {
    // Build the working deck for this card:
    // 1. For German native_to_target, restrict to nouns (so gender tiles appear).
    // 2. For target_to_native (non-gender), strip trivially obvious words.
    let targetDeck = deck;

    if (languageSelected === 'de' && direction === 'native_to_target') {
      const nounIds = new Set(
        bank.filter(w => w.partOfSpeech === 'noun' && w.gender !== null).map(w => w.id),
      );
      const nounDeck = deck.filter(id => nounIds.has(id));
      if (nounDeck.length > 0) targetDeck = nounDeck;
    }

    if (identicalIds.size > 0) {
      const filtered = targetDeck.filter(id => !identicalIds.has(id));
      // Only narrow the pool if it leaves at least one candidate
      if (filtered.length > 0) targetDeck = filtered;
    }

    let result = selectFromDeck(targetDeck, bankById, session.recentWordIds, minSpacing);

    if (!result) {
      // Deck exhausted or all words spacing-blocked — rebuild and retry
      let freshDeck = buildDeck(bank, wordFrequencySettings);
      if (identicalIds.size > 0) {
        const filtered = freshDeck.filter(id => !identicalIds.has(id));
        if (filtered.length > 0) freshDeck = filtered;
      }
      result = selectFromDeck(freshDeck, bankById, session.recentWordIds, minSpacing);
      if (result) updatedDeck = result.remainingDeck;
    } else {
      // Remove selected entry from the ORIGINAL full deck (targetDeck may be a subset)
      const selectedId = result.item.id;
      const origIdx = deck.indexOf(selectedId);
      updatedDeck =
        origIdx >= 0
          ? [...deck.slice(0, origIdx), ...deck.slice(origIdx + 1)]
          : result.remainingDeck;
    }

    if (result) preSelectedItem = result.item;
  }

  // ── Generate card ─────────────────────────────────────────────────────────
  let card = generateCard(
    cardType,
    bank,
    languageSelected,
    direction,
    wordStats,
    sessionCardIndex,
    wordFrequencySettings,
    session.recentWordIds,
    new Set(session.lastCard1001NounIds),
    preSelectedItem,
    studyTypeSelected,
  );

  // ── Absolute last-resort fallback ─────────────────────────────────────────
  // generateCard should never return null when the bank is non-empty, but if
  // spacing or filtering constraints somehow exhaust all candidates we pick any
  // bank word and create a Card1006 directly so the session never hard-fails.
  if (!card && bank.length > 0) {
    const fallbackItem =
      preSelectedItem ??
      bank[Math.floor(Math.random() * bank.length)];
    card = generateCard1006(fallbackItem, languageSelected, direction);
  }

  const updatedSession: SessionState = {
    ...session,
    deck: updatedDeck,
    deckBankHash: bankHash,
  };

  return { card, updatedSession };
}

// ── Session advancement ───────────────────────────────────────────────────────

/**
 * Call this after a card result is recorded to keep session history up to date.
 *
 * @param wordIds   IDs of all vocab words that appeared on the card.
 *                  Card1006: [item.id]
 *                  Card1001: all noun IDs in the group
 *                  Card1002: [targetItem.id]
 * @param isCard1001 Pass true when the card type is CARD_1001 so the noun
 *                   group is saved for the consecutive-group check.
 */
export function advanceSession(
  session: SessionState,
  cardType: CardType,
  direction: string,
  wordIds: string[] = [],
  isCard1001: boolean = false,
): SessionState {
  const MAX_RECENT_WORD_IDS = 40;

  // Prepend new word IDs (most-recent first), deduplicate by keeping first occurrence
  const combined = [...wordIds, ...session.recentWordIds];
  const seen = new Set<string>();
  const newRecentWordIds: string[] = [];
  for (const id of combined) {
    if (!seen.has(id)) {
      seen.add(id);
      newRecentWordIds.push(id);
    }
    if (newRecentWordIds.length >= MAX_RECENT_WORD_IDS) break;
  }

  return {
    ...session,
    recentCardTypes: [cardType, ...session.recentCardTypes].slice(0, 10),
    recentDirections: [direction, ...session.recentDirections].slice(0, 10),
    recentWordIds: newRecentWordIds,
    lastCard1001NounIds: isCard1001 ? wordIds : session.lastCard1001NounIds,
  };
}
