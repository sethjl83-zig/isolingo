/**
 * Old word id → current word id.
 * Built from the bundled rename and merge files. Chains resolve to the last id
 * (A → B and B → C becomes A → C). An id that is not a key is left unchanged.
 */
import renames from '../../docs/id_renames.json';
import merges from '../../docs/id_merges.json';

function asStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === 'string' && key.length > 0 && typeof value === 'string' && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

/** Follow rename/merge links until the id is not itself a source. Cycles stop. */
function resolveChains(raw: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const start of Object.keys(raw)) {
    const seen = new Set<string>();
    let current = start;
    while (raw[current] && !seen.has(current)) {
      seen.add(current);
      current = raw[current];
    }
    if (current !== start) resolved[start] = current;
  }
  return resolved;
}

// Merges win when the same old id is in both files.
const combined = { ...asStringMap(renames), ...asStringMap(merges) };

export const ID_MIGRATION_MAP: Record<string, string> = resolveChains(combined);

/** Return the current id. Unknown ids come back unchanged. */
export function translateWordId(id: string): string {
  return ID_MIGRATION_MAP[id] ?? id;
}
