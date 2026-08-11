/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const queryFamily = (family: string) =>
    new Proxy(
      {},
      {
        get: (_target, property: string) => (args: unknown) => ({
          key: `${family}.${property}`,
          args,
        }),
      }
    );

  return {
    results,
    statuses,
    queries: {
      amendments: queryFamily('amendments'),
      documents: queryFamily('documents'),
    },
    useQuery: vi.fn((query?: { key?: string }) => [
      query?.key ? results.get(query.key) : undefined,
      { type: query?.key ? (statuses.get(query.key) ?? 'complete') : 'complete' },
    ]),
    buildNetworkMeta: vi.fn(() => new Map([['group-1', { depth: 2 }]])),
    normalizeRelationships: vi.fn((rows: unknown[]) =>
      rows.map(row => ({ ...(row as Record<string, unknown>), normalized: true }))
    ),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  buildDerivedGroupNetworkMetaMap: mocks.buildNetworkMeta,
  deriveNormalizedGroupRelationships: mocks.normalizeRelationships,
}));

import {
  useAgendaItemForwardingContext,
  useAmendmentState,
  useCurrentUserOpenNavigationAmendments,
} from '../useAmendmentState';

beforeEach(() => {
  mocks.results.clear();
  mocks.statuses.clear();
  mocks.useQuery.mockClear();
  mocks.buildNetworkMeta.mockClear();
  mocks.normalizeRelationships.mockClear();
});

