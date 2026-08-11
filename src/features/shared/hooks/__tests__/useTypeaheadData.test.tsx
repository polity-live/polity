// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'en' as 'de' | 'en',
  user: undefined as { id: string } | undefined,
  users: undefined as any[] | undefined,
  groups: undefined as any[] | undefined,
  events: undefined as any[] | undefined,
  amendments: undefined as any[] | undefined,
  roles: undefined as any[] | undefined,
  elections: undefined as any[] | undefined,
  votes: [] as any[],
  search: {} as Record<string, any>,
  userOptions: vi.fn(),
  groupOptions: vi.fn(),
  electionOptions: vi.fn(),
  voteOptions: vi.fn(),
  searchOptions: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: (options: unknown) => {
    mocks.userOptions(options);
    return { allUsers: mocks.users };
  },
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: (options: unknown) => {
    mocks.groupOptions(options);
    return { searchResults: mocks.groups };
  },
}));

vi.mock('@/zero/events/useEventState', () => ({
  useAllEvents: () => ({ events: mocks.events }),
  useAllAmendments: () => ({ amendments: mocks.amendments }),
  useRolesWithGroups: () => ({ roles: mocks.roles }),
}));

vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: (options: unknown) => {
    mocks.electionOptions(options);
    return { electionsForSearch: mocks.elections };
  },
}));

vi.mock('@/zero/votes/useVoteState', () => ({
  useVoteState: (options: unknown) => {
    mocks.voteOptions(options);
    return { votesWithDetails: mocks.votes };
  },
}));

vi.mock('@/zero/shared/useSearchState', () => ({
  useSearchState: (options: unknown) => {
    mocks.searchOptions(options);
    return mocks.search;
  },
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (value: unknown) => (value ? ['civic'] : []),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'text' in value) {
      return String((value as { text?: unknown }).text ?? '');
    }
    return '';
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  }),
}));

import { useTypeaheadData } from '../useTypeaheadData';

const allEntityTypes = [
  'user',
  'group',
  'event',
  'amendment',
  'blog',
  'todo',
  'vote',
  'election',
  'agenda_item',
  'role',
] as const;

