import type { VocabItem } from '@/src/types/vocab';
import { MASTER_DATASET } from '@/src/data';
import {
  getPrimaryEnglish,
  stripEnglishGenderPrefix,
} from '@/src/engines/genderedCounterpartHelper';

interface SenseLabelIndex {
  ids: Set<string>;
  glossCounts: Map<string, number>;
  lemmaCounts: Map<string, number>;
}

const cache = new Map<string, SenseLabelIndex>();

/** Primary English gloss: lowercase, trimmed, with a leading "male " or "female " removed. */
function primaryGlossKey(item: VocabItem): string {
  return stripEnglishGenderPrefix(getPrimaryEnglish(item)).toLowerCase().trim();
}

function lemmaKey(item: VocabItem): string {
  return item.lemma.trim().toLowerCase();
}

function addCount(counts: Map<string, number>, key: string): void {
  if (!key) return;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** Gloss and lemma counts for one language's vocabulary file. Built once and cached. */
function indexFor(language: string): SenseLabelIndex {
  const cached = cache.get(language);
  if (cached) return cached;

  const ids = new Set<string>();
  const glossCounts = new Map<string, number>();
  const lemmaCounts = new Map<string, number>();
  for (const item of MASTER_DATASET[language] ?? []) {
    if (!item?.id) continue;
    ids.add(item.id);
    addCount(glossCounts, primaryGlossKey(item));
    addCount(lemmaCounts, lemmaKey(item));
  }

  const index = { ids, glossCounts, lemmaCounts };
  cache.set(language, index);
  return index;
}

/**
 * True when another entry shares this word's primary English gloss or its lemma.
 * Words in the vocabulary file use that file's counts. A word that is not in the
 * file is also compared with the user's lists. The word's own id does not count.
 */
export function sharesSenseWithAnother(
  item: VocabItem,
  language: string,
  listItems: readonly VocabItem[] = [],
): boolean {
  const index = indexFor(language);
  const gloss = primaryGlossKey(item);
  const lemma = lemmaKey(item);

  if (index.ids.has(item.id)) {
    return (
      (gloss !== '' && (index.glossCounts.get(gloss) ?? 0) > 1) ||
      (lemma !== '' && (index.lemmaCounts.get(lemma) ?? 0) > 1)
    );
  }

  if (gloss && (index.glossCounts.get(gloss) ?? 0) >= 1) return true;
  if (lemma && (index.lemmaCounts.get(lemma) ?? 0) >= 1) return true;
  for (const other of listItems) {
    if (!other?.id || other.id === item.id) continue;
    if (gloss && primaryGlossKey(other) === gloss) return true;
    if (lemma && lemmaKey(other) === lemma) return true;
  }
  return false;
}
