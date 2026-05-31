/**
 * Pure functions and shared constants for reusable typeahead search.
 */

export const ALL_TYPEAHEAD_ENTITY_TYPES = [
  'event',
  'group',
  'amendment',
  'user',
  'blog',
  'todo',
  'vote',
  'election',
  'agenda_item',
] as const;

export type DomainEntityType = (typeof ALL_TYPEAHEAD_ENTITY_TYPES)[number];
export type EntityType = DomainEntityType | 'role';

export const TYPEAHEAD_ENTITY_ORDER: readonly EntityType[] = [
  'user',
  'group',
  'event',
  'agenda_item',
  'amendment',
  'vote',
  'election',
  'todo',
  'blog',
  'role',
] as const;

export const TYPEAHEAD_ENTITY_LABELS: Record<EntityType, string> = {
  user: 'User',
  group: 'Group',
  event: 'Event',
  agenda_item: 'Agenda Point',
  amendment: 'Amendment',
  vote: 'Vote',
  election: 'Election',
  todo: 'Task',
  blog: 'Blog',
  role: 'Role',
};

export const TYPEAHEAD_ENTITY_GROUP_LABELS: Record<EntityType, string> = {
  user: 'Users',
  group: 'Groups',
  event: 'Events',
  agenda_item: 'Agenda Points',
  amendment: 'Amendments',
  vote: 'Votes',
  election: 'Elections',
  todo: 'Tasks',
  blog: 'Blogs',
  role: 'Roles',
};

export interface TypeaheadItem {
  id: string;
  entityType: EntityType;
  label: string;
  secondaryLabel?: string;
  description?: string;
  avatar?: string | null;
  hashtags?: string[];
  keywords?: string[];
  metadata?: string[];
  url?: string;
}

export const DEFAULT_TYPEAHEAD_SEARCH_KEYS: readonly (keyof TypeaheadItem)[] = [
  'label',
  'secondaryLabel',
  'description',
  'hashtags',
  'keywords',
];

export function addUniqueTypeaheadValue(values: readonly string[], nextValue: string): string[] {
  return values.includes(nextValue) ? [...values] : [...values, nextValue];
}

export function removeTypeaheadValue(values: readonly string[], valueToRemove: string): string[] {
  return values.filter(value => value !== valueToRemove);
}

/**
 * Filter items by query against specified search keys.
 * Case-insensitive substring matching for strings and string arrays.
 */
export function filterItems<T>(
  items: readonly T[],
  query: string,
  searchKeys: readonly (keyof T)[]
): T[] {
  if (!query.trim()) {
    return [...items];
  }

  const lowerQuery = query.toLowerCase().trim();

  return items.filter(item =>
    searchKeys.some(key => {
      const value = item[key];

      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowerQuery);
      }

      if (Array.isArray(value)) {
        return value.some(
          entry => typeof entry === 'string' && entry.toLowerCase().includes(lowerQuery)
        );
      }

      return false;
    })
  );
}

/**
 * Return start/end match ranges for highlighting query within text.
 */
export function highlightMatch(text: string, query: string): { start: number; end: number }[] {
  if (!query.trim() || !text) return [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const ranges: { start: number; end: number }[] = [];
  let idx = 0;
  while (idx < lowerText.length) {
    const found = lowerText.indexOf(lowerQuery, idx);
    if (found === -1) break;
    ranges.push({ start: found, end: found + lowerQuery.length });
    idx = found + 1;
  }
  return ranges;
}

/**
 * Group typeahead items by their entity type.
 */
export function groupResultsByType(
  items: readonly TypeaheadItem[]
): Record<EntityType, TypeaheadItem[]> {
  const groups = TYPEAHEAD_ENTITY_ORDER.reduce<Record<EntityType, TypeaheadItem[]>>(
    (accumulator, entityType) => {
      accumulator[entityType] = [];
      return accumulator;
    },
    {} as Record<EntityType, TypeaheadItem[]>
  );

  for (const item of items) {
    groups[item.entityType].push(item);
  }

  return groups;
}

/**
 * Score-based sorting: label exact/prefix > label contains > secondary/keywords/hashtags > description.
 */
export function sortByRelevance(items: readonly TypeaheadItem[], query: string): TypeaheadItem[] {
  if (!query.trim()) {
    return [...items];
  }

  const lowerQuery = query.toLowerCase().trim();

  return [...items].sort((leftItem, rightItem) => {
    const leftScore = getRelevanceScore(leftItem, lowerQuery);
    const rightScore = getRelevanceScore(rightItem, lowerQuery);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const typeOrderDelta =
      TYPEAHEAD_ENTITY_ORDER.indexOf(leftItem.entityType) -
      TYPEAHEAD_ENTITY_ORDER.indexOf(rightItem.entityType);
    if (typeOrderDelta !== 0) {
      return typeOrderDelta;
    }

    return leftItem.label.localeCompare(rightItem.label);
  });
}

function getRelevanceScore(item: TypeaheadItem, lowerQuery: string): number {
  let score = 0;
  const lowerLabel = item.label.toLowerCase();

  if (lowerLabel === lowerQuery) {
    score += 120;
  } else if (lowerLabel.startsWith(lowerQuery)) {
    score += 60;
  } else if (lowerLabel.includes(lowerQuery)) {
    score += 30;
  }

  score += scoreTextValue(item.secondaryLabel, lowerQuery, 18, 12);
  score += scoreTextValue(item.description, lowerQuery, 8, 5);

  if (item.keywords?.some(keyword => keyword.toLowerCase().startsWith(lowerQuery))) {
    score += 16;
  } else if (item.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))) {
    score += 10;
  }

  if (item.hashtags?.some(tag => tag.toLowerCase().startsWith(lowerQuery))) {
    score += 14;
  } else if (item.hashtags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
    score += 9;
  }

  return score;
}

function scoreTextValue(
  value: string | undefined,
  lowerQuery: string,
  prefixScore: number,
  containsScore: number
) {
  if (!value) {
    return 0;
  }

  const lowerValue = value.toLowerCase();
  if (lowerValue.startsWith(lowerQuery)) {
    return prefixScore;
  }

  return lowerValue.includes(lowerQuery) ? containsScore : 0;
}
