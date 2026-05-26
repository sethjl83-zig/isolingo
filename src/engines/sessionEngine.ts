import type { CardData, CardType } from '../types/cards';
import type { AppState, DirectionMode } from '../types/state';
import { selectCardType } from './cardRotationEngine';
import { generateCard } from './cardGenerator';

export interface SessionState {
  recentCardTypes: CardType[];   // most-recent first
  recentDirections: string[];    // most-recent first
}

export function makeSessionState(): SessionState {
  return { recentCardTypes: [], recentDirections: [] };
}

// Pick a direction for the next card
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

export function generateNextCard(
  state: AppState,
  session: SessionState,
): CardData | null {
  const {
    languageSelected,
    studyTypeSelected,
    directionMode,
    activeVocabBank,
    wordStats,
    wordFrequencySettings,
    sessionCardIndex,
  } = state;

  if (!languageSelected || !studyTypeSelected) return null;

  // Filter bank by study type
  const bank =
    studyTypeSelected === 'gender'
      ? activeVocabBank.filter(w => w.partOfSpeech === 'noun' && w.gender !== null)
      : activeVocabBank;

  if (bank.length === 0) return null;

  const cardType = selectCardType(
    studyTypeSelected,
    directionMode,
    session.recentCardTypes,
  );

  const direction = resolveDirection(directionMode, session.recentDirections);

  return generateCard(
    cardType,
    bank,
    languageSelected,
    direction,
    wordStats,
    sessionCardIndex,
    wordFrequencySettings,
  );
}

/** Call this after a card is resolved to keep session history up to date. */
export function advanceSession(
  session: SessionState,
  cardType: CardType,
  direction: string,
): SessionState {
  return {
    recentCardTypes: [cardType, ...session.recentCardTypes].slice(0, 10),
    recentDirections: [direction, ...session.recentDirections].slice(0, 10),
  };
}
