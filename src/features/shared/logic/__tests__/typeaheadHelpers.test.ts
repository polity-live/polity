import { describe, expect, it } from 'vitest';
import {
  addUniqueTypeaheadValue,
  ALL_TYPEAHEAD_ENTITY_TYPES,
  DEFAULT_TYPEAHEAD_SEARCH_KEYS,
  filterItems,
  groupResultsByType,
  removeTypeaheadValue,
  sortByRelevance,
  TYPEAHEAD_ENTITY_ORDER,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';

const items: TypeaheadItem[] = [
  {
    id: 'user-1',
    entityType: 'user',
    label: 'Alice Example',
    secondaryLabel: '@alice',
    keywords: ['alice@example.com'],
  },
  {
    id: 'group-1',
    entityType: 'group',
    label: 'Budget Circle',
    description: 'Discusses the annual budget proposal',
    hashtags: ['budget'],
  },
  {
    id: 'agenda-1',
    entityType: 'agenda_item',
    label: 'Final Budget Vote',
    metadata: ['#2'],
    keywords: ['assembly'],
  },
  {
    id: 'blog-1',
    entityType: 'blog',
    label: 'Weekly recap',
    description: 'A budget summary for members',
  },
];

describe('typeaheadHelpers', () => {
  it('adds and removes multi selections without duplicates', () => {
    expect(addUniqueTypeaheadValue([], 'user-1')).toEqual(['user-1']);
    expect(addUniqueTypeaheadValue(['user-1'], 'user-1')).toEqual(['user-1']);
    expect(removeTypeaheadValue(['user-1', 'group-1'], 'user-1')).toEqual(['group-1']);
  });

  it('filters across labels, descriptions, hashtags, and keywords', () => {
    const filtered = filterItems(items, 'budget', DEFAULT_TYPEAHEAD_SEARCH_KEYS);

    expect(filtered.map(item => item.id)).toEqual(['group-1', 'agenda-1', 'blog-1']);
  });

  it('sorts by relevance and uses entity order as a tie-breaker', () => {
    const queryItems: TypeaheadItem[] = [
      { id: 'group-1', entityType: 'group', label: 'Budget', description: 'Group' },
      { id: 'user-1', entityType: 'user', label: 'Budget', description: 'User' },
      { id: 'blog-1', entityType: 'blog', label: 'Budget recap', description: 'Blog' },
    ];

    const sorted = sortByRelevance(queryItems, 'budget');

    expect(sorted.map(item => item.id)).toEqual(['user-1', 'group-1', 'blog-1']);
  });

  it('groups results with the shared mixed-entity ordering and excludes role from the mixed constant', () => {
    const grouped = groupResultsByType(items);

    expect(Object.keys(grouped)).toEqual(TYPEAHEAD_ENTITY_ORDER);
    expect(grouped.user.map(item => item.id)).toEqual(['user-1']);
    expect(grouped.agenda_item.map(item => item.id)).toEqual(['agenda-1']);
    expect(ALL_TYPEAHEAD_ENTITY_TYPES).toEqual([
      'event',
      'group',
      'amendment',
      'user',
      'blog',
      'todo',
      'vote',
      'election',
      'agenda_item',
    ]);
    expect(ALL_TYPEAHEAD_ENTITY_TYPES).not.toContain('role');
  });
});
