/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  user: null as { id: string } | null,
  zeroRun: vi.fn(),
  active: vi.fn(),
  idle: vi.fn(),
  groupTasks: [] as { key: string; entries: never[]; route: { href: string } }[],
  eventTasks: [] as { key: string; entries: never[]; route: { href: string } }[],
  amendmentTasks: [] as { key: string; entries: never[]; route: { href: string } }[],
  userTasks: [] as { key: string; entries: never[]; route: { href: string } }[],
  blogTasks: [] as { key: string; entries: never[]; route: { href: string } }[],
  createGroupTasks: vi.fn(),
  createEventTasks: vi.fn(),
  createAmendmentTasks: vi.fn(),
  createUserTasks: vi.fn(),
  createBlogTasks: vi.fn(),
  wiki: vi.fn(),
  discoverAgenda: vi.fn(),
  createAgendaEntries: vi.fn(),
  query: vi.fn((name: string, args: unknown) => ({ name, args })),
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ run: mocks.zeroRun }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../preload-coordinator', () => ({
  useActivePreloadTask: mocks.active,
  useIdlePreloadTasks: mocks.idle,
}));

vi.mock('../route-manifests', () => ({
  createGroupPreloadTasks: mocks.createGroupTasks,
  createEventPreloadTasks: mocks.createEventTasks,
  createAmendmentPreloadTasks: mocks.createAmendmentTasks,
  createUserPreloadTasks: mocks.createUserTasks,
  createBlogPreloadTasks: mocks.createBlogTasks,
}));

vi.mock('../task-dependencies', () => ({
  withWikiTaskDependencies: mocks.wiki,
}));

vi.mock('../event-agenda', () => ({
  discoverEventAgendaPreloadDependencies: mocks.discoverAgenda,
  createEventAgendaDependentPreloadEntries: mocks.createAgendaEntries,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      byGroupActive: (args: unknown) => mocks.query('events.byGroupActive', args),
      agendaItemsFull: (args: unknown) => mocks.query('events.agendaItemsFull', args),
      byIdFull: (args: unknown) => mocks.query('events.byIdFull', args),
      groupRelationships: (args: unknown) => mocks.query('events.groupRelationships', args),
    },
    groups: {
      amendmentEventStepRunsByEventIds: (args: unknown) =>
        mocks.query('groups.amendmentEventStepRunsByEventIds', args),
    },
    amendments: {
      documentById: (args: unknown) => mocks.query('amendments.documentById', args),
      documentsByAmendment: (args: unknown) => mocks.query('amendments.documentsByAmendment', args),
    },
    documents: {
      threads: (args: unknown) => mocks.query('documents.threads', args),
      collaborators: (args: unknown) => mocks.query('documents.collaborators', args),
      versions: (args: unknown) => mocks.query('documents.versions', args),
    },
  },
}));

import {
  amendmentDocumentEntries,
  idRows,
  rotateAfter,
  rows,
  selectAmendmentTask,
  selectEventTask,
  selectGroupTask,
  selectUserTask,
  taskBySuffix,
  useAmendmentRouteFamilyPreloads,
  useBlogRouteFamilyPreloads,
  useEventRouteFamilyPreloads,
  useGroupRouteFamilyPreloads,
  useUserRouteFamilyPreloads,
} from '../entity-families';

function task(key: string) {
  return { key, entries: [] as never[], route: { href: `/${key}` } };
}

