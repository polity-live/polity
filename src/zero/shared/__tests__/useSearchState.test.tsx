/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const calls: { key?: string; args?: unknown }[] = [];
  const search = new Proxy(
    {},
    {
      get: (_target, property: string) => (args: unknown) => ({ key: `search.${property}`, args }),
    }
  );
  return {
    results,
    calls,
    queries: { search },
    common: { timelineByContentTypes: undefined, allHashtags: undefined } as Record<
      string,
      unknown
    >,
    agendaItems: [] as unknown[],
    elections: [] as unknown[],
    useQuery: vi.fn((query?: { key?: string; args?: unknown }) => {
      calls.push(query ?? {});
      return [query?.key ? results.get(query.key) : undefined, { type: 'complete' }];
    }),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));
vi.mock('../../common/useCommonState', () => ({ useCommonState: () => mocks.common }));
vi.mock('../../agendas/useAgendaState', () => ({
  useAgendaState: () => ({ agendaItems: mocks.agendaItems, isLoading: false }),
}));
vi.mock('../../elections/useElectionState', () => ({
  useElectionState: () => ({ electionsForSearch: mocks.elections }),
}));

import {
  dedupeSearchItemsById,
  hasActiveSearchGroupMembership,
  normalizeSearchableGroup,
  normalizeSearchGroupMemberships,
  selectPrimarySearchGroupRole,
  useSearchState,
} from '../useSearchState';

const memberRole = { id: 'member', name: 'Member', sort_order: 1 };
const boardRole = { id: 'board', name: 'Board Member', sort_order: 2 };

beforeEach(() => {
  mocks.results.clear();
  mocks.calls.length = 0;
  mocks.useQuery.mockClear();
  mocks.common = { timelineByContentTypes: undefined, allHashtags: undefined };
  mocks.agendaItems = [];
  mocks.elections = [];
});

describe('search state normalization helpers', () => {
  it('selects and normalizes linked or legacy roles', () => {
    expect(selectPrimarySearchGroupRole([])).toBeNull();
    expect(
      selectPrimarySearchGroupRole([
        { id: 'none-a', sort_order: null },
        { id: 'none-b', sort_order: null },
        memberRole,
        boardRole,
      ])
    ).toBe(boardRole);
    expect(
      normalizeSearchGroupMemberships([
        {
          id: 'linked',
          membership_roles: [{ role: memberRole }, { role: null }, { role: boardRole }],
          role: memberRole,
        },
        { id: 'legacy', membership_roles: null, role: memberRole },
        { id: 'empty', role: null },
      ])
    ).toMatchObject([
      { roles: [memberRole, boardRole], role: boardRole },
      { roles: [], role: memberRole },
      { roles: [], role: null },
    ]);
    expect(normalizeSearchGroupMemberships(null)).toEqual([]);
    expect(normalizeSearchableGroup({ id: 'group', memberships: null })).toEqual({
      id: 'group',
      memberships: [],
    });
  });

  it('recognizes every active membership representation', () => {
    expect(hasActiveSearchGroupMembership({ status: 'active' })).toBe(true);
    expect(hasActiveSearchGroupMembership({ status: 'member' })).toBe(true);
    expect(hasActiveSearchGroupMembership({ status: 'admin' })).toBe(true);
    expect(hasActiveSearchGroupMembership({ status: 'other', role: boardRole })).toBe(true);
    expect(hasActiveSearchGroupMembership({ status: 'other', role: memberRole })).toBe(false);
    expect(hasActiveSearchGroupMembership(null)).toBe(false);
  });

  it('deduplicates by first occurrence', () => {
    expect(dedupeSearchItemsById([{ id: 'a', value: 1 }, { id: 'a', value: 2 }, { id: 'b' }])).toEqual([
      { id: 'a', value: 1 },
      { id: 'b' },
    ]);
  });
});

