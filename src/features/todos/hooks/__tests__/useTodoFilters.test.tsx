/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTodoFilters } from '../useTodoFilters';

const mocks = vi.hoisted(() => ({
  collection: vi.fn((options: Record<string, any>) => ({
    filteredItems: options.sortItems(options.items),
    query: '',
  })),
}));

vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: mocks.collection,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function todo(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'todo',
    title: 'Title',
    description: null,
    status: 'pending',
    priority: 'medium',
    due_date: null,
    created_at: 1,
    archived_at: null,
    tags: null,
    assignments: null,
    creator: null,
    ...overrides,
  } as any;
}

function latestOptions() {
  return mocks.collection.mock.calls.at(-1)?.[0] as Record<string, any>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00'));
  mocks.collection.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTodoFilters', () => {
  it('builds empty/default collection state and exposes every field getter', () => {
    const { result } = renderHook(() => useTodoFilters(undefined, undefined));

    expect(result.current.selectedTab).toBe('all');
    expect(result.current.filteredTodos).toEqual([]);
    expect(result.current.fields).toHaveLength(10);
    expect(result.current.quickFilters).toHaveLength(7);
    expect(latestOptions()).toMatchObject({
      items: [],
      storageKey: undefined,
      groupId: undefined,
    });

    const sample = todo({
      title: 'Search title',
      description: 'Description',
      status: 'in_progress',
      priority: 'high',
      due_date: new Date('2026-08-09T15:00:00').getTime(),
      created_at: 123,
      tags: ['alpha'],
      creator: { id: 'creator' },
      assignments: [{ user: { id: 'assignee' } }, { user: null }],
    });
    const fields = Object.fromEntries(
      result.current.fields.map(field => [field.key, field])
    ) as Record<string, any>;
    expect(fields.title.getValue(sample)).toBe('Search title');
    expect(fields.description.getValue(sample)).toBe('Description');
    expect(fields.status.getValue(sample)).toBe('in_progress');
    expect(fields.priority.getValue(sample)).toBe('high');
    expect(fields.due_date_preset.getValue(sample)).toBe('today');
    expect(fields.creator_id.getValue(sample)).toBe('creator');
    expect(fields.tags.getValue(sample)).toEqual(['alpha']);
    expect(fields.assignee_ids.getValue(sample)).toEqual(['assignee']);
    expect(fields.due_date.getValue(sample)).toBeTypeOf('number');
    expect(fields.created_at.getValue(sample)).toBe(123);
    expect(fields.tags.getValue(todo())).toEqual([]);
    expect(fields.assignee_ids.getValue(todo())).toEqual([]);

    const dateQuickFilter = result.current.quickFilters.find(
      filter => filter.fieldKey === 'due_date'
    ) as any;
    expect(dateQuickFilter.serializeValue([])).toBeNull();
    expect(dateQuickFilter.serializeValue(['2026-08-10'])).toBeTypeOf('number');
  });

  it('derives labels, search/typeahead values, tags, due presets, and user scope', () => {
    const day = 24 * 60 * 60 * 1_000;
    const today = new Date('2026-08-09T12:00:00').getTime();
    const todos = [
      todo({
        id: 'creator-match',
        creator: { id: 'user', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' },
        assignments: [
          { user: { id: 'user-2', handle: 'handle-2', email: 'two@example.test' } },
          { user: { id: '' } },
        ],
        tags: ['zeta', 'alpha'],
        due_date: today - day,
      }),
      todo({
        id: 'assignee-match',
        creator: { id: 'creator-email', email: 'creator@example.test' },
        assignments: [{ user: { id: 'user', email: 'user@example.test' } }],
        tags: ['alpha'],
        due_date: today + day,
        created_at: 2,
      }),
      todo({
        id: 'other',
        creator: { id: 'creator-id' },
        assignments: [{ user: { id: 'assignee-id' } }],
        due_date: new Date('2026-08-10T12:00:00').getTime() + 7 * day,
      }),
      todo({ id: 'no-user', creator: { id: '' }, assignments: [{ user: null }] }),
    ];
    const { result } = renderHook(() =>
      useTodoFilters(todos, 'user', { storageKey: 'todos', groupId: 'group' })
    );

    expect(result.current.filteredTodos.map(item => item.id)).toEqual([
      'creator-match',
      'assignee-match',
    ]);
    expect(latestOptions()).toMatchObject({ storageKey: 'todos', groupId: 'group' });
    const assigneeFilter = result.current.quickFilters.find(
      filter => filter.fieldKey === 'assignee_ids'
    ) as any;
    expect(assigneeFilter.typeaheadItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'user', label: 'user@example.test' }),
        expect.objectContaining({ id: 'user-2', label: 'handle-2', secondaryLabel: 'handle-2' }),
        expect.objectContaining({ id: 'assignee-id', label: 'assignee-id' }),
      ])
    );
    const creatorFilter = result.current.quickFilters.find(
      filter => filter.fieldKey === 'creator_id'
    ) as any;
    expect(creatorFilter.typeaheadItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'user', label: 'Ada Lovelace' }),
        expect.objectContaining({ id: 'creator-email', label: 'creator@example.test' }),
        expect.objectContaining({ id: 'creator-id', label: 'creator-id' }),
      ])
    );
    const tagField = result.current.fields.find(field => field.key === 'tags') as any;
    expect(tagField.options).toEqual([
      { value: 'alpha', label: 'alpha' },
      { value: 'zeta', label: 'zeta' },
    ]);

    const dueField = result.current.fields.find(field => field.key === 'due_date_preset') as any;
    expect(dueField.getValue(todo())).toBeNull();
    expect(dueField.getValue(todo({ due_date: today - day }))).toBe('yesterday');
    expect(dueField.getValue(todo({ due_date: today }))).toBe('today');
    expect(dueField.getValue(todo({ due_date: today + day }))).toBe('tomorrow');
    expect(
      dueField.getValue(todo({ due_date: new Date('2026-08-10T12:00:00').getTime() + 2 * day }))
    ).toBe('next_week');
    expect(dueField.getValue(todo({ due_date: today + 30 * day }))).toBeNull();

    const searchValues = latestOptions().searchValues[0];
    expect(searchValues(todos[0])).toEqual(
      expect.arrayContaining(['Title', 'zeta', 'alpha', 'handle-2 two@example.test'])
    );
    expect(searchValues(todo())).toEqual(['Title']);
  });

  it('switches active/status/archive tabs and applies every sort fallback', () => {
    const todos = [
      todo({ id: 'pending', status: 'pending', created_at: 1 }),
      todo({ id: 'completed', status: 'completed', created_at: 2 }),
      todo({ id: 'archived-old', archived_at: 3 }),
      todo({ id: 'archived-new', archived_at: 4 }),
    ];
    const { result, rerender } = renderHook(
      ({ archiveMode }: { archiveMode?: 'active' | 'archived' }) =>
        useTodoFilters(todos, undefined, { archiveMode }),
      { initialProps: { archiveMode: 'active' as 'active' | 'archived' } }
    );

    expect(result.current.filteredTodos.map(item => item.id)).toEqual(['completed', 'pending']);
    const activeSortItems = latestOptions().sortItems;
    act(() => result.current.setSelectedTab('completed'));
    expect(result.current.filteredTodos.map(item => item.id)).toEqual(['completed']);
    act(() => result.current.setSelectedTab('archived'));
    expect(result.current.filteredTodos.map(item => item.id)).toEqual([
      'archived-new',
      'archived-old',
    ]);

    rerender({ archiveMode: 'archived' });
    expect(result.current.filteredTodos.map(item => item.id)).toEqual([
      'archived-new',
      'archived-old',
    ]);

    const due1 = todo({ id: 'due-1', due_date: 1, created_at: 1 });
    const due2 = todo({ id: 'due-2', due_date: 2, created_at: 2 });
    const noDue = todo({ id: 'no-due', due_date: null, created_at: 3 });
    expect(activeSortItems([due2, due1, noDue]).map((item: any) => item.id)).toEqual([
      'due-1',
      'due-2',
      'no-due',
    ]);
    expect(activeSortItems([noDue, due1]).map((item: any) => item.id)).toEqual(['due-1', 'no-due']);
    expect(activeSortItems([due1, noDue]).map((item: any) => item.id)).toEqual(['due-1', 'no-due']);
  });
});
