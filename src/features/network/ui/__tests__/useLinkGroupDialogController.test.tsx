/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLinkGroupDialogController } from '../useLinkGroupDialogController';

const state = vi.hoisted(() => ({
  actionReject: false,
  approve: vi.fn(() => ({ kind: 'approval-result' })),
  composerValue: null as any,
  currentGroup: null as any,
  currentRoles: [] as any[],
  groupLoading: false,
  pairConnections: [] as any[],
  pairConnectionsLoading: false,
  pairRequestRelationships: [] as any[],
  pairRequests: [] as any[],
  pairRequestsLoading: false,
  pairRelationships: [] as any[],
  payload: null as any,
  pendingApproval: null as any,
  preflight: { blocking: false, isLoading: false, response: { blocking: false } } as any,
  primaryConnection: null as any,
  progress: vi.fn(),
  propose: vi.fn(() => ({ kind: 'proposal-result' })),
  resetComposer: vi.fn(),
  resetSubmission: vi.fn(),
  retrySubmission: vi.fn(),
  savePending: vi.fn(),
  searchResults: [] as any[],
  selectedRoles: [] as any[],
  setActiveTab: vi.fn(),
  setValue: vi.fn(),
  trackCalls: [] as { result: any; options: { onError: (error: unknown) => void } }[],
  waitReject: false,
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({
    group: state.currentGroup,
    searchResults: state.searchResults,
    isLoading: state.groupLoading,
  }),
  useGroupRoleOptions: (groupId?: string) => ({
    roles: groupId === 'current-group' ? state.currentRoles : state.selectedRoles,
  }),
}));

vi.mock('@/zero/network', () => ({
  useGroupConnectionActions: () => ({
    approveGroupConnectionRequest: state.approve,
    proposeGroupConnectionChange: state.propose,
  }),
  useGroupConnectionState: () => ({
    pairConnections: state.pairConnections,
    pairConnectionsLoading: state.pairConnectionsLoading,
    pairConnectionRequests: state.pairRequests,
    pairConnectionRequestsLoading: state.pairRequestsLoading,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  isRetryableServerMutationError: (error: { retryable?: boolean }) => Boolean(error?.retryable),
  trackServerFinalization: (result: any, options: any) => {
    state.trackCalls.push({ result, options });
  },
  waitForClientApply: async () => {
    if (state.waitReject) throw new Error('client apply failed');
  },
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast }));

vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    error: null,
    isActive: false,
    progressSteps: [],
    reset: state.resetSubmission,
    retry: state.retrySubmission,
    runActionWithSubmission: async (
      action: (context: { reportProgress: (step: unknown) => void }) => unknown,
      options: { onSuccess?: () => void }
    ) => {
      await action({ reportProgress: state.progress });
      if (state.actionReject) throw new Error('submission rejected');
      options.onSuccess?.();
    },
    status: 'idle',
  }),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  APP_TUTORIAL_ACCEPT_NETWORK_EVENT: 'tutorial-accept-network',
  consumePendingAppTutorialNetworkApproval: () => {
    const approval = state.pendingApproval;
    state.pendingApproval = null;
    return approval;
  },
  savePendingAppTutorialNetworkApproval: (approval: unknown) => state.savePending(approval),
}));

vi.mock('../../hooks/useGroupConnectionComposer', () => ({
  useGroupConnectionComposer: () => ({
    value: state.composerValue,
    setValue: state.setValue,
    activeTab: 'preset',
    setActiveTab: state.setActiveTab,
    resetComposer: state.resetComposer,
  }),
}));

vi.mock('../../hooks/useGroupConnectionComposerPreflight', () => ({
  useGroupConnectionComposerPreflight: () => state.preflight,
}));

vi.mock('../../logic/groupConnectionComposer', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildCanonicalGroupConnectionPayload: () => state.payload,
  };
});

vi.mock('../../logic/groupConnectionDerived', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildRightDirectionsForConnection: () => state.composerValue.rightDirections,
    deriveNormalizedGroupConnectionRequestRows: () => state.pairRequestRelationships,
    deriveNormalizedGroupRelationships: () => state.pairRelationships,
    getPrimaryConnectionForPair: () => state.primaryConnection,
  };
});