describe('useAmendmentState', () => {
  it('keeps every optional query disabled and exposes stable empty defaults', () => {
    const current = renderHook(() => useAmendmentState()).result.current;

    expect(current).toMatchObject({
      amendment: undefined,
      collaborators: [],
      changeRequests: [],
      discussions: [],
      collaboration: null,
      status: null,
      isCollaborator: false,
      isAdmin: false,
      hasRequested: false,
      isInvited: false,
      collaboratorCount: 0,
      collaboratorStats: { total: 0, admins: 0, members: 0, invited: 0 },
      subscribers: undefined,
      isSubscribed: false,
      subscriberCount: 0,
      clones: [],
      threads: [],
      documents: [],
      changeRequestsWithVotes: [],
      cityDesigns: [],
      primaryCityDesign: null,
      roles: [],
      amendmentVotes: [],
      supportConfirmations: [],
      documentVersions: [],
      collaboratorsByUser: [],
      supportConfirmationsByGroup: [],
      allGroups: [],
      allGroupRelationships: [],
      allGroupMemberships: [],
      allEvents: [],
      userMemberships: [],
      allUsers: [],
      eventsByGroup: [],
      isLoading: false,
    });
    expect(mocks.useQuery).toHaveBeenCalledTimes(26);
    expect(mocks.useQuery.mock.calls.every(([query]) => query === undefined)).toBe(true);
  });

  it('loads every optional slice and derives collaboration, subscription, and network state', () => {
    mocks.results.set('amendments.byIdWiki', {
      id: 'amendment-1',
      document_id: 'document-1',
      collaborator_count: 9,
      subscriber_count: 8,
      change_requests: [{ id: 'change-1' }],
      collaborators: [
        { id: 'admin', status: 'admin' },
        { id: 'member', status: 'member' },
        { id: 'invited', status: 'invited' },
        { id: 'active', status: 'active' },
      ],
    });
    mocks.results.set('amendments.userCollaboration', [{ status: 'admin' }]);
    mocks.results.set('amendments.subscribers', [
      { subscriber_user: { id: 'user-1' } },
      { subscriber_user: null },
    ]);
    mocks.results.set('amendments.byIdWithProcessData', { id: 'process-data' });
    mocks.results.set('amendments.byIdWithDocsAndCollabs', { id: 'docs-collabs' });
    mocks.results.set('amendments.byIdWithPathViz', { id: 'path-viz' });
    mocks.results.set('amendments.clonesBySource', [{ id: 'clone-1' }]);
    mocks.results.set('amendments.threads', [{ id: 'thread-1' }]);
    mocks.results.set('amendments.documentsByAmendment', [{ id: 'document-1' }]);
    mocks.results.set('amendments.changeRequestsWithVotes', [{ id: 'voted-change' }]);
    mocks.results.set('amendments.cityDesigns', [{ id: 'design-1' }, { id: 'design-2' }]);
    mocks.results.set('amendments.rolesByAmendment', [{ id: 'role-1' }]);
    mocks.results.set('amendments.supportConfirmationsByUser', [{ id: 'confirmation-1' }]);
    mocks.results.set('documents.versions', [{ id: 'version-1' }]);
    mocks.results.set('amendments.collaboratorsByUser', [{ id: 'collaborator-1' }]);
    mocks.results.set('amendments.supportConfirmations', [{ id: 'group-confirmation' }]);
    mocks.results.set('amendments.allGroups', [{ id: 'group-1', name: 'Group' }]);
    mocks.results.set('amendments.allGroupRelationships', [{ id: 'relationship-1' }]);
    mocks.results.set('amendments.allGroupMemberships', [{ id: 'membership-1' }]);
    mocks.results.set('amendments.allEvents', [{ id: 'event-1' }]);
    mocks.results.set('amendments.userGroupMemberships', [{ id: 'user-membership-1' }]);
    mocks.results.set('amendments.allUsers', [{ id: 'user-1' }]);
    mocks.results.set('amendments.eventsByGroup', [{ id: 'group-event-1' }]);

    const current = renderHook(() =>
      useAmendmentState({
        amendmentId: 'amendment-1',
        userId: 'user-1',
        includeFullRelations: true,
        includeProcessData: true,
        includeDocsAndCollabs: true,
        includePathViz: true,
        includeClones: true,
        includeThreads: true,
        includeDocuments: true,
        includeChangeRequestsWithVotes: true,
        includeCityDesign: true,
        includeRoles: true,
        includeAmendmentVotes: true,
        includeSupportConfirmations: true,
        includeDocumentVersions: true,
        includeCollaboratorsByUser: true,
        includeSupportConfirmationsByGroup: true,
        includeNetworkData: true,
        includeUserMemberships: true,
        includeAllUsers: true,
        includeEventsByGroup: true,
        documentId: 'document-1',
        eventGroupId: 'group-1',
        groupId: 'group-1',
      })
    ).result.current;

    expect(current).toMatchObject({
      amendment: { id: 'amendment-1' },
      collaboration: { status: 'admin' },
      status: 'admin',
      isCollaborator: true,
      isAdmin: true,
      hasRequested: false,
      isInvited: false,
      collaboratorCount: 9,
      collaboratorStats: { total: 4, admins: 1, members: 1, invited: 1 },
      isSubscribed: true,
      subscriberCount: 2,
      primaryCityDesign: { id: 'design-1' },
      amendmentProcess: { id: 'process-data' },
      amendmentDocsCollabs: { id: 'docs-collabs' },
      amendmentPathViz: { id: 'path-viz' },
      allGroups: [{ id: 'group-1', name: 'Group', depth: 2 }],
      allGroupRelationships: [{ id: 'relationship-1', normalized: true }],
      isLoading: false,
    });
    expect(current.documents).toEqual([{ id: 'document-1' }]);
    expect(current.cityDesigns).toHaveLength(2);
    expect(current.amendmentVotes).toEqual([]);
    expect(mocks.buildNetworkMeta).toHaveBeenCalled();
    expect(mocks.normalizeRelationships).toHaveBeenCalled();
  });

  it('uses base relations, document fallback, relation counters, and loading statuses', () => {
    mocks.results.set('amendments.byIdWithRelations', {
      id: 'amendment-1',
      document_id: 'document-1',
      subscriber_count: 4,
      threads: [{ id: 'discussion-1' }],
      change_requests: undefined,
    });
    mocks.results.set('amendments.collaborators', [
      { status: 'active' },
      { status: 'collaborator' },
      { status: 'member' },
      { status: 'admin' },
      { status: 'requested' },
    ]);
    mocks.results.set('amendments.userCollaboration', [{ status: 'requested' }]);
    mocks.results.set('amendments.subscribers', undefined);
    mocks.results.set('amendments.documentsByAmendment', []);
    mocks.results.set('amendments.documentById', { id: 'document-1' });
    mocks.statuses.set('amendments.byIdWithRelations', 'unknown');
    mocks.statuses.set('amendments.collaborators', 'unknown');
    mocks.statuses.set('amendments.subscribers', 'unknown');

    const current = renderHook(() =>
      useAmendmentState({
        amendmentId: 'amendment-1',
        userId: 'user-1',
        includeDocuments: true,
      })
    ).result.current;

    expect(current).toMatchObject({
      status: 'requested',
      isCollaborator: false,
      isAdmin: false,
      hasRequested: true,
      isInvited: false,
      collaboratorCount: 4,
      collaboratorStats: { total: 5, admins: 1, members: 1, invited: 0 },
      changeRequests: [],
      discussions: [{ id: 'discussion-1' }],
      subscriberCount: 4,
      isSubscribed: false,
      documents: [{ id: 'document-1' }],
      isLoading: true,
    });
  });

  it.each([
    ['member', true, false, false, false],
    ['invited', false, false, false, true],
    ['unknown', false, false, false, false],
  ])('normalizes collaboration status %s', (status, collaborator, admin, requested, invited) => {
    mocks.results.set('amendments.byIdWithRelations', { id: 'amendment-1' });
    mocks.results.set('amendments.userCollaboration', [{ status }]);
    const current = renderHook(() =>
      useAmendmentState({ amendmentId: 'amendment-1', userId: 'user-1' })
    ).result.current;
    expect(current).toMatchObject({
      status,
      isCollaborator: collaborator,
      isAdmin: admin,
      hasRequested: requested,
      isInvited: invited,
    });
  });

  it('falls back from an empty full relation and from absent optional arrays', () => {
    mocks.results.set('amendments.byIdWithRelations', undefined);
    mocks.results.set('amendments.byIdWiki', { id: 'full', collaborators: undefined });
    const current = renderHook(() =>
      useAmendmentState({ amendmentId: 'amendment-1', includeFullRelations: true })
    ).result.current;
    expect(current.amendment).toEqual({ id: 'full', collaborators: undefined });
    expect(current.collaborators).toEqual([]);
  });

  it('covers absent network metadata and subscriber counter fallbacks', () => {
    mocks.buildNetworkMeta.mockReturnValueOnce(new Map());
    mocks.results.set('amendments.byIdWithRelations', { id: 'amendment-1' });
    mocks.results.set('amendments.allGroups', [{ id: 'unmapped' }]);
    mocks.statuses.set('amendments.subscribers', 'unknown');
    const current = renderHook(() =>
      useAmendmentState({ amendmentId: 'amendment-1', includeNetworkData: true })
    ).result.current;
    expect(current.allGroups).toEqual([{ id: 'unmapped' }]);
    expect(current.subscriberCount).toBe(0);
  });
});

