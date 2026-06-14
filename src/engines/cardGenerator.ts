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
import { selectWord } from './repetitionEngine';

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
    nouns: shuffled.map(item => ({
      item,
      displayForm:
        language === 'de'
          ? item.lemma
          : getDisplayForm(language, item.gender!, item.lemma, 'definite'),
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
    const categories = [...new Set(bank.map(w => w.category))];
    const validCats = categories.filter(
      c => bank.filter(w => w.category === c).length >= 2,
    );
    if (validCats.length === 0) return generateCard1002SameMeaning(bank, language);

    const cat = validCats[Math.floor(Math.random() * validCats.length)];
    const catWords = bank.filter(w => w.category === cat);
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
      w.category !== item1.category &&
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

export function generateCard1006(
  item: VocabItem,
  language: Language,
  direction: 'native_to_target' | 'target_to_native',
): Card1006Data {
  if (direction === 'target_to_native') {
    return card1006TargetToNative(item, language);
  }
  return card1006NativeToTarget(item, language);
}

function card1006TargetToNative(item: VocabItem, language: Language): Card1006Data {
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

  const englishValues = item.english.split(',').map(s => s.trim()).filter(Boolean);
  const [canonical, ...rest] = englishValues;

  return {
    type: 'CARD_1006',
    item,
    direction: 'target_to_native',
    determinerType: usedDeterminer,
    prompt,
    canonicalAnswer: canonical,
    acceptedAnswers: rest,
  };
}

function card1006NativeToTarget(item: VocabItem, language: Language): Card1006Data {
  const englishBase = item.english.split(',')[0].trim().replace(/^to\s+/i, '');

  if (item.partOfSpeech === 'noun' && item.gender) {
    if (language === 'de') {
      return {
        type: 'CARD_1006',
        item,
        direction: 'native_to_target',
        determinerType: null, // gender is via tile selection
        prompt: englishBase,
        canonicalAnswer: item.lemma,
        acceptedAnswers: [],
      };
    }

    // FR / ES: determiner + noun
    const det = DETERMINER_TYPES[Math.floor(Math.random() * DETERMINER_TYPES.length)];
    return {
      type: 'CARD_1006',
      item,
      direction: 'native_to_target',
      determinerType: det,
      prompt: getEnglishDeterminerPrompt(englishBase, det),
      canonicalAnswer: getDisplayForm(language, item.gender, item.lemma, det),
      acceptedAnswers: [],
    };
  }

  // Verb / adjective / adverb
  return {
    type: 'CARD_1006',
    item,
    direction: 'native_to_target',
    determinerType: null,
    prompt: item.english.split(',')[0].trim(),
    canonicalAnswer: item.lemma,
    acceptedAnswers: [],
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
): CardData | null {
  if (cardType === 'CARD_1001') {
    return (
      generateCard1001(bank, language, excludeCard1001NounIds, recentWordIds) ??
      generateCard1006Fallback(
        bank, language, direction, wordStats, sessionCardIndex,
        wordFrequencySettings, recentWordIds,
      )
    );
  }

  if (cardType === 'CARD_1002') {
    return (
      generateCard1002(bank, language) ??
      generateCard1006Fallback(
        bank, language, direction, wordStats, sessionCardIndex,
        wordFrequencySettings, recentWordIds,
      )
    );
  }

  // CARD_1006 — use pre-selected item if provided by the deck manager
  if (preSelectedItem) {
    return generateCard1006(preSelectedItem, language, direction);
  }

  return generateCard1006Fallback(
    bank, language, direction, wordStats, sessionCardIndex,
    wordFrequencySettings, recentWordIds,
  );
}

function generateCard1006Fallback(
  bank: VocabItem[],
  language: Language,
  direction: 'native_to_target' | 'target_to_native',
  wordStats: Record<string, import('../types/state').WordStats>,
  sessionCardIndex: number,
  wordFrequencySettings: Record<string, import('../types/state').WordFrequencySetting>,
  recentWordIds: string[] = [],
): CardData | null {
  let eligible = bank.filter(item => {
    if (direction === 'target_to_native') {
      const lemmaKey = item.lemma.toLowerCase().replace(/\s+/g, '');
      const englishKey = item.english.split(',')[0].trim().toLowerCase().replace(/\s+/g, '');
      if (lemmaKey === englishKey) return false;
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

  return generateCard1006(item, language, direction);
}