vi.mock('../../logic/networkRelationshipHelpers', () => ({
  buildExistingRightStatusesForDirection: () => new Map([['informationRight', 'active']]),
}));

vi.mock('../../logic/groupRelationshipOrientation', () => ({
  matchesRelationshipSelection: () => true,
}));

vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (error: unknown) => `localized:${String(error)}`,
}));

function directions(overrides: Record<string, string> = {}) {
  return {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
    ...overrides,
  };
}

function value(overrides: Record<string, unknown> = {}) {
  return {
    selectedGroupId: 'partner-group',
    relationshipType: 'child',
    membershipDirection: 'partner_members_to_current',
    membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
    rightDirections: directions({ informationRight: 'current_grants_right_to_partner' }),
    preset: 'parent',
    ...overrides,
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connection-1',
    group_a_id: 'current-group',
    group_b_id: 'partner-group',
    connection_type: 'hierarchy',
    parent_group_id: 'partner-group',
    child_group_id: 'current-group',
    grants: [],
    membership_rule: null,
    ...overrides,
  };
}

function request(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    group_a_id: 'current-group',
    group_b_id: 'partner-group',
    desired_connection_type: 'hierarchy',
    desired_parent_group_id: 'partner-group',
    desired_child_group_id: 'current-group',
    proposed_connection_id: 'proposed-connection',
    updated_at: 1,
    grant_requests: [],
    membership_rule_requests: [],
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payload-connection',
    group_a_id: 'current-group',
    group_b_id: 'partner-group',
    connection_type: 'hierarchy',
    parent_group_id: 'partner-group',
    child_group_id: 'current-group',
    grants: [
      {
        right_key: 'informationRight',
        holder_group_id: 'partner-group',
        scope_group_id: 'current-group',
      },
      {
        right_key: 'amendmentRight',
        holder_group_id: 'current-group',
        scope_group_id: 'partner-group',
      },
    ],
    membership_rule: {
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      membership_mode: 'all_members',
      required_source_role_id: null,
      eligible_origin_group_ids: [],
    },
    ...overrides,
  };
}

function hookProps(overrides: Record<string, unknown> = {}) {
  return {
    currentGroupId: 'current-group',
    currentGroupName: 'Current Group',
    initialTargetGroupId: 'partner-group',
    initialRelationshipType: 'child' as const,
    initialRights: ['informationRight', 'not-a-right'],
    allRelationships: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  state.composerValue = value();
  state.currentGroup = { id: 'current-group', tutorial_run_id: null };
  state.currentRoles = [
    { id: 'current-role', scope: 'group', assignee_kind: 'member' },
    { id: 'current-guest', scope: 'group', assignee_kind: 'guest' },
    { id: 'current-event', scope: 'event', assignee_kind: 'member' },
  ];
  state.selectedRoles = [
    { id: 'selected-role', scope: 'group', assignee_kind: 'member' },
    { id: 'selected-guest', scope: 'group', assignee_kind: 'guest' },
  ];
  state.searchResults = [
    { id: 'current-group', name: 'Current Group' },
    { id: 'partner-group', name: 'Partner Group' },
  ];
  state.pairConnections = [];
  state.pairRequests = [];
  state.pairRelationships = [];
  state.pairRequestRelationships = [];
  state.primaryConnection = null;
  state.payload = payload();
  state.preflight = { blocking: false, isLoading: false, response: { blocking: false } };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  state.actionReject = false;
  state.pendingApproval = null;
  state.trackCalls = [];
  state.waitReject = false;
  vi.clearAllMocks();
});

