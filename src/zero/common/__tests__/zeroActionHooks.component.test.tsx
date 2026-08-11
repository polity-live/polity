/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommonActions } from '../useCommonActions';
import { useUserHashtagsState } from '../useUserHashtagsState';
import { useGroupConnectionActions } from '../../network/useGroupConnectionActions';
import { useWorkflowActions } from '../../network/useWorkflowActions';
import { useWorkflowState } from '../../network/useWorkflowState';

const hooks = vi.hoisted(() => ({
  errorCallbacks: [] as ((error: unknown) => void)[],
  mutate: vi.fn((input: unknown) => ({ input })),
  queryUnknown: false,
  queryValues: new Map<string, unknown>(),
  track: vi.fn(),
  wait: vi.fn(async (_result: unknown) => undefined),
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: hooks.mutate }),
  useQuery: (query?: { kind?: string }) => [
    query?.kind ? hooks.queryValues.get(query.kind) : undefined,
    { type: hooks.queryUnknown ? 'unknown' : 'complete' },
  ],
}));

vi.mock('../../mutators', () => {
  const names = [
    'subscribe',
    'unsubscribe',
    'addHashtag',
    'deleteHashtag',
    'linkUserHashtag',
    'linkGroupHashtag',
    'linkAmendmentHashtag',
    'linkEventHashtag',
    'linkBlogHashtag',
    'linkStatementHashtag',
    'unlinkUserHashtag',
    'unlinkGroupHashtag',
    'unlinkAmendmentHashtag',
    'unlinkEventHashtag',
    'unlinkBlogHashtag',
    'unlinkStatementHashtag',
    'createLink',
    'deleteLink',
    'createReaction',
    'deleteReaction',
    'createTimelineEvent',
  ];
  const networkNames = [
    'createGroupConnection',
    'updateGroupConnection',
    'deleteGroupConnection',
    'proposeGroupConnectionChange',
    'approveGroupConnectionRequest',
    'rejectGroupConnectionRequest',
    'saveWorkflowDefinition',
    'createWorkflow',
    'updateWorkflow',
    'deleteWorkflow',
    'createWorkflowStep',
    'updateWorkflowStep',
    'deleteWorkflowStep',
    'approveWorkflowApproval',
    'rejectWorkflowApproval',
  ];
  return {
    mutators: {
      common: Object.fromEntries(names.map(name => [name, (args: unknown) => ({ name, args })])),
      network: Object.fromEntries(
        networkNames.map(name => [name, (args: unknown) => ({ name, args })])
      ),
    },
  };
});

vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (_result: unknown, callback: (error: unknown) => void) =>
    hooks.errorCallbacks.push(callback),
  waitForClientApply: (result: unknown) => hooks.wait(result),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({ gatedToast: toast }));

vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: (...args: unknown[]) => hooks.track(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../queries', () => ({
  queries: {
    common: { userHashtags: () => ({ kind: 'userHashtags' }) },
    network: {
      workflowApprovalsByGroup: ({ groupId }: { groupId: string }) => ({
        kind: groupId === 'approval-group' ? 'workflowApprovals' : 'groupWorkflowApprovals',
      }),
      workflowById: () => ({ kind: 'workflow' }),
      allWorkflows: () => ({ kind: 'allWorkflows' }),
    },
  },
}));

beforeEach(() => {
  hooks.queryValues = new Map();
});

afterEach(() => {
  cleanup();
  hooks.errorCallbacks = [];
  hooks.queryUnknown = false;
  vi.clearAllMocks();
});