describe('useSearchState facade contract', () => {
  it('uses defaults and normalizes all absent query data', () => {
    const current = renderHook(() => useSearchState()).result.current;
    expect(current).toEqual({
      users: [],
      groups: [],
      statements: [],
      blogs: [],
      amendments: [],
      events: [],
      groupMemberships: [],
      todoAssignments: [],
      memberGroupIds: [],
      assignedTodoIds: [],
      todos: [],
      timelineEvents: [],
      agendaItems: [],
      elections: [],
      eventVotingSessions: [],
      allHashtags: [],
      isLoading: false,
    });
    expect(mocks.calls.filter(call => call.key === undefined)).toHaveLength(4);
    expect(mocks.calls.find(call => call.key === 'search.searchableUsers')?.args).toMatchObject({
      limit: 20,
      query: '',
    });
  });

  it('combines user-specific results, todo sources, and visible event children', () => {
    const values: Record<string, unknown> = {
      'search.searchableUsers': [{ id: 'user-1' }],
      'search.searchableGroups': [
        {
          id: 'group-1',
          memberships: [
            { membership_roles: [{ role: memberRole }, { role: boardRole }], role: null },
          ],
        },
      ],
      'search.searchableStatements': [{ id: 'statement-1' }],
      'search.searchableBlogs': [{ id: 'blog-1' }],
      'search.searchableAmendments': [{ id: 'amendment-1' }],
      'search.searchableEvents': [{ id: 'event-1' }, { id: 'event-2' }],
      'search.userGroupMemberships': [
        { id: 'active', status: 'active', group: { id: 'group-1' } },
        { id: 'member', status: 'member', group: { id: 'group-2' } },
        { id: 'admin', status: 'admin', group: { id: 'group-3' } },
        {
          id: 'board',
          status: 'other',
          group: { id: 'group-4' },
          membership_roles: [{ role: boardRole }],
        },
        { id: 'missing-group', status: 'active', group: null },
        { id: 'inactive', status: 'revoked', group: { id: 'group-5' } },
      ],
      'search.userTodoAssignments': [
        { id: 'assignment-1', todo: { id: 'assigned' } },
        { id: 'assignment-empty', todo: null },
      ],
      'search.searchableTodos': [{ id: 'public' }, { id: 'same' }],
      'search.searchableTodosByCreator': [{ id: 'created' }, { id: 'same' }],
      'search.searchableTodosByGroups': [{ id: 'group-todo' }],
    };
    for (const [key, value] of Object.entries(values)) mocks.results.set(key, value);
    mocks.common = {
      timelineByContentTypes: [{ id: 'timeline-1' }],
      allHashtags: [{ id: 'hashtag-1' }],
    };
    mocks.agendaItems = [
      { id: 'agenda-visible', event_id: 'event-1' },
      { id: 'agenda-hidden', event_id: 'event-3' },
      { id: 'agenda-no-event', event_id: null },
    ];
    mocks.elections = [{ id: 'election-1' }];

    const current = renderHook(() =>
      useSearchState({
        userId: 'user-1',
        query: 'needle',
        limits: {
          users: 1,
          groups: 2,
          statements: 3,
          blogs: 4,
          amendments: 5,
          events: 6,
          todos: 7,
          votingSessions: 8,
        },
      })
    ).result.current;

    expect(current).toMatchObject({
      users: [{ id: 'user-1' }],
      groups: [{ id: 'group-1', memberships: [{ role: boardRole }] }],
      statements: [{ id: 'statement-1' }],
      blogs: [{ id: 'blog-1' }],
      amendments: [{ id: 'amendment-1' }],
      events: [{ id: 'event-1' }, { id: 'event-2' }],
      memberGroupIds: ['group-1', 'group-2', 'group-3', 'group-4'],
      assignedTodoIds: ['assigned'],
      todos: [
        { id: 'public' },
        { id: 'same' },
        { id: 'created' },
        { id: 'group-todo' },
        { id: 'assigned' },
      ],
      timelineEvents: [{ id: 'timeline-1' }],
      agendaItems: [{ id: 'agenda-visible', event_id: 'event-1' }],
      elections: [{ id: 'election-1' }],
      allHashtags: [{ id: 'hashtag-1' }],
    });
    expect(mocks.calls.find(call => call.key === 'search.searchableTodosByGroups')?.args).toMatchObject({
      group_ids: ['group-1', 'group-2', 'group-3', 'group-4'],
      limit: 7,
      query: 'needle',
    });
  });

  it('keeps conditional todo queries disabled without eligible user data', () => {
    const current = renderHook(() => useSearchState({ userId: 'user-1' })).result.current;
    expect(current.groupMemberships).toEqual([]);
    expect(current.todoAssignments).toEqual([]);
    expect(mocks.calls.some(call => call.key === 'search.searchableTodosByGroups')).toBe(false);
  });
});
