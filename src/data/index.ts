import type { VocabItem } from '../types/vocab';

// Static imports — Metro bundler resolves these at build time
import deRaw from '../../docs/V0_German_Vocab_List.json';
import frRaw from '../../docs/V0_French_Vocab_List.json';
import esRaw from '../../docs/V0_Spanish_Vocab_List.json';

/**
 * Normalise a raw vocab record into a fully-typed VocabItem.
 *
 * - `category` is coerced from a legacy plain string to `string[]` if needed.
 * - All new optional schema fields (articleTypes, genderedCounterpart,
 *   secondaryGlosses, alternateTargetAnswers) are spread through as-is; they
 *   are typed as optional/nullable on VocabItem so missing values are safe.
 */
function normalizeItem(raw: unknown): VocabItem {
  const item = raw as VocabItem & { category: string | string[] };
  return {
    ...item,
    category: Array.isArray(item.category) ? item.category : [item.category],
  };
}

function normalizeList(raw: unknown[]): VocabItem[] {
  return raw.map(normalizeItem);
}

export const MASTER_DATASET: Record<string, VocabItem[]> = {
  de: normalizeList(deRaw as unknown[]),
  fr: normalizeList(frRaw as unknown[]),
  es: normalizeList(esRaw as unknown[]),
};

// ── TEMP: confirm new vocab schema fields are loaded ─────────────────────────
(['de', 'fr', 'es'] as const).forEach(lang => {
  const first = MASTER_DATASET[lang]?.[0];
  if (first) {
    console.log(`[VocabData] ${lang} first entry:`, {
      id: first.id,
      lemma: first.lemma,
      articleTypes: first.articleTypes,
      genderedCounterpart: first.genderedCounterpart,
      secondaryGlosses: first.secondaryGlosses,
      alternateTargetAnswers: first.alternateTargetAnswers,
    });
  } else {
    console.warn(`[VocabData] ${lang} dataset is empty or failed to load`);
  }
});

const userAddedWords: Record<string, VocabItem[]> = {
  de: [],
  fr: [],
  es: [],
};

export function addUserWord(item: VocabItem): void {
  const lang = item.targetLanguage;
  const exists = [...(MASTER_DATASET[lang] ?? []), ...userAddedWords[lang]].some(
    w => w.id === item.id || w.lemma.toLowerCase() === item.lemma.toLowerCase(),
  );
  if (!exists) userAddedWords[lang].push(item);
}

export function getMasterDataset(language: string): VocabItem[] {
  return [...(MASTER_DATASET[language] ?? []), ...(userAddedWords[language] ?? [])];
}

// For V0 the entire master dataset is the initial active bank.
// Screen 5001 lets users remove words; removed words come from the reserve
// (the portion of the master dataset not currently in the bank).
export function getInitialBank(language: string): VocabItem[] {
  return getMasterDataset(language);
}

export function getReserve(language: string, activeBank: VocabItem[]): VocabItem[] {
  const activIds = new Set(activeBank.map(w => w.id));
  return getMasterDataset(language).filter(w => !activIds.has(w.id));
}

/**
 * Replace pool-persisted word snapshots with the current master-dataset entry
 * for each ID. Keeps user-added markers from the pool copy when present.
 */
export function enrichVocabItemsFromMaster(
  items: VocabItem[],
  language: string,
): VocabItem[] {
  const masterById = new Map(getMasterDataset(language).map(w => [w.id, w]));
  return items.map(item => {
    const fresh = masterById.get(item.id);
    if (!fresh) return item;
    return item.user_added === 'y' ? { ...fresh, user_added: 'y' } : fresh;
  });
}
