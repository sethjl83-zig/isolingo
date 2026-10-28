import type { CardType } from '../types/cards';
import type { StudyType, DirectionMode } from '../types/state';
import type { Language } from '../types/vocab';
import { getCardFrequencySync } from '../storage/cardFrequency';

const MAX_CONSECUTIVE = 2;
// If Noun Production hasn't appeared in the last N cards, and it is still the
// user's largest share, prioritise it.
const PRODUCTION_PRIORITY_WINDOW = 3;

// ── Eligible types by direction + study type ──────────────────────────────────

export function getEligibleCardTypes(
  directionMode: DirectionMode,
  studyType?: StudyType,
  language?: Language,
): CardType[] {
  // CARD_1001 tests gender recognition — it is only eligible in gender mode.
  // In general vocab mode it is always excluded, regardless of direction.
  const isGenderMode = studyType === 'gender';

  if (directionMode === 'mixed') {
    return isGenderMode
      ? ['CARD_1006', 'CARD_1001', 'CARD_1002']
      : ['CARD_1006', 'CARD_1002'];
  }
  // Pure directional modes: only CARD_1006 is eligible
  return ['CARD_1006'];
}

// ── Main selection ────────────────────────────────────────────────────────────

/**
 * recentTypes: most-recent card types first (index 0 = last card played)
 */
export function selectCardType(
  studyType: StudyType,
  directionMode: DirectionMode,
  recentTypes: CardType[],
  language?: Language,
  card1002Available = true,
): CardType {
  let eligible = getEligibleCardTypes(directionMode, studyType, language);
  if (!card1002Available) {
    eligible = eligible.filter(t => t !== 'CARD_1002');
  }
  const dist = getCardFrequencySync();

  const productionIsDominant =
    dist.CARD_1006 > 0 &&
    dist.CARD_1006 >= dist.CARD_1001 &&
    dist.CARD_1006 >= dist.CARD_1002;

  // Prioritise CARD_1006 if it hasn't appeared recently and the user still wants it most.
  const recentWindow = recentTypes.slice(0, PRODUCTION_PRIORITY_WINDOW);
  if (
    productionIsDominant &&
    eligible.includes('CARD_1006') &&
    !recentWindow.includes('CARD_1006') &&
    recentWindow.length >= PRODUCTION_PRIORITY_WINDOW
  ) {
    return 'CARD_1006';
  }

  // Determine which type (if any) is currently blocked by the consecutive rule
  const lastType = recentTypes[0];
  const consecutiveCount = lastType
    ? recentTypes.filter((t, i) => i < MAX_CONSECUTIVE && t === lastType).length
    : 0;
  const blocked: CardType | null =
    consecutiveCount >= MAX_CONSECUTIVE ? lastType : null;

  const candidates = eligible.filter(t => t !== blocked && dist[t] > 0);
  if (candidates.length === 0) {
    const fallback = eligible.filter(t => t !== blocked);
    if (fallback.length === 0) return eligible[0] ?? 'CARD_1006';
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  const totalWeight = candidates.reduce((sum, t) => sum + dist[t], 0);
  let rand = Math.random() * totalWeight;

  for (const type of candidates) {
    rand -= dist[type];
    if (rand <= 0) return type;
  }

  return candidates[candidates.length - 1];
}
