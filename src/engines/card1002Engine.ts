import type { VocabItem, Language } from '../types/vocab';
import type { Card1002Data, Card1002WordDisplay, DeterminerType, RelationshipType } from '../types/cards';
import { ALL_RELATIONSHIP_TYPES, isRelationshipType } from '../types/cards';
import { getRelationshipData } from '../data/relationships';
import { enrichVocabItemsFromMaster } from '../data';
import { getDisplayForm } from './articleHelper';
import { getPrimaryEnglish } from './genderedCounterpartHelper';
import type { Pool } from '../types/pool';

// Re-export labels from the canonical source in types/cards.ts
export {
  ALL_RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
  getRelationshipLabel,
  isRelationshipType,
} from '../types/cards';

// ── Context ─────────────────────────────────────────────────────────────────────

export interface Card1002Context {
  language: Language;
  activeBank: VocabItem[];
  extendedBankById: Map<string, VocabItem>;
  /** Card 1002 pair keys played most-recent first (for pair-level spacing). */
  recentPairKeys?: string[];
}

/** Minimum number of other Card 1002 pairs before a pair may repeat. */
export const CARD1002_PAIR_SPACING = 5;

export function getCard1002PairKey(itemA: VocabItem, itemB: VocabItem): string {
  return pairKey(itemA.id, itemB.id);
}

export function buildExtendedBankMap(
  language: Language,
  languagePools: Partial<Record<Language, Pool[]>>,
  activeBank: VocabItem[] = [],
): Map<string, VocabItem> {
  const raw: VocabItem[] = [];
  for (const pool of languagePools[language] ?? []) {
    for (const pw of pool.words) {
      raw.push(pw.item);
    }
  }
  if (raw.length === 0) {
    raw.push(...activeBank);
  }
  const enriched = enrichVocabItemsFromMaster(raw, language);
  return new Map(enriched.map(w => [w.id, w]));
}

// ── Pair bookkeeping ──────────────────────────────────────────────────────────

interface CandidatePair {
  type: RelationshipType;
  itemA: VocabItem;
  itemB: VocabItem;
  /** When true, word B is shown in English (self-translation same_meaning). */
  showEnglishForB: boolean;
  priority: number;
}

function pairKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
}