describe('useLinkGroupDialogController', () => {
  it('initializes, filters pair state, hydrates the newest matching request, and resets on close', () => {
    const active = connection({
      grants: [
        {
          id: 'active-information',
          right_key: 'informationRight',
          holder_group_id: 'partner-group',
          scope_group_id: 'current-group',
        },
      ],
      membership_rule: { id: 'active-membership' },
    });
    state.primaryConnection = active;
    state.pairConnections = [
      active,
      connection({ id: 'reverse', group_a_id: 'partner-group', group_b_id: 'current-group' }),
      connection({ id: 'irrelevant', group_a_id: 'other-a', group_b_id: 'other-b' }),
    ];
    state.pairRelationships = [
      { group_id: 'current-group', related_group_id: 'partner-group' },
      { group_id: 'other-a', related_group_id: 'other-b' },
    ];
    state.pairRequestRelationships = [
      { group_id: 'partner-group', related_group_id: 'current-group' },
    ];
    state.pairRequests = [
      request('non-pair', { group_a_id: 'other-a', group_b_id: 'other-b' }),
      request('reverse-pair', {
        group_a_id: 'partner-group',
        group_b_id: 'current-group',
        desired_parent_group_id: 'current-group',
        desired_child_group_id: 'partner-group',
      }),
      request('peer-mismatch', { desired_connection_type: 'peer' }),
      request('parent-mismatch', {
        desired_parent_group_id: 'current-group',
        desired_child_group_id: 'partner-group',
      }),
      request('neither-endpoint', {
        desired_parent_group_id: 'other-a',
        desired_child_group_id: 'other-b',
      }),
      request('older-match', { updated_at: null, created_at: 1 }),
      request('another-undated-match', { updated_at: null, created_at: 2 }),
      request('newer-match', {
        updated_at: 5,
        grant_requests: [
          {
            id: 'remove-grant',
            right_key: 'informationRight',
            holder_group_id: 'partner-group',
            scope_group_id: 'current-group',
            operation: 'remove',
          },
          {
            id: 'upsert-grant',
            right_key: 'amendmentRight',
            holder_group_id: 'current-group',
            scope_group_id: 'partner-group',
            operation: 'upsert',
          },
        ],
        membership_rule_requests: [
          { id: 'older-membership', operation: 'upsert', updated_at: null, created_at: 1 },
          { id: 'zero-membership-a', operation: 'upsert', updated_at: null, created_at: null },
          { id: 'zero-membership-b', operation: 'upsert', updated_at: null, created_at: null },
          { id: 'newer-membership', operation: 'remove', updated_at: 4, created_at: 2 },
        ],
      }),
    ];

    const { result, rerender } = renderHook(props => useLinkGroupDialogController(props), {
      initialProps: hookProps(),
    });
    expect(result.current.availableGroups.map((group: any) => group.id)).toEqual(['partner-group']);
    expect(result.current.currentPrimaryConnection?.id).toBe('connection-1');

    act(() => result.current.setOpen(true));
    expect(state.resetComposer).toHaveBeenCalled();
    expect(state.setActiveTab).toHaveBeenCalledWith('preset');
    expect(result.current.relevantConnections).toHaveLength(2);
    expect(result.current.currentPrimaryRequest?.id).toBe('newer-match');
    expect(result.current.existingRightIdsByKey.informationRight).toBe('remove-grant');
    expect(result.current.existingRightIdsByKey.amendmentRight).toBe('upsert-grant');
    expect(result.current.existingGrantIdsByKeyAndHolder['informationRight:partner-group']).toBe(
      'active-information'
    );
    expect(result.current.selectableRolesByDirection.partner_members_to_current).toHaveLength(1);
    expect(state.setValue).toHaveBeenCalled();

    state.composerValue = { ...state.composerValue };
    rerender(hookProps());
    expect(result.current.lastHydratedStateRef.current).not.toBeNull();

    state.composerValue = value({ selectedGroupId: '' });
    rerender(hookProps());
    expect(result.current.currentPrimaryConnection).toBeNull();
    expect(result.current.currentPrimaryRequest).toBeNull();
    expect(result.current.currentSelectionRelationships).toEqual([]);
    expect(result.current.existingRightStatuses.size).toBe(0);

    act(() => result.current.setOpen(false));
    expect(result.current.initializedForOpenRef.current).toBe(false);
    expect(result.current.lastHydratedStateRef.current).toBeNull();
  });

  it('covers peer request selection and no-source hydration guards', () => {
    state.primaryConnection = null;
    state.pairRequests = [
      request('peer-external', {
        group_a_id: 'other-a',
        group_b_id: 'other-b',
        desired_connection_type: 'peer',
      }),
      request('peer-current', { desired_connection_type: 'peer', updated_at: 2 }),
    ];
    state.composerValue = value({ relationshipType: 'sibling' });
    const { result, rerender } = renderHook(() =>
      useLinkGroupDialogController(hookProps({ initialRelationshipType: undefined }))
    );
    act(() => result.current.setOpen(true));
    expect(result.current.currentPrimaryRequest?.id).toBe('peer-current');

    state.pairRequests = [];
    state.composerValue = value({
      relationshipType: 'parent',
      rightDirections: directions({ amendmentRight: 'current_grants_right_to_partner' }),
    });
    rerender();
    state.composerValue = value({ relationshipType: 'parent', rightDirections: directions() });
    rerender();
    expect(result.current.currentPrimaryRequest).toBeNull();
  });

  it('hydrates peer/parent/child active connections and submits without stored ids', async () => {
    state.searchResults = undefined as never;
    state.primaryConnection = connection({
      id: 'peer-connection',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      grants: undefined,
    });
    state.pairConnections = [state.primaryConnection];
    state.composerValue = value({ relationshipType: 'sibling' });
    const { result, rerender } = renderHook(() =>
      useLinkGroupDialogController(
        hookProps({
          initialTargetGroupId: undefined,
          initialRelationshipType: undefined,
          initialRights: undefined,
        })
      )
    );
    expect(result.current.availableGroups).toEqual([]);
    act(() => result.current.setOpen(true));
    expect(state.setValue).toHaveBeenCalled();

    state.primaryConnection = connection({
      id: 'parent-connection',
      parent_group_id: 'current-group',
      child_group_id: 'partner-group',
    });
    state.pairConnections = [state.primaryConnection];
    state.composerValue = value({ relationshipType: 'parent' });
    rerender();

    state.primaryConnection = connection({ id: 'child-connection' });
    state.pairConnections = [state.primaryConnection];
    state.composerValue = value({ relationshipType: 'child' });
    rerender();

    state.primaryConnection = null;
    state.pairConnections = [];
    state.pairRequests = [request('nonmatching-only', { group_a_id: 'x', group_b_id: 'y' })];
    state.composerValue = value();
    state.payload = payload();
    rerender();
    act(() => result.current.handleSubmit());
    await waitFor(() => expect(state.propose).toHaveBeenCalled());

    state.propose.mockClear();
    state.pairRequests = [
      request('request-without-collections', {
        proposed_connection_id: 'request-proposed-id',
        grant_requests: [],
        membership_rule_requests: [],
      }),
    ];
    state.composerValue = value();
    rerender();
    act(() => result.current.handleSubmit());
    await waitFor(() =>
      expect(state.propose).toHaveBeenCalledWith(
        expect.objectContaining({ proposed_connection_id: 'payload-connection' }),
        { silent: true }
      )
    );
  });

  it('accepts pending tutorial approvals with bounded retries and terminal errors', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useLinkGroupDialogController(hookProps()));

    act(() => window.dispatchEvent(new Event('tutorial-accept-network')));
    expect(state.approve).not.toHaveBeenCalled();

    state.pendingApproval = {
      requestId: 'tutorial-request',
      grantRequestIds: ['grant-request'],
      approveMembership: true,
    };
    act(() => window.dispatchEvent(new Event('tutorial-accept-network')));
    expect(state.approve).toHaveBeenCalledWith(
      {
        id: 'tutorial-request',
        grant_request_ids: ['grant-request'],
        approve_membership: true,
      },
      { silent: true }
    );

    act(() => state.trackCalls[0].options.onError({ retryable: true }));
    act(() => vi.runOnlyPendingTimers());
    act(() => state.trackCalls[1].options.onError({ retryable: true }));
    act(() => vi.runOnlyPendingTimers());
    act(() => state.trackCalls[2].options.onError({ retryable: true }));
    expect(toast.error).toHaveBeenCalled();

    state.pendingApproval = {
      requestId: 'terminal-request',
      grantRequestIds: [],
      approveMembership: false,
    };
    act(() => window.dispatchEvent(new Event('tutorial-accept-network')));
    act(() => state.trackCalls.at(-1)!.options.onError({ retryable: false }));
    expect(toast.error).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('rejects incomplete role/source rules, empty configurations, and blocking preflight', () => {
    const { result, rerender } = renderHook(() => useLinkGroupDialogController(hookProps()));

    const cases = [
      value({ selectedGroupId: '' }),
      value({
        membershipDirection: 'partner_members_to_current',
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
        rightDirections: directions(),
      }),
      value({
        membershipDirection: 'current_members_to_partner',
        membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
        rightDirections: directions(),
      }),
      value({
        membershipDirection: 'partner_members_to_current',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
        rightDirections: directions(),
      }),
      value({
        membershipDirection: 'current_members_to_partner',
        membershipRule: {
          membershipMode: 'selected_source_groups',
          roleId: '',
          sourceGroupIds: [],
        },
        rightDirections: directions(),
      }),
      value({
        membershipDirection: null,
        membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
        rightDirections: directions(),
      }),
    ];
    for (const nextValue of cases) {
      state.composerValue = nextValue;
      rerender();
      act(() => result.current.handleSubmit());
    }

    state.composerValue = value();
    state.preflight = { blocking: true, isLoading: false, response: { blocking: true } };
    rerender();
    act(() => result.current.handleSubmit());

    expect(state.propose).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(5);
  });

  it('submits upserts/removals, saves tutorial approval, retries finalization, and restores', async () => {
    state.currentGroup = { id: 'current-group', tutorial_run_id: 'tutorial-run' };
    state.primaryConnection = connection({
      grants: [
        {
          id: 'existing-information',
          right_key: 'informationRight',
          holder_group_id: 'partner-group',
          scope_group_id: 'current-group',
        },
        {
          id: 'remove-speak',
          right_key: 'rightToSpeak',
          holder_group_id: 'current-group',
          scope_group_id: 'partner-group',
        },
        {
          id: 'remove-active',
          right_key: 'activeVotingRight',
          holder_group_id: 'current-group',
          scope_group_id: 'partner-group',
        },
        {
          id: 'remove-passive',
          right_key: 'passiveVotingRight',
          holder_group_id: 'current-group',
          scope_group_id: 'partner-group',
        },
        {
          id: 'ignore-unknown',
          right_key: 'unknownRight',
          holder_group_id: 'current-group',
          scope_group_id: 'partner-group',
        },
      ],
      membership_rule: { id: 'existing-membership', membership_mode: 'all_members' },
    });
    state.pairRequests = [request('existing-request')];
    state.payload = payload();
    const { result } = renderHook(() => useLinkGroupDialogController(hookProps()));

    act(() => result.current.handleSubmit());
    await waitFor(() => expect(state.propose).toHaveBeenCalled());
    expect(state.savePending).toHaveBeenCalled();
    expect(state.progress).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalled();

    const proposalTrack = state.trackCalls.at(-1)!;
    act(() => proposalTrack.options.onError({ retryable: true }));
    const retryTrack = state.trackCalls.at(-1)!;
    act(() => retryTrack.options.onError({ retryable: false }));
    const restoreOptions = toast.error.mock.calls.at(-1)?.[1];
    act(() => restoreOptions.action.onClick());

    expect(state.resetComposer).toHaveBeenCalledWith(state.composerValue);
    expect(state.setActiveTab).toHaveBeenCalledWith('preset');
    expect(state.resetSubmission).toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it('builds stored-membership removals and handles client-apply submission failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const membershipMode of ['all_members', 'role_members', 'selected_source_groups']) {
      state.primaryConnection = connection({
        membership_rule: {
          id: `membership-${membershipMode}`,
          membership_mode: membershipMode,
          member_source_group_id: 'partner-group',
          member_target_group_id: 'current-group',
          required_source_role_id: null,
          origins:
            membershipMode === 'all_members'
              ? [{ eligible_origin_group_id: 'origin-1' }, { eligible_origin_group_id: null }]
              : undefined,
        },
      });
      state.payload = payload({ membership_rule: null, grants: [] });
      const { result, unmount } = renderHook(() => useLinkGroupDialogController(hookProps()));
      act(() => result.current.handleSubmit());
      await waitFor(() =>
        expect(state.propose).toHaveBeenCalledWith(
          expect.objectContaining({
            membership_rule: expect.objectContaining({ operation: 'remove' }),
          }),
          { silent: true }
        )
      );
      unmount();
      state.propose.mockClear();
    }

    state.primaryConnection = connection({
      membership_rule: { id: 'invalid-membership', membership_mode: 'unsupported' },
    });
    state.waitReject = true;
    const { result } = renderHook(() => useLinkGroupDialogController(hookProps()));
    act(() => result.current.handleSubmit());
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('common.network.relationshipSaveError');
    consoleError.mockRestore();
  });
});
