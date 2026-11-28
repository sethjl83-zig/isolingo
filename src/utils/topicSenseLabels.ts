import type { VocabItem } from '@/src/types/vocab';
import { lemmaKey, primaryGlossKey } from '@/src/utils/senseLabelVisibility';

/**
 * To add an entry, put the topic's category id and the labels to hide.
 * Labels are compared lowercased and trimmed.
 */
export const TOPIC_LABELS_TO_HIDE: Readonly<Record<string, readonly string[]>> = {
  animals: ['animal'],
  food: ['food'],
  health: ['illness', 'medical'],
  technology: ['computer', 'digital', 'online', 'computing'],
};

const TOPIC_KEY_BY_NAME: Readonly<Record<string, string>> = {
  Animals: 'animals',
  Food: 'food',
  Health: 'health',
  Technology: 'technology',
};

const HIDE_SETS = new Map<string, ReadonlySet<string>>(
  Object.entries(TOPIC_LABELS_TO_HIDE).map(([topic, labels]) => [
    topic,
    new Set(labels.map(label => label.trim().toLowerCase())),
  ]),
);

const NO_HIDDEN_LABELS: ReadonlySet<string> = new Set();

/** The one list a Production card may hide labels for. Null skips hiding. */
export interface TopicSenseList {
  name: string;
  createdVia: string;
  items: readonly VocabItem[];
}

function belongsToTopic(item: VocabItem, topicKey: string): boolean {
  return (item.category ?? []).some(category => category.trim().toLowerCase() === topicKey);
}

function clashesInList(item: VocabItem, items: readonly VocabItem[]): boolean {
  const gloss = primaryGlossKey(item);
  const lemma = lemmaKey(item);
  for (const other of items) {
    if (!other?.id || other.id === item.id) continue;
    if (gloss && primaryGlossKey(other) === gloss) return true;
    if (lemma && lemmaKey(other) === lemma) return true;
  }
  return false;
}

/**
 * Word ids whose sense label a single curated topic list hides.
 * A custom list, an unmapped name, or a null list hides nothing.
 */
export function hiddenSenseLabelIds(list: TopicSenseList | null | undefined): ReadonlySet<string> {
  if (!list || list.createdVia !== 'curated') return NO_HIDDEN_LABELS;
  const topicKey = TOPIC_KEY_BY_NAME[list.name];
  const hideLabels = topicKey ? HIDE_SETS.get(topicKey) : undefined;
  if (!topicKey || !hideLabels) return NO_HIDDEN_LABELS;

  const carriers = new Map<string, VocabItem[]>();
  for (const item of list.items) {
    if (!item?.id) continue;
    const label = (item.senseLabel ?? '').trim().toLowerCase();
    if (!hideLabels.has(label)) continue;
    const group = carriers.get(label);
    if (group) group.push(item);
    else carriers.set(label, [item]);
  }

  const hidden = new Set<string>();
  for (const group of carriers.values()) {
    if (!group.every(item => belongsToTopic(item, topicKey))) continue;
    for (const item of group) {
      if (!clashesInList(item, list.items)) hidden.add(item.id);
    }
  }
  return hidden.size === 0 ? NO_HIDDEN_LABELS : hidden;
}
