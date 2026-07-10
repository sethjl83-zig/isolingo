import type { VocabItem, Language, Gender } from '../types/vocab';
import type {
  CardData,
  Card1001Data,
  Card1002Data,
  Card1006Data,
  DeterminerType,
  RelationshipType,
} from '../types/cards';
import { getDisplayForm, getEnglishDeterminerPrompt } from './articleHelper';
import {
  buildDisambiguatedEnglishPrompt,
  collectTargetToNativeEnglishGlosses,
  findGenderedCounterpart,
  isAmbiguousEnglishPair,
  mergeCounterpartEnglishAccepted,
} from './genderedCounterpartHelper';
import { selectWord } from './repetitionEngine';
import type { StudyType } from '../types/state';

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

// ── Card 1002 — Vocab Relationship Judgment ───────────────────────────────────

const RELATIONSHIP_POOL: { type: RelationshipType; weight: number }[] = [
  { type: 'same_meaning', weight: 0.40 },
  { type: 'same_category', weight: 0.35 },
  { type: 'no_clear_relationship', weight: 0.25 },
];

function pickRelationship(): RelationshipType {
  let rand = Math.random();
  for (const entry of RELATIONSHIP_POOL) {
    rand -= entry.weight;
    if (rand <= 0) return entry.type;
  }
  return 'same_meaning';
}

function nounDisplayForCard1002(
  item: VocabItem,
  language: Language,
): { displayForm: string; determinerType: DeterminerType | null } {
  if (item.partOfSpeech !== 'noun' || !item.gender) {
    return { displayForm: item.lemma, determinerType: null };
  }
  if (language === 'de') {
    return { displayForm: item.lemma, determinerType: null };
  }
  const det = DETERMINER_TYPES[Math.floor(Math.random() * DETERMINER_TYPES.length)];
  return {
    displayForm: getDisplayForm(language, item.gender, item.lemma, det),
    determinerType: det,
  };
}

export function generateCard1002(
  bank: VocabItem[],
  language: Language,
): Card1002Data | null {
  if (bank.length < 2) return null;

  const relType = pickRelationship();

  if (relType === 'same_meaning') {
    const item = bank[Math.floor(Math.random() * bank.length)];
    const { displayForm, determinerType } = nounDisplayForCard1002(item, language);
    return {
      type: 'CARD_1002',
      englishWord: item.english,
      targetWord: displayForm,
      targetItem: item,
      targetDeterminerType: determinerType,
      correctRelationship: 'same_meaning',
    };
  }

  if (relType === 'same_category') {
    // Flatten all per-word category arrays to find categories represented by ≥2 words
    const categories = [...new Set(bank.flatMap(w => w.category))];
    const validCats = categories.filter(
      c => bank.filter(w => w.category.includes(c)).length >= 2,
    );
    if (validCats.length === 0) return generateCard1002SameMeaning(bank, language);

    const cat = validCats[Math.floor(Math.random() * validCats.length)];
    const catWords = bank.filter(w => w.category.includes(cat));
    let i1 = Math.floor(Math.random() * catWords.length);
    let i2 = Math.floor(Math.random() * catWords.length);
    while (i2 === i1 && catWords.length > 1) i2 = Math.floor(Math.random() * catWords.length);

    const w1 = catWords[i1];
    const w2 = catWords[i2];
    const { displayForm: df2, determinerType: dt2 } = nounDisplayForCard1002(w2, language);
    return {
      type: 'CARD_1002',
      englishWord: w1.english,
      targetWord: df2,
      targetItem: w2,
      targetDeterminerType: dt2,
      correctRelationship: 'same_category',
    };
  }

  // no_clear_relationship
  const item1 = bank[Math.floor(Math.random() * bank.length)];
  const diffCat = bank.filter(
    w =>
      // Words share no category in common
      !w.category.some(c => item1.category.includes(c)) &&
      w.english.toLowerCase() !== item1.english.toLowerCase(),
  );
  if (diffCat.length === 0) return generateCard1002SameMeaning(bank, language);

  const item2 = diffCat[Math.floor(Math.random() * diffCat.length)];
  const { displayForm: dfNcr, determinerType: dtNcr } = nounDisplayForCard1002(item2, language);
  return {
    type: 'CARD_1002',
    englishWord: item1.english,
    targetWord: dfNcr,
    targetItem: item2,
    targetDeterminerType: dtNcr,
    correctRelationship: 'no_clear_relationship',
  };
}

function generateCard1002SameMeaning(
  bank: VocabItem[],
  language: Language,
): Card1002Data {
  const item = bank[Math.floor(Math.random() * bank.length)];
  const { displayForm, determinerType } = nounDisplayForCard1002(item, language);
  return {
    type: 'CARD_1002',
    englishWord: item.english,
    targetWord: displayForm,
    targetItem: item,
    targetDeterminerType: determinerType,
    correctRelationship: 'same_meaning',
  };
}

// ── Card 1006 — Noun/Vocab Production ─────────────────────────────────────────

const DETERMINER_TYPES: DeterminerType[] = ['definite', 'indefinite', 'possessive'];

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

  if (item.partOfSpeech === 'noun' && item.gender) {
    if (language === 'de') {
      prompt = item.lemma;
    } else {
      // FR/ES: cycle through all three determiner types so users see all forms
      const det = DETERMINER_TYPES[Math.floor(Math.random() * DETERMINER_TYPES.length)];
      usedDeterminer = det;
      prompt = getDisplayForm(language, item.gender, item.lemma, det);
    }
  } else {
    prompt = item.lemma;
  }

  const counterpart = findGenderedCounterpart(item, bankById);
  const englishValues = collectTargetToNativeEnglishGlosses(item, counterpart);

  // When the prompt shows a determiner (FR/ES noun), the expected English
  // answer must use the matching English determiner form: "the X", "a X",
  // or "my X". Without this, "ma minute" would incorrectly accept "minute".
  const mappedValues = usedDeterminer
    ? englishValues.map(e => getEnglishDeterminerPrompt(e, usedDeterminer!))
    : englishValues;

  const [canonical, ...rest] = mappedValues;

  let acceptedAnswers = rest;
  if (counterpart) {
    acceptedAnswers = mergeCounterpartEnglishAccepted(
      canonical,
      acceptedAnswers,
      counterpart,
      usedDeterminer,
    );
  }

  return {
    type: 'CARD_1006',
    item,
    direction: 'target_to_native',
    determinerType: usedDeterminer,
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
        prompt: promptEnglish,
        canonicalAnswer: item.lemma,
        acceptedAnswers: alternates,
      };
    }

    // FR / ES: determiner + noun.
    // Only select from determiner types permitted for this noun; fall back to
    // all three if articleTypes is absent or empty.
    const detPool = getArticleTypesPool(item.articleTypes);
    const det = detPool[Math.floor(Math.random() * detPool.length)];

    return {
      type: 'CARD_1006',
      item,
      direction: 'native_to_target',
      determinerType: det,
      prompt: getEnglishDeterminerPrompt(promptEnglish, det),
      canonicalAnswer: getDisplayForm(language, item.gender, item.lemma, det),
      acceptedAnswers: alternates.map(a =>
        getDisplayForm(language, item.gender!, a.trim(), det),
      ),
    };
  }

  // Verb / adjective / adverb — alternates are bare lemma-form variants.
  return {
    type: 'CARD_1006',
    item,
    direction: 'native_to_target',
    determinerType: null,
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
      generateCard1002(bank, language) ??
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
