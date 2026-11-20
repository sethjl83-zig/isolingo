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
  excludedWordIds?: ReadonlySet<string>,
): Map<string, VocabItem> {
  // Every word the user has in any list for this language. Paused words and
  // words removed in this session stay out. The master list is not a source.
  const rawById = new Map<string, VocabItem>();
  for (const pool of languagePools[language] ?? []) {
    const paused = new Set(pool.pausedWordIds ?? []);
    for (const pw of pool.words) {
      if (excludedWordIds?.has(pw.item.id)) continue;
      if (paused.has(pw.item.id)) continue;
      if (!rawById.has(pw.item.id)) rawById.set(pw.item.id, pw.item);
    }
  }
  if (rawById.size === 0) {
    for (const item of activeBank) {
      if (excludedWordIds?.has(item.id)) continue;
      if (!rawById.has(item.id)) rawById.set(item.id, item);
    }
  }
  const enriched = enrichVocabItemsFromMaster([...rawById.values()], language);
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

/** Both words in the deck, then one, then a pair that only sits in the user's lists. */
function deckPriority(idA: string, idB: string, deckIds: Set<string>): number {
  const aInDeck = deckIds.has(idA);
  const bInDeck = deckIds.has(idB);
  if (aInDeck && bInDeck) return 2;
  if (aInDeck || bInDeck) return 1;
  return 0;
}

/**
 * same_meaning is dealt half as often as each other type. The rest are equal.
 * Integer weights keep the half exact: 1 against 2.
 */
const RELATIONSHIP_DRAW_WEIGHT: Record<RelationshipType, number> = {
  opposites: 2,
  go_hand_in_hand: 2,
  same_kind: 2,
  hyponym: 2,
  no_clear_relationship: 2,
  same_meaning: 1,
};

function listWords(ctx: Card1002Context): VocabItem[] {
  const byId = new Map(ctx.extendedBankById);
  for (const item of ctx.activeBank) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function collectTypedPairs(ctx: Card1002Context): CandidatePair[] {
  const { language } = ctx;
  const words = listWords(ctx);
  const byId = new Map(words.map(w => [w.id, w]));
  const deckIds = new Set(ctx.activeBank.map(w => w.id));
  const data = getRelationshipData(language);
  const candidates: CandidatePair[] = [];

  const addJsonPair = (type: RelationshipType, id1: string, id2: string) => {
    const itemA = byId.get(id1);
    const itemB = byId.get(id2);
    if (!itemA || !itemB) return;
    candidates.push({
      type,
      itemA,
      itemB,
      showEnglishForB: false,
      priority: deckPriority(itemA.id, itemB.id, deckIds),
    });
  };

  for (const p of data.antonyms) addJsonPair('opposites', p.word1, p.word2);
  for (const p of data.related) addJsonPair('go_hand_in_hand', p.word1, p.word2);
  for (const p of data.sameKind) addJsonPair('same_kind', p.word1, p.word2);
  for (const p of data.hyponyms) addJsonPair('hyponym', p.specific, p.general);

  for (const item of words) {
    candidates.push({
      type: 'same_meaning',
      itemA: item,
      itemB: item,
      showEnglishForB: true,
      priority: deckPriority(item.id, item.id, deckIds),
    });
  }

  const byEnglish = new Map<string, VocabItem[]>();
  for (const item of words) {
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
          priority: deckPriority(group[i].id, group[j].id, deckIds),
        });
      }
    }
  }

  return candidates;
}

function isUnrelated(a: VocabItem, b: VocabItem, knownKeys: Set<string>): boolean {
  if (a.id === b.id) return false;
  if (getPrimaryEnglish(a).toLowerCase() === getPrimaryEnglish(b).toLowerCase()) return false;
  if (knownKeys.has(pairKey(a.id, b.id))) return false;
  return true;
}

/** Stop once `need` genuinely unrelated pairs have been found. */
function hasUnrelatedPairs(ctx: Card1002Context, need: number): boolean {
  if (need <= 0) return true;
  const words = listWords(ctx);
  const knownKeys = buildKnownPairKeys(ctx.language, new Set(words.map(w => w.id)));
  let found = 0;
  for (let i = 0; i < words.length && found < need; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (!isUnrelated(words[i], words[j], knownKeys)) continue;
      found += 1;
      if (found >= need) return true;
    }
  }
  return false;
}

