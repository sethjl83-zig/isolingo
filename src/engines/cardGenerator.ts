import type { VocabItem, Language, Gender } from '../types/vocab';
import type {
  CardData,
  Card1001Data,
  Card1006Data,
  DeterminerType,
} from '../types/cards';
import { getDisplayForm, getEnglishDeterminerPrompt, pickRandomPossessivePerson } from './articleHelper';
import {
  buildDisambiguatedEnglishPrompt,
  collectTargetToNativeEnglishGlosses,
  findGenderedCounterpart,
  isAmbiguousEnglishPair,
  mergeCounterpartEnglishAccepted,
} from './genderedCounterpartHelper';
import { selectWord } from './repetitionEngine';
import type { StudyType } from '../types/state';
import {
  generateCard1002,
  type Card1002Context,
} from './card1002Engine';

// ── Identical / near-identical word guard ─────────────────────────────────────

/**
 * Reduce a string to its bare alphanumeric core for comparison:
 *   1. Lowercase
 *   2. NFD-decompose then strip combining diacritical marks (é → e, ô → o)
 *   3. Remove every non-alphanumeric character (spaces, hyphens, apostrophes…)
 *
 * This means "T-Shirt", "t-shirt" and "tshirt" all normalise to "tshirt", and
 * "hôtel" / "hotel" / "Hôtel" all normalise to "hotel".
 */
function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]/g, '');      // strip punctuation, hyphens, spaces
}

/**
 * Returns true when the target-language lemma is identical or near-identical
 * to any English gloss, making a target-to-native card trivially obvious.
 *
 * "Near-identical" covers:
 *   - Case              : Hotel → hotel  ✓
 *   - Diacritics        : hôtel → hotel, café → cafe  ✓
 *   - Punctuation       : T-Shirt → t-shirt  ✓
 *
 * All comma-separated English glosses are checked (not just the first) so a
 * word with a secondary gloss that matches the lemma is also caught.
 *
 * Call sites skip this check when studyType === 'gender' because in Gender
 * mode the user is tested on grammatical gender, not translation — so an
 * identical word like "Hotel" is still educationally valid.
 */
export function isIdenticalToEnglish(item: VocabItem): boolean {
  const lemmaKey = normalizeForComparison(item.lemma);
  return item.english
    .split(',')
    .some(gloss => normalizeForComparison(gloss.trim()) === lemmaKey);
}

// ── Card 1001 — Matching (Gender Anchoring) ───────────────────────────────────

export function generateCard1001(
  bank: VocabItem[],
  language: Language,
  excludeNounIds?: Set<string>,
  recentWordIds?: string[],
): Card1001Data | null {
  const allNouns = bank.filter(w => w.partOfSpeech === 'noun' && w.gender !== null);
  const genderSet: Gender[] =
    language === 'de'
      ? ['masculine', 'feminine', 'neuter']
      : ['masculine', 'feminine'];

  if (allNouns.length < 3) return null;

  // Anti-same-group: prefer nouns NOT in the previous Card1001 group.
  // Fall back to the full noun pool if the fresh pool is too small.
  const freshNouns =
    excludeNounIds && excludeNounIds.size > 0
      ? allNouns.filter(n => !excludeNounIds.has(n.id))
      : allNouns;
  const nouns = freshNouns.length >= 3 ? freshNouns : allNouns;

  const byGender: Partial<Record<Gender, VocabItem[]>> = {};
  for (const noun of nouns) {
    if (!noun.gender) continue;
    if (!byGender[noun.gender]) byGender[noun.gender] = [];
    byGender[noun.gender]!.push(noun);
  }

  const availableGenders = genderSet.filter(g => (byGender[g]?.length ?? 0) > 0);
  if (availableGenders.length < 2) return null;

  // Target 3–5 nouns, capped by pool size
  const targetCount = Math.min(5, nouns.length);
  const selected: VocabItem[] = [];

  // At least one noun per available gender
  for (const g of availableGenders) {
    const pool = byGender[g]!;
    selected.push(pool[Math.floor(Math.random() * pool.length)]);
    if (selected.length >= targetCount) break;
  }

  // Fill remaining slots with variety, preferring spacing-eligible nouns
  while (selected.length < targetCount) {
    const remaining = nouns.filter(n => !selected.find(s => s.id === n.id));
    if (remaining.length === 0) break;
    // Prefer nouns not recently seen
    const fresh = recentWordIds && recentWordIds.length > 0
      ? remaining.filter(n => !recentWordIds.includes(n.id))
      : remaining;
    const pool = fresh.length > 0 ? fresh : remaining;
    selected.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Fisher-Yates shuffle
  const shuffled = [...selected];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    type: 'CARD_1001',
    // All languages show the bare lemma — no article or determiner.
    // Gender is conveyed solely through color-coding, not through an article prefix.
    nouns: shuffled.map(item => ({
      item,
      displayForm: item.lemma,
    })),
  };
}

// ── Card 1006 — Noun/Vocab Production ─────────────────────────────────────────

const DETERMINER_TYPES: DeterminerType[] = ['definite', 'indefinite', 'possessive'];

