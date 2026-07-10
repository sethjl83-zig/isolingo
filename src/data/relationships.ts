import type { Language } from '../types/vocab';

import antonymsDe from '../../docs/antonyms_de.json';
import antonymsFr from '../../docs/antonyms_fr.json';
import antonymsEs from '../../docs/antonyms_es.json';
import relatedDe from '../../docs/related_pairs_de.json';
import relatedFr from '../../docs/related_pairs_fr.json';
import relatedEs from '../../docs/related_pairs_es.json';
import hyponymDe from '../../docs/hyponym_pairs_de.json';
import hyponymFr from '../../docs/hyponym_pairs_fr.json';
import hyponymEs from '../../docs/hyponym_pairs_es.json';
import sameKindDe from '../../docs/same_kind_pairs_de.json';
import sameKindFr from '../../docs/same_kind_pairs_fr.json';
import sameKindEs from '../../docs/same_kind_pairs_es.json';

export interface WordPair {
  word1: string;
  word2: string;
}

export interface HyponymPair {
  specific: string;
  general: string;
}

export interface LanguageRelationshipData {
  antonyms: WordPair[];
  related: WordPair[];
  hyponyms: HyponymPair[];
  sameKind: WordPair[];
}

const RELATIONSHIP_DATA: Record<Language, LanguageRelationshipData> = {
  de: {
    antonyms: antonymsDe as WordPair[],
    related: relatedDe as WordPair[],
    hyponyms: hyponymDe as HyponymPair[],
    sameKind: sameKindDe as WordPair[],
  },
  fr: {
    antonyms: antonymsFr as WordPair[],
    related: relatedFr as WordPair[],
    hyponyms: hyponymFr as HyponymPair[],
    sameKind: sameKindFr as WordPair[],
  },
  es: {
    antonyms: antonymsEs as WordPair[],
    related: relatedEs as WordPair[],
    hyponyms: hyponymEs as HyponymPair[],
    sameKind: sameKindEs as WordPair[],
  },
};

export function getRelationshipData(language: Language): LanguageRelationshipData {
  return RELATIONSHIP_DATA[language];
}