function isPairSpacingBlocked(key: string, recentPairKeys: string[]): boolean {
  return recentPairKeys.slice(0, CARD1002_PAIR_SPACING).includes(key);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickChoiceTypes(correct: RelationshipType): RelationshipType[] {
  const distractors = shuffle(
    ALL_RELATIONSHIP_TYPES.filter(t => t !== correct),
  ).slice(0, 3);
  return shuffle([correct, ...distractors]);
}

function nounTargetDisplay(
  item: VocabItem,
  language: Language,
): { displayForm: string; determinerType: DeterminerType | null } {
  if (item.partOfSpeech === 'noun' && item.gender) {
    if (language === 'de') {
      return { displayForm: item.lemma, determinerType: null };
    }
    return {
      displayForm: getDisplayForm(language, item.gender, item.lemma, 'definite'),
      determinerType: 'definite',
    };
  }
  return { displayForm: item.lemma, determinerType: null };
}

function buildWordDisplay(
  item: VocabItem,
  language: Language,
  asEnglish: boolean,
): Card1002WordDisplay {
  if (asEnglish) {
    return {
      item,
      displayText: getPrimaryEnglish(item),
      displayLanguage: 'english',
      determinerType: null,
    };
  }
  const { displayForm, determinerType } = nounTargetDisplay(item, language);
  return {
    item,
    displayText: displayForm,
    displayLanguage: 'target',
    determinerType,
  };
}

function buildKnownPairKeys(language: Language, extendedIds: Set<string>): Set<string> {
  const data = getRelationshipData(language);
  const keys = new Set<string>();

  const add = (id1: string, id2: string) => {
    if (extendedIds.has(id1) && extendedIds.has(id2)) {
      keys.add(pairKey(id1, id2));
    }
  };

  for (const p of data.antonyms) add(p.word1, p.word2);
  for (const p of data.related) add(p.word1, p.word2);
  for (const p of data.sameKind) add(p.word1, p.word2);
  for (const p of data.hyponyms) add(p.specific, p.general);

  return keys;
}

function collectCandidates(ctx: Card1002Context): CandidatePair[] {
  const { language, activeBank, extendedBankById } = ctx;
  const activeById = new Map(activeBank.map(w => [w.id, w]));
  const activeIds = new Set(activeBank.map(w => w.id));
  const extendedIds = new Set(extendedBankById.keys());
  const data = getRelationshipData(language);
  const candidates: CandidatePair[] = [];

  const addJsonPair = (
    type: RelationshipType,
    id1: string,
    id2: string,
    priority: number,
  ) => {
    if (!extendedIds.has(id1) || !extendedIds.has(id2)) return;
    const itemA = activeById.get(id1) ?? extendedBankById.get(id1);
    const itemB = activeById.get(id2) ?? extendedBankById.get(id2);
    if (!itemA || !itemB) return;
    const bothActive = activeIds.has(id1) && activeIds.has(id2);
    candidates.push({
      type,
      itemA,
      itemB,
      showEnglishForB: false,
      priority: bothActive ? priority + 10 : priority,
    });
  };

  for (const p of data.antonyms) addJsonPair('opposites', p.word1, p.word2, 5);
  for (const p of data.related) addJsonPair('go_hand_in_hand', p.word1, p.word2, 5);
  for (const p of data.sameKind) addJsonPair('same_kind', p.word1, p.word2, 5);
  for (const p of data.hyponyms) {
    addJsonPair('hyponym', p.specific, p.general, 5);
  }

  // same_meaning: word paired with its own English translation
  for (const item of activeBank) {
    candidates.push({
      type: 'same_meaning',
      itemA: item,
      itemB: item,
      showEnglishForB: true,
      priority: 8,
    });
  }

  // same_meaning: two active words sharing the same primary English gloss
  const byEnglish = new Map<string, VocabItem[]>();
  for (const item of activeBank) {
    const key = getPrimaryEnglish(item).toLowerCase();
    if (!byEnglish.has(key)) byEnglish.set(key, []);
    byEnglish.get(key)!.push(item);
  }
  for (const group of byEnglish.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        candidates.push({
          type: 'same_meaning',
          itemA: group[i],
          itemB: group[j],
          showEnglishForB: false,
          priority: 7,
        });
      }
    }
  }

  // no_clear_relationship: unrelated active words
  const knownKeys = buildKnownPairKeys(language, extendedIds);
  for (let i = 0; i < activeBank.length; i++) {
    for (let j = i + 1; j < activeBank.length; j++) {
      const a = activeBank[i];
      const b = activeBank[j];
      if (getPrimaryEnglish(a).toLowerCase() === getPrimaryEnglish(b).toLowerCase()) continue;
      if (knownKeys.has(pairKey(a.id, b.id))) continue;
      candidates.push({
        type: 'no_clear_relationship',
        itemA: a,
        itemB: b,
        showEnglishForB: false,
        priority: 4,
      });
    }
  }

  return candidates;
}

export function countCard1002ValidPairs(ctx: Card1002Context): number {
  return collectCandidates(ctx).length;
}

export function isCard1002Available(ctx: Card1002Context): boolean {
  return countCard1002ValidPairs(ctx) >= 2;
}

function pickCandidate(candidates: CandidatePair[]): CandidatePair | null {
  if (candidates.length === 0) return null;
  const maxPriority = Math.max(...candidates.map(c => c.priority));
  const top = candidates.filter(c => c.priority === maxPriority);
  return top[Math.floor(Math.random() * top.length)];
}

export function generateCard1002(ctx: Card1002Context): Card1002Data | null {
  const candidates = collectCandidates(ctx);
  const recentPairKeys = ctx.recentPairKeys ?? [];
  let eligible = candidates.filter(
    c => !isPairSpacingBlocked(pairKey(c.itemA.id, c.itemB.id), recentPairKeys),
  );
  if (eligible.length === 0) eligible = candidates;

  const picked = pickCandidate(eligible);
  if (!picked) return null;

  let showEnglishForB = picked.showEnglishForB;

  // For JSON-based pairs, randomly show word B in English ~35% of the time
  // (except same_meaning self-pair which always uses English for B).
  if (!showEnglishForB && picked.type !== 'no_clear_relationship' && picked.type !== 'hyponym') {
    if (picked.itemA.id !== picked.itemB.id && Math.random() < 0.35) {
      showEnglishForB = true;
    }
  }

  const wordA = buildWordDisplay(picked.itemA, ctx.language, false);
  const wordB = buildWordDisplay(picked.itemB, ctx.language, showEnglishForB);

  return {
    type: 'CARD_1002',
    wordA,
    wordB,
    itemA: picked.itemA,
    itemB: picked.itemB,
    correctRelationship: picked.type,
    choiceTypes: pickChoiceTypes(picked.type).filter(isRelationshipType),
  };
}