/** Target mix for FR Card 1006 native-to-target determiner prompts. */
const NATIVE_TO_TARGET_DETERMINER_WEIGHTS_FR: Record<DeterminerType, number> = {
  definite: 0.4,
  indefinite: 0.35,
  possessive: 0.25,
};

/** Target mix for ES — heavier on possessives (mi/tu/su). */
const NATIVE_TO_TARGET_DETERMINER_WEIGHTS_ES: Record<DeterminerType, number> = {
  definite: 0.3,
  indefinite: 0.3,
  possessive: 0.4,
};

function getNativeToTargetDeterminerWeights(
  language: Language,
): Record<DeterminerType, number> {
  return language === 'es'
    ? NATIVE_TO_TARGET_DETERMINER_WEIGHTS_ES
    : NATIVE_TO_TARGET_DETERMINER_WEIGHTS_FR;
}

/**
 * Pick a determiner type from `pool` using the native-to-target weight targets.
 * Weights are renormalized when the noun's articleTypes pool is a subset.
 */
function pickNativeToTargetDeterminerType(
  pool: DeterminerType[],
  language: Language,
): DeterminerType {
  if (pool.length === 0) return 'definite';
  if (pool.length === 1) return pool[0];

  const weights = getNativeToTargetDeterminerWeights(language);
  let totalWeight = 0;
  const weighted = pool.map(type => {
    const weight = weights[type];
    totalWeight += weight;
    return { type, weight };
  });

  let roll = Math.random() * totalWeight;
  for (const { type, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return type;
  }

  return weighted[weighted.length - 1].type;
}

/**
 * Returns the pool of DeterminerType values eligible for a given noun.
 *
 * When a VocabItem carries an `articleTypes` array (e.g. ["definite",
 * "indefinite"]), only those types that are also valid DeterminerType values
 * are used. This lets the vocab data opt out of, say, the possessive form for
 * words where "mon hôpital" would be unnatural.
 *
 * Falls back to all three types when `articleTypes` is absent, null, empty,
 * or contains no recognised DeterminerType values.
 */
function getArticleTypesPool(articleTypes: string[] | null | undefined): DeterminerType[] {
  if (!articleTypes || articleTypes.length === 0) return DETERMINER_TYPES;
  const filtered = DETERMINER_TYPES.filter(d => articleTypes.includes(d));
  return filtered.length > 0 ? filtered : DETERMINER_TYPES;
}

export function generateCard1006(
  item: VocabItem,
  language: Language,
  direction: 'native_to_target' | 'target_to_native',
  bankById: Map<string, VocabItem> = new Map(),
): Card1006Data {
  if (direction === 'target_to_native') {
    return card1006TargetToNative(item, language, bankById);
  }
  return card1006NativeToTarget(item, language, bankById);
}

function card1006TargetToNative(
  item: VocabItem,
  language: Language,
  bankById: Map<string, VocabItem>,
): Card1006Data {
  let prompt: string;
  let usedDeterminer: DeterminerType | null = null;
  let possessivePerson: PossessivePerson | null = null;

  if (item.partOfSpeech === 'noun' && item.gender) {
    if (language === 'de') {
      prompt = item.lemma;
    } else {
      // FR/ES: cycle through all three determiner types so users see all forms
      const det = DETERMINER_TYPES[Math.floor(Math.random() * DETERMINER_TYPES.length)];
      usedDeterminer = det;
      if (det === 'possessive') {
        possessivePerson = pickRandomPossessivePerson(language);
      }
      prompt = getDisplayForm(
        language,
        item.gender,
        item.lemma,
        det,
        possessivePerson ?? 'first',
      );
    }
  } else {
    prompt = item.lemma;
  }

  const counterpart = findGenderedCounterpart(item, bankById);
  const englishValues = collectTargetToNativeEnglishGlosses(item, counterpart);

  // When the prompt shows a determiner (FR/ES noun), the expected English
  // answer must use the matching English determiner form: "the X", "a X",
  // or "my/your/his/her X". Without this, "ma minute" would incorrectly accept "minute".
  const mappedValues = usedDeterminer
    ? englishValues.map(e =>
        getEnglishDeterminerPrompt(
          e,
          usedDeterminer!,
          possessivePerson ?? 'first',
        ),
      )
    : englishValues;

  const [canonical, ...rest] = mappedValues;

  let acceptedAnswers = rest;
  if (counterpart) {
    acceptedAnswers = mergeCounterpartEnglishAccepted(
      canonical,
      acceptedAnswers,
      counterpart,
      usedDeterminer,
      possessivePerson,
    );
  }

  return {
    type: 'CARD_1006',
    item,
    direction: 'target_to_native',
    determinerType: usedDeterminer,
    possessivePerson,
    prompt,
    canonicalAnswer: canonical,
    acceptedAnswers,
  };
}

function card1006NativeToTarget(
  item: VocabItem,
  language: Language,
  bankById: Map<string, VocabItem>,
): Card1006Data {
  const counterpart = findGenderedCounterpart(item, bankById);
  const englishBase = item.english.split(',')[0].trim().replace(/^to\s+/i, '');
  const promptEnglish =
    counterpart && isAmbiguousEnglishPair(item, counterpart)
      ? buildDisambiguatedEnglishPrompt(item)
      : englishBase;
  // Alternate target-language forms (e.g. variant spellings). Null-safe.
  const alternates: string[] = item.alternateTargetAnswers ?? [];

  if (item.partOfSpeech === 'noun' && item.gender) {
    if (language === 'de') {
      // German nouns: the user types the bare noun and selects a gender tile.
      // Alternates are treated as bare noun forms; gender validation is separate.
      return {
        type: 'CARD_1006',
        item,
        direction: 'native_to_target',
        determinerType: null,
        possessivePerson: null,
        prompt: promptEnglish,
        canonicalAnswer: item.lemma,
        acceptedAnswers: alternates,
      };
    }

    // FR / ES: determiner + noun.
    // Only select from determiner types permitted for this noun; fall back to
    // all three if articleTypes is absent or empty.
    const detPool = getArticleTypesPool(item.articleTypes);
    const det = pickNativeToTargetDeterminerType(detPool, language);
    const possessivePerson = det === 'possessive' ? pickRandomPossessivePerson(language) : null;

    return {
      type: 'CARD_1006',
      item,
      direction: 'native_to_target',
      determinerType: det,
      possessivePerson,
      prompt: getEnglishDeterminerPrompt(
        promptEnglish,
        det,
        possessivePerson ?? 'first',
      ),
      canonicalAnswer: getDisplayForm(
        language,
        item.gender,
        item.lemma,
        det,
        possessivePerson ?? 'first',
      ),
      acceptedAnswers: alternates.map(a =>
        getDisplayForm(
          language,
          item.gender!,
          a.trim(),
          det,
          possessivePerson ?? 'first',
        ),
      ),
    };
  }

  // Verb / adjective / adverb — alternates are bare lemma-form variants.
  return {
    type: 'CARD_1006',
    item,
    direction: 'native_to_target',
    determinerType: null,
    possessivePerson: null,
    prompt: promptEnglish,
    canonicalAnswer: item.lemma,
    acceptedAnswers: alternates,
  };
}

// ── Session-level card generation ─────────────────────────────────────────────

export function generateCard(
  cardType: import('../types/cards').CardType,
  bank: VocabItem[],
  language: Language,
  direction: 'native_to_target' | 'target_to_native',
  wordStats: Record<string, import('../types/state').WordStats>,
  sessionCardIndex: number,
  wordFrequencySettings: Record<string, import('../types/state').WordFrequencySetting> = {},
  recentWordIds: string[] = [],
  excludeCard1001NounIds: Set<string> = new Set(),
  preSelectedItem?: VocabItem,
  studyType: StudyType = 'general_vocab',
  card1002Context?: Card1002Context,
): CardData | null {
  const bankById = new Map(bank.map(w => [w.id, w]));

  if (cardType === 'CARD_1001') {
    return (
      generateCard1001(bank, language, excludeCard1001NounIds, recentWordIds) ??
      generateCard1006Fallback(
        bank, language, direction, studyType, wordStats, sessionCardIndex,
        wordFrequencySettings, recentWordIds, bankById,
      )
    );
  }

  if (cardType === 'CARD_1002') {
    return (
      (card1002Context ? generateCard1002(card1002Context) : null) ??
      generateCard1006Fallback(
        bank, language, direction, studyType, wordStats, sessionCardIndex,
        wordFrequencySettings, recentWordIds, bankById,
      )
    );
  }

  // CARD_1006 — use pre-selected item if provided by the deck manager
  if (preSelectedItem) {
    return generateCard1006(preSelectedItem, language, direction, bankById);
  }

  return generateCard1006Fallback(
    bank, language, direction, studyType, wordStats, sessionCardIndex,
    wordFrequencySettings, recentWordIds, bankById,
  );
}

function generateCard1006Fallback(
  bank: VocabItem[],
  language: Language,
  direction: 'native_to_target' | 'target_to_native',
  studyType: StudyType,
  wordStats: Record<string, import('../types/state').WordStats>,
  sessionCardIndex: number,
  wordFrequencySettings: Record<string, import('../types/state').WordFrequencySetting>,
  recentWordIds: string[] = [],
  bankById: Map<string, VocabItem>,
): CardData | null {
  let eligible = bank.filter(item => {
    // In gender mode the user is tested on gender, not translation — so identical
    // words (e.g. "Hotel" → "hotel") are still valid cards; don't filter them.
    if (direction === 'target_to_native' && studyType !== 'gender') {
      if (isIdenticalToEnglish(item)) return false;
    }
    return true;
  });

  if (eligible.length === 0) eligible = bank;

  // For German native_to_target, prioritise nouns with gender so gender tiles appear.
  if (language === 'de' && direction === 'native_to_target') {
    const nounPool = eligible.filter(w => w.partOfSpeech === 'noun' && w.gender !== null);
    if (nounPool.length > 0) eligible = nounPool;
  }

  const item = selectWord(
    eligible, wordStats, sessionCardIndex, wordFrequencySettings, recentWordIds,
  );
  if (!item) return null;

  return generateCard1006(item, language, direction, bankById);
}
