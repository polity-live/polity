/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user', email: 'user@example.com' } as any,
  facade: {} as any,
  collaboration: {} as any,
  subscribeData: { subscriptionMarker: true } as any,
  cloneData: { cloneMarker: true } as any,
  supportAmendment: vi.fn(),
  updateSupportVote: vi.fn(),
  deleteSupportVote: vi.fn(),
  waitForClientApply: vi.fn(),
  toastError: vi.fn(),
  navigate: vi.fn(),
  checkEntityAccess: vi.fn(() => true),
  directoryItems: [] as any[],
  mapItems: [] as any[],
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    supportAmendment: mocks.supportAmendment,
    updateSupportVote: mocks.updateSupportVote,
    deleteSupportVote: mocks.deleteSupportVote,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.facade,
}));
vi.mock('../useSubscribeAmendment', () => ({
  useSubscribeAmendment: () => mocks.subscribeData,
}));
vi.mock('../useAmendmentCollaboration', () => ({
  useAmendmentCollaboration: () => mocks.collaboration,
}));
vi.mock('../useCloneAmendment', () => ({
  useCloneAmendment: () => mocks.cloneData,
}));
vi.mock('../../logic/supporterDirectory', () => ({
  deriveSupporterDirectoryItems: () => mocks.directoryItems,
  deriveSupporterMapItems: () => mocks.mapItems,
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: (...args: any[]) =>
    (mocks.checkEntityAccess as (...values: any[]) => unknown)(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) =>
    (mocks.waitForClientApply as (...values: any[]) => unknown)(...args),
}));

import { useAmendmentWikiPage } from '../useAmendmentWikiPage';