describe('amendment forwarding and navigation hooks', () => {
  it('sorts forwarding steps by branch and order and finds the next branch step', () => {
    mocks.results.set('amendments.agendaItemForwardingContext', [
      {
        id: 'current',
        branch_id: 'branch-b',
        order_index: 1,
        process_run: {
          id: 'run-1',
          step_runs: [
            { id: 'b2', branch_id: 'branch-b', order_index: 2 },
            { id: 'a2', branch_id: 'branch-a', order_index: 2 },
            { id: 'a1', branch_id: 'branch-a', order_index: 1 },
          ],
        },
        branch: {
          step_runs: [
            { id: 'next', order_index: 2 },
            { id: 'previous', order_index: 0 },
            { id: 'current-copy', order_index: 1 },
          ],
        },
      },
    ]);

    const current = renderHook(() => useAgendaItemForwardingContext('agenda-1')).result.current;
    expect(current.processRunStepRuns.map(step => step.id)).toEqual(['a1', 'a2', 'b2']);
    expect(current.branchStepRuns.map(step => step.id)).toEqual([
      'previous',
      'current-copy',
      'next',
    ]);
    expect(current.nextStepRun).toEqual({ id: 'next', order_index: 2 });
    expect(current.processRun).toEqual(expect.objectContaining({ id: 'run-1' }));
    expect(current.isLoading).toBe(false);
  });

  it('returns empty forwarding defaults and exposes a loading query', () => {
    expect(renderHook(() => useAgendaItemForwardingContext()).result.current).toMatchObject({
      agendaStepRuns: [],
      currentStepRun: null,
      nextStepRun: null,
      branchStepRuns: [],
      processRunStepRuns: [],
      processRun: null,
      isLoading: false,
    });
    mocks.results.set('amendments.agendaItemForwardingContext', [{}]);
    mocks.statuses.set('amendments.agendaItemForwardingContext', 'unknown');
    const current = renderHook(() => useAgendaItemForwardingContext('agenda-1')).result.current;
    expect(current.nextStepRun).toBeNull();
    expect(current.isLoading).toBe(true);
  });

  it('normalizes missing branch ids and a missing current order while sorting', () => {
    mocks.results.set('amendments.agendaItemForwardingContext', [
      {
        id: 'current',
        branch_id: null,
        order_index: undefined,
        process_run: {
          step_runs: [
            { id: 'without-branch-b', branch_id: null, order_index: 2 },
            { id: 'with-branch', branch_id: 'branch-a', order_index: 1 },
            { id: 'without-branch-a', order_index: 1 },
          ],
        },
        branch: { step_runs: [{ id: 'first', order_index: 0 }] },
      },
    ]);
    const current = renderHook(() => useAgendaItemForwardingContext('agenda-1')).result.current;
    expect(current.processRunStepRuns.map(step => step.id)).toEqual([
      'without-branch-a',
      'without-branch-b',
      'with-branch',
    ]);
    expect(current.nextStepRun).toEqual({ id: 'first', order_index: 0 });
  });

  it('loads current-user navigation only when a user exists', () => {
    expect(renderHook(() => useCurrentUserOpenNavigationAmendments()).result.current).toEqual({
      amendments: [],
      isLoading: false,
    });
    mocks.results.set('amendments.currentUserOpenNavigationAmendments', [{ id: 'amendment-1' }]);
    mocks.statuses.set('amendments.currentUserOpenNavigationAmendments', 'unknown');
    expect(
      renderHook(() => useCurrentUserOpenNavigationAmendments('user-1')).result.current
    ).toEqual({ amendments: [{ id: 'amendment-1' }], isLoading: true });
  });
});
