import type { VocabItem } from '@/src/types/vocab';
import {
  getPrimaryEnglish,
  stripEnglishGenderPrefix,
} from '@/src/engines/genderedCounterpartHelper';

const cache = new Map<string, ReadonlySet<string>>();

/** Primary English gloss: lowercase, trimmed, with a leading "male " or "female " removed. */
export function primaryGlossKey(item: VocabItem): string {
  return stripEnglishGenderPrefix(getPrimaryEnglish(item)).toLowerCase();
}

/**
 * Ids that share a primary English gloss with a different id in this list.
 * Cached per list contents so a session does not recompute it on each render.
 */
export function sharedPrimaryGlossIds(
  listKey: string,
  items: readonly VocabItem[],
): ReadonlySet<string> {
  const signature = items
    .map(item => `${item.id}\t${primaryGlossKey(item)}`)
    .sort()
    .join('\n');
  const cacheKey = `${listKey}\n${signature}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const byGloss = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item?.id) continue;
    const key = primaryGlossKey(item);
    const ids = byGloss.get(key);
    if (ids) ids.add(item.id);
    else byGloss.set(key, new Set([item.id]));
  }

  const shared = new Set<string>();
  for (const ids of byGloss.values()) {
    if (ids.size < 2) continue;
    for (const id of ids) shared.add(id);
  }
  const frozen = shared as ReadonlySet<string>;
  cache.set(cacheKey, frozen);
  return frozen;
}
