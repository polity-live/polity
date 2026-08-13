import { describe, expect, it } from 'vitest';
import {
  addUniqueTypeaheadValue,
  ALL_TYPEAHEAD_ENTITY_TYPES,
  DEFAULT_TYPEAHEAD_SEARCH_KEYS,
  filterItems,
  getTypeaheadEntityGroupLabel,
  getTypeaheadEntityLabel,
  groupResultsByType,
  highlightMatch,
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

    expect(filterItems(items, '  ', DEFAULT_TYPEAHEAD_SEARCH_KEYS)).toEqual(items);
    expect(
      filterItems([{ mixed: [42, 'No match', 'Hit here'] }, { mixed: { nested: 'Hit' } }], 'hit', [
        'mixed',
      ])
    ).toEqual([{ mixed: [42, 'No match', 'Hit here'] }]);
  });

  it('translates singular and group labels and highlights repeated matches', () => {
    expect(getTypeaheadEntityLabel('user')).toBeTruthy();
    expect(getTypeaheadEntityGroupLabel('group')).toBeTruthy();
    expect(highlightMatch('Budget budgetary', 'budget')).toEqual([
      { start: 0, end: 6 },
      { start: 7, end: 13 },
    ]);
    expect(highlightMatch('Text', ' ')).toEqual([]);
    expect(highlightMatch('', 'text')).toEqual([]);
    expect(highlightMatch('Text', 'missing')).toEqual([]);
  });

  it('sorts by relevance and uses entity order as a tie-breaker', () => {
    const queryItems: TypeaheadItem[] = [
      { id: 'group-1', entityType: 'group', label: 'Budget', description: 'Group' },
      { id: 'user-1', entityType: 'user', label: 'Budget', description: 'User' },
      { id: 'blog-1', entityType: 'blog', label: 'Budget recap', description: 'Blog' },
    ];

    const sorted = sortByRelevance(queryItems, 'budget');

    expect(sorted.map(item => item.id)).toEqual(['user-1', 'group-1', 'blog-1']);
    expect(sortByRelevance(items, ' ')).toEqual(items);

    const base: TypeaheadItem = { id: 'base', entityType: 'blog', label: 'Nothing' };
    const variants: TypeaheadItem[] = [
      { id: 'label-contains', entityType: 'blog', label: 'A budget item' },
      { id: 'secondary-prefix', entityType: 'blog', label: 'Nothing', secondaryLabel: 'Budget' },
      {
        id: 'secondary-contains',
        entityType: 'blog',
        label: 'Nothing',
        secondaryLabel: 'A budget',
      },
      { id: 'secondary-none', entityType: 'blog', label: 'Nothing', secondaryLabel: 'Other' },
      { id: 'description-prefix', entityType: 'blog', label: 'Nothing', description: 'Budget' },
      { id: 'description-contains', entityType: 'blog', label: 'Nothing', description: 'A budget' },
      { id: 'description-none', entityType: 'blog', label: 'Nothing', description: 'Other' },
      { id: 'keyword-prefix', entityType: 'blog', label: 'Nothing', keywords: ['Budget'] },
      { id: 'keyword-contains', entityType: 'blog', label: 'Nothing', keywords: ['A budget'] },
      { id: 'keyword-none', entityType: 'blog', label: 'Nothing', keywords: ['Other'] },
      { id: 'hashtag-prefix', entityType: 'blog', label: 'Nothing', hashtags: ['Budget'] },
      { id: 'hashtag-contains', entityType: 'blog', label: 'Nothing', hashtags: ['A budget'] },
      { id: 'hashtag-none', entityType: 'blog', label: 'Nothing', hashtags: ['Other'] },
    ];
    for (const variant of variants) {
      expect(sortByRelevance([base, variant], 'bud')).toHaveLength(2);
    }

    expect(
      sortByRelevance(
        [
          { id: 'z', entityType: 'blog', label: 'Same z' },
          { id: 'a', entityType: 'blog', label: 'Same a' },
        ],
        'same'
      ).map(item => item.id)
    ).toEqual(['a', 'z']);
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