describe('useAmendmentWikiPage A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'user', email: 'user@example.com' };
    mocks.collaboration = {
      status: 'admin',
      isCollaborator: true,
      isAdmin: true,
    };
    mocks.directoryItems = [
      { id: 'supporter', memberCount: 4 },
      { id: 'supporter-2', memberCount: 2 },
    ];
    mocks.mapItems = [{ id: 'map-item' }];
    mocks.facade = {
      amendmentFull: {
        id: 'amendment',
        visibility: 'public',
        collaborators: [{ id: 'collaborator' }],
        support_confirmations: [{ id: 'confirmation' }],
        group_decisions: [{ id: 'decision' }],
        group: { id: 'fallback-group' },
        clone_source: { id: 'source' },
        upvotes: 9,
        downvotes: 2,
        support_votes: [],
        current_process_run: {
          status: 'implementation',
          implementation_status: 'pending',
          evaluation_mode: 'fixed_date',
          evaluation_date: '2026-08-20T00:00:00.000Z',
          evaluation_offset_months: 2,
          evaluation_offset_years: 1,
          selected_target_group: { id: 'target-group' },
          tasks: [
            { task_type: 'other' },
            {
              task_type: 'implementation_evaluation',
              due_at: '2026-08-21T00:00:00.000Z',
              agenda_item: { votes: [{ vote: 1 }] },
              event: { id: 'event' },
            },
          ],
        },
      },
      clones: [{ id: 'clone' }],
      roles: [{ id: 'role' }],
      isLoading: false,
    };
    mocks.waitForClientApply.mockResolvedValue(undefined);
    mocks.supportAmendment.mockReturnValue('support-result');
    mocks.updateSupportVote.mockReturnValue('update-result');
    mocks.deleteSupportVote.mockReturnValue('delete-result');
  });

  afterEach(() => cleanup());

  it('derives the populated wiki model and creates a vote', async () => {
    const { result } = renderHook(() => useAmendmentWikiPage('amendment'));

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.collaborators).toHaveLength(1);
    expect(result.current.clones).toHaveLength(1);
    expect(result.current.supportingGroupCount).toBe(2);
    expect(result.current.totalSupportingMembers).toBe(6);
    expect(result.current.targetGroup).toEqual({ id: 'target-group' });
    expect(result.current.evaluationTask).toBeTruthy();
    expect(result.current.evaluationAgendaItem).toBeTruthy();
    expect(result.current.evaluationEvent).toEqual({ id: 'event' });
    expect(result.current.hasImplementationEvaluation).toBe(true);
    expect(result.current.supporterMapItems).toEqual([{ id: 'map-item' }]);
    await act(async () => result.current.handleVote(1));
    expect(mocks.supportAmendment).toHaveBeenCalledWith(
      expect.objectContaining({ amendment_id: 'amendment', vote: 1 })
    );
  });

  it('derives empty fallbacks without an amendment or authenticated user', async () => {
    mocks.user = null;
    mocks.collaboration = { status: null, isCollaborator: false, isAdmin: false };
    mocks.directoryItems = [];
    mocks.mapItems = [];
    mocks.facade = { amendmentFull: null, clones: null, roles: [], isLoading: true };

    const { result } = renderHook(() => useAmendmentWikiPage('missing'));

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.collaborators).toEqual([]);
    expect(result.current.clones).toEqual([]);
    expect(result.current.currentProcessRun).toBeNull();
    expect(result.current.targetGroup).toBeUndefined();
    expect(result.current.evaluationTask).toBeNull();
    expect(result.current.evaluationAgendaItem).toBeNull();
    expect(result.current.evaluationEvent).toBeNull();
    expect(result.current.evaluationVoteOutcome).toBeNull();
    expect(result.current.evaluationDueDate).toBeNull();
    expect(result.current.hasImplementationEvaluation).toBe(false);
    expect(result.current.score).toBe(0);

    await act(async () => result.current.handleVote(-1));
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing amendment for an authenticated user', async () => {
    mocks.facade = { amendmentFull: undefined, clones: [], roles: [], isLoading: false };
    const { result } = renderHook(() => useAmendmentWikiPage('missing'));

    await act(async () => result.current.handleVote(1));
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('updates, deletes, and rolls back existing vote operations', async () => {
    const vote = { id: 'vote', vote: 1, user_id: 'user' };
    mocks.facade.amendmentFull = {
      ...mocks.facade.amendmentFull,
      current_process_run: {
        status: null,
        implementation_status: null,
        evaluation_mode: 'after_period',
        evaluation_date: '2026-08-30T00:00:00.000Z',
        evaluation_offset_months: null,
        evaluation_offset_years: null,
        selected_target_group: null,
        tasks: [
          {
            task_type: 'implementation_evaluation',
            due_at: null,
            agenda_item: { votes: [] },
            event: null,
          },
        ],
      },
      support_votes: [vote],
    };
    const { result } = renderHook(() => useAmendmentWikiPage('amendment'));

    expect(result.current.targetGroup).toEqual({ id: 'fallback-group' });
    expect(result.current.evaluationVoteOutcome).toBeNull();
    expect(result.current.evaluationDueDate).toBe('2026-08-30T00:00:00.000Z');
    await act(async () => result.current.handleVote(-1));
    expect(mocks.updateSupportVote).toHaveBeenCalledWith({ id: 'vote', vote: -1 });
    await act(async () => result.current.handleVote(1));
    expect(mocks.deleteSupportVote).toHaveBeenCalledWith('vote');

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('vote failed'));
    await act(async () => result.current.handleVote(-1));
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('covers a process run without tasks, dates, offsets, or target groups', () => {
    mocks.facade.amendmentFull = {
      id: 'sparse',
      group: null,
      collaborators: null,
      support_confirmations: null,
      group_decisions: null,
      support_votes: null,
      upvotes: 0,
      downvotes: 0,
      current_process_run: {
        status: null,
        implementation_status: null,
        evaluation_mode: 'fixed_date',
        evaluation_date: null,
        tasks: null,
      },
    };
    const { result } = renderHook(() => useAmendmentWikiPage('sparse'));

    expect(result.current.targetGroup).toBeNull();
    expect(result.current.evaluationTask).toBeNull();
    expect(result.current.evaluationDueDate).toBeNull();
    expect(result.current.hasImplementationEvaluation).toBe(true);
  });
});
