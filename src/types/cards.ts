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
  | 'same_meaning'
  | 'same_category'
  | 'similar_form'
  | 'no_clear_relationship';

export interface Card1002Data {
  type: 'CARD_1002';
  englishWord: string;
  targetWord: string;            // display form (with article for FR/ES nouns)
  targetItem: VocabItem;
  targetDeterminerType: DeterminerType | null; // FR/ES nouns only
  correctRelationship: RelationshipType;
}

// ── Card 1006 — Noun/Vocab Production ─────────────────────────────────────────

export type DeterminerType = 'definite' | 'indefinite' | 'possessive';

export interface Card1006Data {
  type: 'CARD_1006';
  item: VocabItem;
  direction: 'native_to_target' | 'target_to_native';
  determinerType: DeterminerType | null; // FR/ES native_to_target only
  prompt: string;
  canonicalAnswer: string;
  acceptedAnswers: string[];
}

export type CardData = Card1001Data | Card1002Data | Card1006Data;
