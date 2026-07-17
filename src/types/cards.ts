import type { VocabItem } from './vocab';

export type CardType = 'CARD_1001' | 'CARD_1002' | 'CARD_1006';

// ── Card 1001 — Matching (Gender Anchoring) ──────────────────────────────────

export interface MatchingNoun {
  item: VocabItem;
  displayForm: string; // bare noun (DE) or "le chien" / "el perro" (FR/ES)
}

export interface Card1001Data {
  type: 'CARD_1001';
  nouns: MatchingNoun[];
}

// ── Card 1002 — Vocab Relationship Judgment ───────────────────────────────────

export type RelationshipType =
  | 'opposites'
  | 'go_hand_in_hand'
  | 'same_meaning'
  | 'same_kind'
  | 'hyponym'
  | 'no_clear_relationship';

/** Canonical answer-button labels for Card 1002. */
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  opposites: "They're opposites",
  go_hand_in_hand: 'They go hand in hand',
  same_meaning: 'They mean the same thing',
  same_kind: "They're different kinds of the same thing",
  hyponym: 'One is a type of the other',
  no_clear_relationship: 'No clear relationship',
};

export const ALL_RELATIONSHIP_TYPES: RelationshipType[] = [
  'opposites',
  'go_hand_in_hand',
  'same_meaning',
  'same_kind',
  'hyponym',
  'no_clear_relationship',
];

export function isRelationshipType(value: string): value is RelationshipType {
  return (ALL_RELATIONSHIP_TYPES as string[]).includes(value);
}

export function getRelationshipLabel(type: RelationshipType): string {
  return RELATIONSHIP_LABELS[type];
}

export interface Card1002WordDisplay {
  item: VocabItem;
  displayText: string;
  displayLanguage: 'target' | 'english';
  determinerType: DeterminerType | null;
}

export interface Card1002Data {
  type: 'CARD_1002';
  wordA: Card1002WordDisplay;
  wordB: Card1002WordDisplay;
  itemA: VocabItem;
  itemB: VocabItem;
  correctRelationship: RelationshipType;
  /** Four relationship types shown as answer buttons (includes the correct one). */
  choiceTypes: RelationshipType[];
}

// ── Card 1006 — Noun/Vocab Production ─────────────────────────────────────────

export type DeterminerType = 'definite' | 'indefinite' | 'possessive';

/** Possessive determiner person — only used when determinerType is 'possessive'. */
export type PossessivePerson = 'first' | 'second' | 'formal_second' | 'third';

export interface Card1006Data {
  type: 'CARD_1006';
  item: VocabItem;
  direction: 'native_to_target' | 'target_to_native';
  determinerType: DeterminerType | null; // FR/ES noun cards
  possessivePerson: PossessivePerson | null; // FR/ES when determinerType is 'possessive'
  prompt: string;
  canonicalAnswer: string;
  acceptedAnswers: string[];
}

export type CardData = Card1001Data | Card1002Data | Card1006Data;
