import type { VocabItem } from '../types/vocab';

// Static imports — Metro bundler resolves these at build time
import deRaw from '../../docs/V0_German_Vocab_List.json';
import frRaw from '../../docs/V0_French_Vocab_List.json';
import esRaw from '../../docs/V0_Spanish_Vocab_List.json';

/**
 * Normalise a raw vocab record so that `category` is always `string[]`.
 * The JSON files currently ship with `category` as a plain string; this shim
 * converts those legacy values automatically so the app never breaks while the
 * JSON files are being updated to the new array format.
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