function reservoirUnrelated(
  left: VocabItem[],
  right: VocabItem[],
  sameList: boolean,
  knownKeys: Set<string>,
  recentPairKeys: string[],
  freshOnly: boolean,
  priority: number,
): CandidatePair | null {
  let count = 0;
  let picked: CandidatePair | null = null;
  const consider = (a: VocabItem, b: VocabItem) => {
    if (!isUnrelated(a, b, knownKeys)) return;
    if (freshOnly && isPairSpacingBlocked(pairKey(a.id, b.id), recentPairKeys)) return;
    count += 1;
    if (Math.random() < 1 / count) {
      picked = {
        type: 'no_clear_relationship',
        itemA: a,
        itemB: b,
        showEnglishForB: false,
        priority,
      };
    }
  };
  if (sameList) {
    for (let i = 0; i < left.length; i++) {
      for (let j = i + 1; j < left.length; j++) consider(left[i], left[j]);
    }
  } else {
    for (const a of left) {
      for (const b of right) consider(a, b);
    }
  }
  return picked;
}

/**
 * Prefer a pair with both words in the deck, then one, then any list pair.
 * When `freshOnly` is set, a pair from the last 5 Card 1002 cards is skipped.
 */
function pickUnrelatedPair(ctx: Card1002Context, freshOnly: boolean): CandidatePair | null {
  const words = listWords(ctx);
  const deckIds = new Set(ctx.activeBank.map(w => w.id));
  const deck = words.filter(w => deckIds.has(w.id));
  const outside = words.filter(w => !deckIds.has(w.id));
  const knownKeys = buildKnownPairKeys(ctx.language, new Set(words.map(w => w.id)));
  const recent = ctx.recentPairKeys ?? [];
  const tiers: Array<[VocabItem[], VocabItem[], boolean, number]> = [
    [deck, deck, true, 2],
    [deck, outside, false, 1],
    [outside, outside, true, 0],
  ];
  for (const [left, right, sameList, priority] of tiers) {
    const picked = reservoirUnrelated(
      left,
      right,
      sameList,
      knownKeys,
      recent,
      freshOnly,
      priority,
    );
    if (picked) return picked;
  }
  return null;
}

function countValidPairs(ctx: Card1002Context): number {
  const typed = collectTypedPairs(ctx).length;
  if (typed >= 2) return typed;
  return hasUnrelatedPairs(ctx, 2 - typed) ? 2 : typed;
}

export function countCard1002ValidPairs(ctx: Card1002Context): number {
  return countValidPairs(ctx);
}

export function isCard1002Available(ctx: Card1002Context): boolean {
  return countValidPairs(ctx) >= 2;
}

function pickWeightedType(types: RelationshipType[]): RelationshipType {
  const total = types.reduce((sum, type) => sum + RELATIONSHIP_DRAW_WEIGHT[type], 0);
  let rand = Math.random() * total;
  for (const type of types) {
    rand -= RELATIONSHIP_DRAW_WEIGHT[type];
    if (rand <= 0) return type;
  }
  return types[types.length - 1];
}

function pickWithinType(
  pairs: CandidatePair[],
  recentPairKeys: string[],
  freshOnly: boolean,
): CandidatePair | null {
  const fresh = pairs.filter(
    pair => !isPairSpacingBlocked(pairKey(pair.itemA.id, pair.itemB.id), recentPairKeys),
  );
  const pool = fresh.length > 0 ? fresh : pairs;
  if (freshOnly && fresh.length === 0) return null;
  if (pool.length === 0) return null;
  const maxPriority = Math.max(...pool.map(pair => pair.priority));
  const top = pool.filter(pair => pair.priority === maxPriority);
  return top[Math.floor(Math.random() * top.length)];
}

export function generateCard1002(ctx: Card1002Context): Card1002Data | null {
  const recentPairKeys = ctx.recentPairKeys ?? [];
  const typed = collectTypedPairs(ctx);
  const byType = new Map<RelationshipType, CandidatePair[]>();
  for (const pair of typed) {
    const list = byType.get(pair.type);
    if (list) list.push(pair);
    else byType.set(pair.type, [pair]);
  }

  const freshUnrelated = pickUnrelatedPair(ctx, true);
  const anyUnrelated = freshUnrelated ?? pickUnrelatedPair(ctx, false);

  const freshTypes: RelationshipType[] = [];
  const allTypes: RelationshipType[] = [];
  for (const type of ALL_RELATIONSHIP_TYPES) {
    if (type === 'no_clear_relationship') {
      if (anyUnrelated) allTypes.push(type);
      if (freshUnrelated) freshTypes.push(type);
      continue;
    }
    const pairs = byType.get(type) ?? [];
    if (pairs.length === 0) continue;
    allTypes.push(type);
    if (pairs.some(pair => !isPairSpacingBlocked(pairKey(pair.itemA.id, pair.itemB.id), recentPairKeys))) {
      freshTypes.push(type);
    }
  }

  const types = freshTypes.length > 0 ? freshTypes : allTypes;
  if (types.length === 0) return null;

  const chosen = pickWeightedType(types);
  const picked =
    chosen === 'no_clear_relationship'
      ? freshTypes.length > 0
        ? freshUnrelated
        : anyUnrelated
      : pickWithinType(byType.get(chosen) ?? [], recentPairKeys, freshTypes.length > 0);
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