function tasksFor(prefix: string, suffixes: readonly string[]) {
  return suffixes.map(suffix => task(`${prefix}:${suffix}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/';
  mocks.user = { id: 'viewer-1' };
  mocks.groupTasks = tasksFor('group-1', ['overview', 'events', 'settings']);
  mocks.eventTasks = tasksFor('event-1', ['overview', 'agenda', 'network']);
  mocks.amendmentTasks = tasksFor('amendment-1', [
    'wiki',
    'text',
    'change-requests',
    'discussions',
    'settings',
  ]);
  mocks.userTasks = tasksFor('user-1', ['profile', 'settings']);
  mocks.blogTasks = tasksFor('blog-1', ['overview', 'text', 'settings']);
  mocks.createGroupTasks.mockImplementation(() => mocks.groupTasks);
  mocks.createEventTasks.mockImplementation(() => mocks.eventTasks);
  mocks.createAmendmentTasks.mockImplementation(() => mocks.amendmentTasks);
  mocks.createUserTasks.mockImplementation(() => mocks.userTasks);
  mocks.createBlogTasks.mockImplementation(() => mocks.blogTasks);
  mocks.wiki.mockImplementation(value => value);
  mocks.discoverAgenda.mockReturnValue({ amendmentIds: ['amendment-1'] });
  mocks.createAgendaEntries.mockReturnValue([{ key: 'agenda-dependent', query: {} }]);
});

describe('entity family normalization contracts', () => {
  it('normalizes only object rows and sorted unique string ids', () => {
    expect(rows(undefined)).toEqual([]);
    expect(rows([null, false, 3, 'row', { id: 'b' }, { id: 2 }, { id: 'a' }, { id: 'b' }])).toEqual(
      [{ id: 'b' }, { id: 2 }, { id: 'a' }, { id: 'b' }]
    );
    expect(idRows([{ id: 'b' }, { id: 2 }, { id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
  });

  it('finds suffix tasks and rotates idle work after the active task', () => {
    const tasks = tasksFor('scope', ['one', 'two', 'three']);
    expect(taskBySuffix(tasks, 'two')).toBe(tasks[1]);
    expect(taskBySuffix(tasks, 'missing')).toBeUndefined();
    expect(rotateAfter(tasks)).toEqual([]);
    expect(rotateAfter(tasks, tasks[1])).toEqual([tasks[2], tasks[0]]);
    expect(rotateAfter(tasks, task('other:two'))).toEqual(tasks);
  });
});

describe('route task selection contracts', () => {
  const allGroupTasks = tasksFor('group', [
    'overview',
    'operation',
    'events',
    'amendments',
    'blogs-and-statements',
    'network',
    'editor',
    'memberships',
    'notifications',
    'settings',
  ]);
  const allEventTasks = tasksFor('event', [
    'overview',
    'agenda',
    'network',
    'participants',
    'roles',
    'stream',
    'notifications',
    'settings',
  ]);

  it.each([
    ['/group/g', 'overview'],
    ['/group/g/', 'overview'],
    ['/group/g/operation/map', 'operation'],
    ['/group/g/events', 'events'],
    ['/group/g/amendments/one', 'amendments'],
    ['/group/g/blogs-and-statements', 'blogs-and-statements'],
    ['/group/g/network', 'network'],
    ['/group/g/relationships', 'network'],
    ['/group/g/editor', 'editor'],
    ['/group/g/memberships', 'memberships'],
    ['/group/g/notifications', 'notifications'],
    ['/group/g/settings', 'settings'],
  ])('selects group route %s', (pathname, suffix) => {
    expect(selectGroupTask(allGroupTasks, 'g', pathname)?.key).toBe(`group:${suffix}`);
  });

  it('does not select a group task for an unrelated path', () => {
    expect(selectGroupTask(allGroupTasks, 'g', '/group/g/unknown')).toBeUndefined();
  });

  it.each([
    ['/event/e', 'overview'],
    ['/event/e/', 'overview'],
    ['/event/e/agenda', 'agenda'],
    ['/event/e/network', 'network'],
    ['/event/e/participants', 'participants'],
    ['/event/e/roles', 'roles'],
    ['/event/e/stream', 'stream'],
    ['/event/e/notifications', 'notifications'],
    ['/event/e/settings', 'settings'],
  ])('selects event route %s', (pathname, suffix) => {
    expect(selectEventTask(allEventTasks, 'e', pathname)?.key).toBe(`event:${suffix}`);
  });

  it('does not select an event task for an unrelated path', () => {
    expect(selectEventTask(allEventTasks, 'e', '/event/e/unknown')).toBeUndefined();
  });

  it('selects amendment wiki and page tasks', () => {
    const tasks = tasksFor('amendment', ['wiki', 'text']);
    expect(selectAmendmentTask(tasks, 'a', '/amendment/a')?.key).toBe('amendment:wiki');
    expect(selectAmendmentTask(tasks, 'a', '/amendment/a/')?.key).toBe('amendment:wiki');
    expect(selectAmendmentTask(tasks, 'a', '/amendment/a/text/history')?.key).toBe(
      'amendment:text'
    );
    expect(selectAmendmentTask(tasks, 'a', '/elsewhere')).toBeUndefined();
  });

  it('selects user profile/page tasks but leaves nested blogs to the blog family', () => {
    const tasks = tasksFor('user', ['profile', 'settings']);
    expect(selectUserTask(tasks, 'u', '/user/u')?.key).toBe('user:profile');
    expect(selectUserTask(tasks, 'u', '/user/u/')?.key).toBe('user:profile');
    expect(selectUserTask(tasks, 'u', '/user/u/settings/security')?.key).toBe('user:settings');
    expect(selectUserTask(tasks, 'u', '/user/u/blog/blog-1')).toBeUndefined();
    expect(selectUserTask(tasks, 'u', '/elsewhere')).toBeUndefined();
    expect(selectUserTask(tasks, 'u', '')).toBeUndefined();
  });
});

describe('dependent preload entry contracts', () => {
  it('creates thread entries for discussion documents', () => {
    expect(amendmentDocumentEntries('discussions', ['doc-1'])).toMatchObject([
      { key: expect.stringContaining('queries.amendments.documentById') },
      { key: expect.stringContaining('queries.documents.threads') },
    ]);
  });

  it('creates collaborator and version entries for editable document pages', () => {
    expect(amendmentDocumentEntries('text', ['doc-1', 'doc-2'])).toHaveLength(6);
  });
});

describe('entity family hook contracts', () => {
  it('builds group tasks, rotates idle work, and discovers dependent event step runs', async () => {
    mocks.pathname = '/group/group-1/events';
    mocks.zeroRun.mockResolvedValueOnce([
      { id: 'event-b' },
      { id: 'event-a' },
      { id: 'event-b' },
      { id: 3 },
    ]);

    renderHook(() => useGroupRouteFamilyPreloads('group-1'));

    expect(mocks.createGroupTasks).toHaveBeenCalledWith('group-1', 'viewer-1');
    expect(mocks.wiki).toHaveBeenCalledTimes(3);
    const activeTask = mocks.active.mock.calls.at(-1)?.[0];
    expect(activeTask.key).toBe('group-1:events');
    expect(mocks.idle).toHaveBeenCalledWith(
      'group:group-1',
      expect.arrayContaining([
        expect.objectContaining({ key: 'group-1:settings' }),
        expect.objectContaining({ key: 'group-1:overview' }),
      ]),
      2,
      true
    );
    await expect(activeTask.resolveAfterComplete()).resolves.toMatchObject([
      { key: expect.stringContaining('event-a') },
    ]);

    mocks.zeroRun.mockResolvedValueOnce([]);
    await expect(activeTask.resolveAfterComplete()).resolves.toEqual([]);
  });

  it('uses an empty group family without an authenticated actor or group id', () => {
    mocks.user = null;
    renderHook(() => useGroupRouteFamilyPreloads('group-1'));
    expect(mocks.createGroupTasks).not.toHaveBeenCalled();
    expect(mocks.idle).toHaveBeenLastCalledWith('group:group-1', [], 2, true);

    mocks.user = { id: 'viewer-1' };
    renderHook(() => useGroupRouteFamilyPreloads());
    expect(mocks.idle).toHaveBeenLastCalledWith('group:none', [], 2, true);
  });

  it('discovers event agenda dependencies', async () => {
    mocks.pathname = '/event/event-1/agenda';
    const agendaRows = [{ id: 'agenda-1' }];
    mocks.zeroRun.mockResolvedValueOnce(agendaRows);
    renderHook(() => useEventRouteFamilyPreloads('event-1'));

    const activeTask = mocks.active.mock.calls.at(-1)?.[0];
    await expect(activeTask.resolveAfterComplete()).resolves.toEqual([
      { key: 'agenda-dependent', query: {} },
    ]);
    expect(mocks.discoverAgenda).toHaveBeenCalledWith(agendaRows, 'viewer-1');
    expect(mocks.createAgendaEntries).toHaveBeenCalledWith({ amendmentIds: ['amendment-1'] });
  });

  it('discovers an event group relationship only for a string group id', async () => {
    mocks.pathname = '/event/event-1/network';
    mocks.zeroRun.mockResolvedValueOnce([{ group_id: 'group-1' }]);
    renderHook(() => useEventRouteFamilyPreloads('event-1'));
    const activeTask = mocks.active.mock.calls.at(-1)?.[0];
    await expect(activeTask.resolveAfterComplete()).resolves.toMatchObject([
      { key: expect.stringContaining('group-1') },
    ]);

    mocks.zeroRun.mockResolvedValueOnce([{ group_id: 42 }]);
    await expect(activeTask.resolveAfterComplete()).resolves.toEqual([]);
    mocks.zeroRun.mockResolvedValueOnce(null);
    await expect(activeTask.resolveAfterComplete()).resolves.toEqual([]);
  });

  it('uses empty event families for missing actors and ids', () => {
    mocks.user = null;
    renderHook(() => useEventRouteFamilyPreloads('event-1'));
    mocks.user = { id: 'viewer-1' };
    renderHook(() => useEventRouteFamilyPreloads());
    expect(mocks.createEventTasks).not.toHaveBeenCalled();
    expect(mocks.idle).toHaveBeenLastCalledWith('event:none', [], 2, true);
  });

  it('adds document dependencies only to amendment document pages', async () => {
    mocks.pathname = '/amendment/amendment-1/discussions';
    mocks.amendmentTasks = [
      task(''),
      ...tasksFor('amendment-1', ['wiki', 'text', 'change-requests', 'discussions', 'settings']),
    ];
    mocks.zeroRun.mockResolvedValueOnce([{ id: 'doc-b' }, { id: 'doc-a' }]);
    renderHook(() => useAmendmentRouteFamilyPreloads('amendment-1'));

    const activeTask = mocks.active.mock.calls.at(-1)?.[0];
    await expect(activeTask.resolveAfterComplete()).resolves.toHaveLength(4);
    const idleTasks = mocks.idle.mock.calls.at(-1)?.[1];
    expect(
      idleTasks.find((item: { key: string }) => item.key === 'amendment-1:text')
    ).toHaveProperty('resolveAfterComplete');
    expect(
      idleTasks.find((item: { key: string }) => item.key === 'amendment-1:settings')
    ).not.toHaveProperty('resolveAfterComplete');
  });

  it('uses empty amendment families for missing actors and ids', () => {
    mocks.user = null;
    renderHook(() => useAmendmentRouteFamilyPreloads('amendment-1'));
    mocks.user = { id: 'viewer-1' };
    renderHook(() => useAmendmentRouteFamilyPreloads());
    expect(mocks.createAmendmentTasks).not.toHaveBeenCalled();
    expect(mocks.idle).toHaveBeenLastCalledWith('amendment:none', [], 2, true);
  });

  it('builds authenticated user tasks and supports absent inputs', () => {
    mocks.pathname = '/user/user-1/settings';
    renderHook(() => useUserRouteFamilyPreloads('user-1', true));
    expect(mocks.createUserTasks).toHaveBeenCalledWith('user-1', true);
    expect(mocks.active.mock.calls.at(-1)?.[0].key).toBe('user-1:settings');

    mocks.user = null;
    renderHook(() => useUserRouteFamilyPreloads('user-1'));
    mocks.user = { id: 'viewer-1' };
    renderHook(() => useUserRouteFamilyPreloads());
    expect(mocks.idle).toHaveBeenLastCalledWith('user:none', [], 2, true);
  });

  it.each([
    ['/blog/blog-1', '/blog/blog-1', 'blog-1:overview'],
    ['/blog/blog-1/', '/blog/blog-1', 'blog-1:overview'],
    ['/blog/blog-1/text/history', '/blog/blog-1', 'blog-1:text'],
    ['/group/group-1/blog/blog-1/settings', '/group/group-1/blog/blog-1', 'blog-1:settings'],
    ['/user/user-1/blog/blog-1', '/user/user-1/blog/blog-1', 'blog-1:overview'],
  ])('builds blog tasks at route %s', (pathname, expectedBase, expectedKey) => {
    mocks.pathname = pathname;
    renderHook(() => useBlogRouteFamilyPreloads('blog-1'));
    expect(mocks.createBlogTasks).toHaveBeenCalledWith('blog-1', expectedBase, 'viewer-1');
    expect(mocks.active.mock.calls.at(-1)?.[0].key).toBe(expectedKey);
  });

  it('does not build or activate blog tasks for absent and unrelated contexts', () => {
    renderHook(() => useBlogRouteFamilyPreloads());
    expect(mocks.idle).toHaveBeenLastCalledWith('blog:none', [], 2, true);

    mocks.user = null;
    renderHook(() => useBlogRouteFamilyPreloads('blog-1'));
    expect(mocks.createBlogTasks).not.toHaveBeenCalled();

    mocks.user = { id: 'viewer-1' };
    mocks.pathname = '/unrelated';
    renderHook(() => useBlogRouteFamilyPreloads('blog-1'));
    expect(mocks.active).toHaveBeenLastCalledWith(undefined);
  });
});
