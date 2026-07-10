import type { VocabItem, Gender } from '../types/vocab';
import type { DeterminerType } from '../types/cards';
import { getEnglishDeterminerPrompt } from './articleHelper';

const ENGLISH_GENDER_PREFIX_RE = /^(male|female)\s+/i;

/** Case-insensitive key for target-to-native English deduplication. */
function englishAnswerKey(answer: string): string {
  return answer.replace(/^to\s+/i, '').trim().toLowerCase();
}

/** Strip a leading gender modifier from a stored English gloss (target-to-native only). */
export function stripEnglishGenderPrefix(gloss: string): string {
  return gloss.trim().replace(ENGLISH_GENDER_PREFIX_RE, '');
}

/**
 * Expands one gloss into target-to-native answer forms for the card's own word.
 * The plain gloss (without a leading "male "/"female " prefix) is preferred; the
 * word's own prefixed form is kept as an alternate when it differs.
 */
function expandTargetToNativeGloss(gloss: string): string[] {
  const trimmed = gloss.trim();
  const stripped = stripEnglishGenderPrefix(trimmed);
  if (englishAnswerKey(stripped) !== englishAnswerKey(trimmed)) {
    return [stripped, trimmed];
  }
  return [trimmed];
}

function dedupeEnglishAnswers(answers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const answer of answers) {
    const key = englishAnswerKey(answer);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(answer);
    }
  }
  return result;
}

/**
 * All English glosses accepted for a target-to-native card from the item itself.
 * Gender prefixes in stored glosses are stripped so "male player" accepts "player".
 * For ambiguous gendered pairs (same plain gloss on both entries), also includes
 * the word's own derived gender-prefixed form (e.g. "female doctor" for Ärztin).
 */
export function collectTargetToNativeEnglishGlosses(
  item: VocabItem,
  counterpart: VocabItem | null = null,
): string[] {
  const raw = [
    ...getEnglishGlosses(item),
    ...(item.secondaryGlosses ?? []).map(g => g.trim()).filter(Boolean),
  ];
  let answers = dedupeEnglishAnswers(raw.flatMap(expandTargetToNativeGloss));

  if (
    item.genderedCounterpart &&
    counterpart &&
    isAmbiguousEnglishPair(item, counterpart) &&
    (item.gender === 'masculine' || item.gender === 'feminine')
  ) {
    const derived = dedupeEnglishAnswers(
      raw
        .map(stripEnglishGenderPrefix)
        .map(plain => `${genderModifier(item.gender!)} ${plain}`),
    );
    answers = dedupeEnglishAnswers([...answers, ...derived]);
  }

  return answers;
}

/** First comma-separated English gloss, with optional leading "to " stripped. */
export function getPrimaryEnglish(item: VocabItem): string {
  return item.english.split(',')[0].trim().replace(/^to\s+/i, '');
}

/** All comma-separated English glosses on an item. */
export function getEnglishGlosses(item: VocabItem): string[] {
  return item.english.split(',').map(s => s.trim()).filter(Boolean);
}

export function findGenderedCounterpart(
  item: VocabItem,
  bankById: Map<string, VocabItem>,
): VocabItem | null {
  if (!item.genderedCounterpart) return null;
  return bankById.get(item.genderedCounterpart) ?? null;
}

/**
 * True when the primary English gloss is identical on both paired entries,
 * making a native-to-target prompt ambiguous without disambiguation.
 */
export function isAmbiguousEnglishPair(
  item: VocabItem,
  counterpart: VocabItem,
): boolean {
  return (
    getPrimaryEnglish(item).toLowerCase() ===
    getPrimaryEnglish(counterpart).toLowerCase()
  );
}

function genderModifier(gender: Gender): string {
  if (gender === 'masculine') return 'male';
  if (gender === 'feminine') return 'female';
  return 'neutral';
}

/**
 * Builds a disambiguated English prompt for native-to-target cards when the
 * primary gloss is shared with a gendered counterpart (e.g. "doctor (male)").
 * Prefers senseLabel when it is explicitly "male" or "female".
 */
export function buildDisambiguatedEnglishPrompt(item: VocabItem): string {
  const base = getPrimaryEnglish(item);
  const label = item.senseLabel?.trim().toLowerCase();
  if (label === 'male' || label === 'female') {
    return `${base} (${label})`;
  }
  if (item.gender) {
    return `${base} (${genderModifier(item.gender)})`;
  }
  return base;
}

function mapEnglishGlosses(
  glosses: string[],
  usedDeterminer: DeterminerType | null,
): string[] {
  if (!usedDeterminer) return glosses;
  return glosses.map(g => getEnglishDeterminerPrompt(g, usedDeterminer));
}

/**
 * Plain English answers contributed by a gendered counterpart on target-to-native
 * cards. Only stripped glosses are included — the counterpart's own gender-prefixed
 * forms (e.g. "male player" on Spieler) must never be accepted for the other entry.
 */
export function collectCounterpartEnglishAnswers(
  counterpart: VocabItem,
  usedDeterminer: DeterminerType | null,
): string[] {
  const glosses = dedupeEnglishAnswers([
    ...getEnglishGlosses(counterpart),
    ...(counterpart.secondaryGlosses ?? []).map(g => g.trim()).filter(Boolean),
  ].map(stripEnglishGenderPrefix));
  return mapEnglishGlosses(glosses, usedDeterminer);
}

/**
 * Merges counterpart English glosses into target-to-native accepted answers,
 * skipping any form already covered by the canonical or existing accepted list.
 */
export function mergeCounterpartEnglishAccepted(
  canonicalAnswer: string,
  acceptedAnswers: string[],
  counterpart: VocabItem,
  usedDeterminer: DeterminerType | null,
): string[] {
  const seen = new Set(
    [canonicalAnswer, ...acceptedAnswers].map(englishAnswerKey),
  );
  const merged = [...acceptedAnswers];
  for (const answer of collectCounterpartEnglishAnswers(counterpart, usedDeterminer)) {
    const key = englishAnswerKey(answer);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(answer);
    }
  }
  return merged;
}