describe('Zero action hooks', () => {
  it('executes all common mutation wrappers and error callbacks', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCommonActions());

    act(() => {
      result.current.subscribe({ id: 'subscription' } as never);
      result.current.unsubscribe({ id: 'subscription' } as never);
      result.current.addHashtag({ id: 'tag', tag: 'tag' } as never);
      result.current.deleteHashtag({ id: 'tag' } as never);
      result.current.createLink({ id: 'link' } as never, { silent: true } as never);
      result.current.deleteLink({ id: 'link' } as never);
      result.current.createReaction({ id: 'reaction' } as never);
      result.current.deleteReaction({ id: 'reaction' } as never);
      result.current.createTimelineEvent({ id: 'timeline' } as never);
    });

    for (const entityType of [
      'user',
      'group',
      'amendment',
      'event',
      'blog',
      'statement',
    ] as const) {
      act(() => {
        result.current.linkHashtag(entityType, {
          id: `link-${entityType}`,
          hashtag_id: 'tag',
          [`${entityType}_id`]: entityType,
        });
        result.current.unlinkHashtag(entityType, { id: `link-${entityType}` });
      });
    }
    act(() => hooks.errorCallbacks.forEach(callback => callback('server error')));

    expect(hooks.mutate).toHaveBeenCalledTimes(21);
    expect(hooks.track).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('diffs, reuses, creates, and removes hashtag junctions before reporting success', async () => {
    const { result } = renderHook(() => useCommonActions());

    await act(async () =>
      result.current.syncEntityHashtags(
        'group',
        'group-1',
        ['kept', 'reused', 'created'],
        [
          { id: 'junction-kept', hashtag_id: 'tag-kept', hashtag: { id: 'tag-kept', tag: 'kept' } },
          { id: 'junction-removed', hashtag_id: 'tag-old', hashtag: { id: 'tag-old', tag: 'old' } },
          { id: 'junction-empty', hashtag_id: 'tag-empty', hashtag: undefined },
        ],
        [
          { id: 'tag-kept', tag: 'kept' },
          { id: 'tag-reused', tag: 'reused' },
        ]
      )
    );

    expect(hooks.wait).toHaveBeenCalledTimes(4);
    expect(toast.success).toHaveBeenCalledWith('common.toasts.hashtagsSynced');
  });

  it('executes connection actions in visible and silent modes', () => {
    const { result } = renderHook(() => useGroupConnectionActions());
    act(() => {
      result.current.createGroupConnection(
        { id: 'connection' } as never,
        { silent: true } as never
      );
      result.current.updateGroupConnection({ id: 'connection' } as never);
      result.current.deleteGroupConnection({ id: 'connection' } as never);
      result.current.proposeGroupConnectionChange({ id: 'proposal-visible' } as never);
      result.current.proposeGroupConnectionChange({ id: 'proposal-silent' } as never, {
        silent: true,
      });
      result.current.approveGroupConnectionRequest({ id: 'approval-visible' } as never);
      result.current.approveGroupConnectionRequest({ id: 'approval-silent' } as never, {
        silent: true,
      });
      result.current.rejectGroupConnectionRequest({ id: 'rejection' } as never);
    });
    act(() => hooks.errorCallbacks.forEach(callback => callback('error')));

    expect(hooks.mutate).toHaveBeenCalledTimes(8);
    expect(hooks.track).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('executes every workflow action and background error callback', () => {
    const { result } = renderHook(() => useWorkflowActions());
    act(() => {
      result.current.saveWorkflowDefinition({ id: 'definition' } as never);
      result.current.createWorkflow({ id: 'workflow' } as never, { silent: true } as never);
      result.current.updateWorkflow({ id: 'workflow' } as never);
      result.current.deleteWorkflow('workflow');
      result.current.createWorkflowStep({ id: 'step' } as never, { silent: true } as never);
      result.current.updateWorkflowStep({ id: 'step' } as never);
      result.current.deleteWorkflowStep('step');
      result.current.approveWorkflowApproval('approval');
      result.current.rejectWorkflowApproval('approval');
    });
    act(() => hooks.errorCallbacks.forEach(callback => callback('error')));

    expect(hooks.mutate).toHaveBeenCalledTimes(9);
    expect(hooks.track).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('Zero query state hooks', () => {
  it('gates user hashtag queries and normalizes missing rows', () => {
    hooks.queryUnknown = true;
    const { result, rerender } = renderHook(
      ({ userId }: { userId?: string }) => useUserHashtagsState(userId),
      { initialProps: { userId: undefined } as { userId?: string } }
    );
    expect(result.current).toEqual({ userHashtags: [], isLoading: false });

    hooks.queryValues.set('userHashtags', [{ id: 'junction' }]);
    rerender({ userId: 'user-1' });
    expect(result.current.userHashtags).toHaveLength(1);
    expect(result.current.isLoading).toBe(true);
  });

  it('deduplicates and sorts group workflows while exposing loading and fallback states', async () => {
    hooks.queryValues.set('groupWorkflowApprovals', [
      { workflow: null },
      { workflow: { id: 'older', updated_at: null } },
      { workflow: { id: 'newer', updated_at: 5 } },
      { workflow: { id: 'older', updated_at: 1 } },
      { workflow: { id: 'undated', updated_at: null } },
      { workflow: { id: 'also-undated', updated_at: null } },
    ]);
    hooks.queryValues.set('workflow', { id: 'workflow' });
    hooks.queryValues.set('allWorkflows', undefined);
    hooks.queryValues.set('workflowApprovals', undefined);
    hooks.queryUnknown = true;

    const { result, rerender } = renderHook(
      (options?: { groupId?: string; workflowId?: string; approvalGroupId?: string }) =>
        useWorkflowState(options),
      {
        initialProps: {
          groupId: 'group-1',
          workflowId: 'workflow-1',
          approvalGroupId: 'approval-group',
        },
      }
    );

    expect(result.current.groupWorkflows.map(workflow => workflow.id)).toEqual([
      'newer',
      'older',
      'undated',
      'also-undated',
    ]);
    expect(result.current.allWorkflows).toEqual([]);
    expect(result.current.workflowApprovals).toEqual([]);
    expect(result.current.workflowLoading).toBe(true);

    hooks.queryUnknown = false;
    hooks.queryValues.set('allWorkflows', [{ id: 'all' }]);
    hooks.queryValues.set('workflowApprovals', [{ id: 'approval' }]);
    rerender(undefined);
    await waitFor(() => expect(result.current.allWorkflows).toHaveLength(1));
    expect(result.current.groupWorkflows).toEqual([]);
    expect(result.current.allWorkflowsLoading).toBe(false);
  });
});