describe('useTypeaheadData', () => {
  beforeEach(() => {
    mocks.language = 'en';
    mocks.user = undefined;
    mocks.users = undefined;
    mocks.groups = undefined;
    mocks.events = undefined;
    mocks.amendments = undefined;
    mocks.roles = undefined;
    mocks.elections = undefined;
    mocks.votes = [];
    mocks.search = {};
    mocks.userOptions.mockClear();
    mocks.groupOptions.mockClear();
    mocks.electionOptions.mockClear();
    mocks.voteOptions.mockClear();
    mocks.searchOptions.mockClear();
  });

  it('disables every optional source when no entity type is requested', () => {
    const { result } = renderHook(() => useTypeaheadData({ entityTypes: [] }));

    expect(result.current.items).toEqual([]);
    expect(mocks.userOptions).toHaveBeenLastCalledWith({ includeAllUsers: false });
    expect(mocks.groupOptions).toHaveBeenLastCalledWith({ includeSearch: false });
    expect(mocks.electionOptions).toHaveBeenLastCalledWith({ includeElectionsForSearch: false });
    expect(mocks.voteOptions).toHaveBeenLastCalledWith({ includeVotesWithDetails: false });
    expect(mocks.searchOptions).toHaveBeenLastCalledWith({
      userId: undefined,
      limits: {
        users: 1,
        groups: 1,
        statements: 1,
        blogs: 1,
        amendments: 1,
        events: 1,
        todos: 1,
      },
    });
  });

  it('normalizes every rich entity shape, relation, label fallback, and metadata path', () => {
    mocks.language = 'de';
    mocks.user = { id: 'viewer' };
    mocks.users = [
      {
        id: 'u-name',
        first_name: 'Ada',
        last_name: 'Lovelace',
        handle: 'ada',
        email: 'ada@example.test',
        avatar: 'ada.png',
        user_hashtags: [{ hashtag: { tag: 'math' } }],
      },
      { id: 'u-handle', first_name: null, last_name: null, handle: 'handle', email: null },
      { id: 'u-email', handle: null, email: 'email@example.test' },
      { id: 'u-fallback', handle: null, email: null },
    ];
    mocks.groups = [
      {
        id: 'g-rich',
        name: 'Civic Group',
        visibility: 'public',
        description: { text: 'A'.repeat(140) },
        image_url: 'group.png',
        email: 'group@example.test',
        city: 'Berlin',
        country: 'DE',
        group_hashtags: [{ hashtag: { tag: 'local' } }],
      },
      { id: 'g-fallback', name: null, visibility: null, description: null },
    ];
    mocks.events = [
      {
        id: 'event-rich',
        title: 'Assembly',
        status: 'scheduled',
        description: 'Description',
        event_hashtags: [{}],
        location_name: 'Hall',
        event_type: 'meeting',
        start_date: Date.UTC(2026, 0, 2),
      },
      { id: 'event-invalid', title: null, start_date: 'not-a-date' },
      { id: 'event-empty', title: '', start_date: null },
    ];
    mocks.amendments = [
      {
        id: 'amendment-rich',
        title: 'Proposal',
        code: 'P-1',
        reason: 'Reason',
        category: 'policy',
        amendment_hashtags: [{}],
      },
      { id: 'amendment-fallback', title: null, code: null, reason: null },
    ];
    mocks.search = {
      blogs: [
        {
          id: 'blog-rich',
          title: 'News',
          description: 'Summary',
          content: 'Body',
          group: { name: 'Writers' },
          blog_hashtags: [{}],
          bloggers: [
            {
              user: { first_name: 'Grace', last_name: 'Hopper', handle: 'grace', email: 'g@test' },
            },
            { user: null },
          ],
        },
        { id: 'blog-empty', title: null, description: null, content: 'Fallback body' },
      ],
      todos: [
        {
          id: 'todo-rich',
          title: 'Ship',
          description: 'Do it',
          group: { name: 'Delivery' },
          creator: { first_name: 'Creator', handle: 'creator' },
          tags: ['urgent'],
          assignments: [
            { user: { first_name: 'Assigned', handle: 'assigned', email: 'a@test' } },
            { user: null },
          ],
        },
        { id: 'todo-empty', title: null, creator: null, assignments: null, tags: null },
      ],
      agendaItems: [
        {
          id: 'agenda-rich',
          title: 'Budget',
          description: 'Budget details',
          type: 'vote',
          order_index: 0,
          event: { id: 'visible-event', title: 'Annual meeting' },
          amendment: { title: 'Budget amendment' },
          election: [{ title: 'Treasurer' }],
        },
        { id: 'agenda-empty', title: null, order_index: null, event: null, election: null },
      ],
      events: [{ id: 'visible-event' }],
    };
    mocks.votes = [
      {
        id: 'vote-agenda',
        agenda_item_id: 'agenda-rich',
        title: 'Final vote',
        status: 'open',
        description: 'Choose',
        amendment: { title: 'Amendment' },
        agenda_item: {
          title: 'Agenda title',
          event: { id: 'other-event', title: 'Other event' },
        },
        choices: [{ label: 'Yes' }],
      },
      {
        id: 'vote-event',
        agenda_item_id: 'unknown',
        title: null,
        amendment: { title: 'Amendment fallback' },
        agenda_item: {
          title: 'Agenda fallback',
          event: { id: 'visible-event', title: 'Annual meeting' },
        },
        choices: null,
      },
      {
        id: 'vote-hidden',
        agenda_item_id: 'hidden',
        agenda_item: { event: { id: 'hidden-event' } },
      },
      { id: 'vote-no-event', agenda_item_id: 'hidden', agenda_item: null },
    ];
    mocks.elections = [
      {
        id: 'election-rich',
        title: 'Board',
        description: 'Elect',
        role: { name: 'Chair', group: { name: 'Council' } },
        agenda_item: { title: 'Election item', event: { title: 'Congress' } },
        candidates: [{ id: 'candidate' }],
      },
      {
        id: 'election-role',
        title: null,
        role: { name: 'Secretary', group: null },
        candidates: null,
      },
      { id: 'election-fallback', title: null, role: null, agenda_item: null },
    ];
    mocks.roles = [
      {
        id: 'role-rich',
        name: 'Moderator',
        description: 'Keeps order',
        scope: 'group',
        group: { name: 'Forum' },
      },
      { id: 'role-empty', name: null, description: null, scope: null, group: null },
    ];

    const { result } = renderHook(() => useTypeaheadData({ entityTypes: [...allEntityTypes] }));

    expect(mocks.userOptions).toHaveBeenLastCalledWith({ includeAllUsers: true });
    expect(mocks.groupOptions).toHaveBeenLastCalledWith({ includeSearch: true });
    expect(mocks.electionOptions).toHaveBeenLastCalledWith({ includeElectionsForSearch: true });
    expect(mocks.voteOptions).toHaveBeenLastCalledWith({ includeVotesWithDetails: true });
    expect(mocks.searchOptions).toHaveBeenLastCalledWith({
      userId: 'viewer',
      limits: {
        users: 1,
        groups: 1,
        statements: 1,
        blogs: 500,
        amendments: 1,
        events: 500,
        todos: 500,
      },
    });

    const byId = new Map(result.current.items.map(item => [item.id, item]));
    expect(result.current.items).toHaveLength(24);
    expect(byId.get('u-name')).toMatchObject({
      label: 'Ada Lovelace',
      secondaryLabel: '@ada',
      description: 'ada@example.test',
      hashtags: ['civic'],
      url: '/user/u-name',
    });
    expect(byId.get('u-handle')?.label).toBe('handle');
    expect(byId.get('u-email')?.label).toBe('email@example.test');
    expect(byId.get('u-fallback')?.label).toBe('common.entities.user');
    expect(byId.get('g-rich')?.description).toHaveLength(120);
    expect(byId.get('g-fallback')?.label).toBe('common.entities.group');
    expect(byId.get('event-rich')?.metadata).toHaveLength(2);
    expect(byId.get('event-invalid')?.metadata).toEqual([]);
    expect(byId.get('amendment-fallback')?.label).toBe('common.entities.amendment');
    expect(byId.get('blog-rich')?.metadata).toEqual(['Grace Hopper', 'common.entities.user']);
    expect(byId.get('blog-empty')?.description).toBe('Fallback body');
    expect(byId.get('todo-rich')?.metadata).toEqual([
      'common.typeahead.creator:Creator',
      'common.typeahead.assignedCount:2',
    ]);
    expect(byId.get('todo-empty')?.metadata).toEqual([]);
    expect(byId.get('agenda-rich')?.url).toBe('/event/visible-event/agenda/agenda-rich');
    expect(byId.get('agenda-empty')?.url).toBeUndefined();
    expect(byId.has('vote-agenda')).toBe(true);
    expect(byId.has('vote-event')).toBe(true);
    expect(byId.has('vote-hidden')).toBe(false);
    expect(byId.has('vote-no-event')).toBe(false);
    expect(byId.get('election-rich')?.secondaryLabel).toBe('Council');
    expect(byId.get('election-role')?.label).toBe('Secretary');
    expect(byId.get('election-fallback')?.label).toBe('common.entities.election');
    expect(byId.get('role-empty')?.label).toBe('common.entities.role');
  });

  it('keeps votes visible when no search visibility scope exists and formats English dates', () => {
    mocks.language = 'en';
    mocks.events = [{ id: 'event', title: 'Event', start_date: '2026-02-03T00:00:00Z' }];
    mocks.votes = [
      {
        id: 'vote',
        title: null,
        amendment: null,
        agenda_item: { title: null, event: null },
        choices: [],
      },
    ];
    mocks.search = { agendaItems: [], events: [] };

    const { result } = renderHook(() => useTypeaheadData({ entityTypes: ['event', 'vote'] }));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]?.metadata).toHaveLength(1);
    expect(result.current.items[1]).toMatchObject({
      id: 'vote',
      label: 'common.entities.vote',
      metadata: ['common.typeahead.choicesCount:0'],
    });
  });

  it('treats omitted search collections as empty and checks event visibility after a missing agenda id', () => {
    mocks.search = {};
    mocks.elections = undefined;

    const emptyCollections = renderHook(() =>
      useTypeaheadData({
        entityTypes: ['blog', 'todo', 'agenda_item', 'vote', 'election'],
      })
    );
    expect(emptyCollections.result.current.items).toEqual([]);

    mocks.search = { events: [{ id: 'visible' }] };
    mocks.votes = [
      {
        id: 'event-visible-vote',
        agenda_item_id: undefined,
        agenda_item: { event: { id: 'visible' } },
      },
    ];
    const eventVisible = renderHook(() => useTypeaheadData({ entityTypes: ['vote'] }));
    expect(eventVisible.result.current.items.map(item => item.id)).toEqual(['event-visible-vote']);

    mocks.search = {};
    const blogOnly = renderHook(() => useTypeaheadData({ entityTypes: ['blog'] }));
    expect(blogOnly.result.current.items).toEqual([]);
    expect(mocks.searchOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ limits: expect.objectContaining({ events: 1 }) })
    );
  });
});
