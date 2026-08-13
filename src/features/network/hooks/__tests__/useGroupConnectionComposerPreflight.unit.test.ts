/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { configuredMock, incompleteMock, payloadMock, preflightMock } = vi.hoisted(() => ({
  configuredMock: vi.fn(),
  incompleteMock: vi.fn(),
  payloadMock: vi.fn(),
  preflightMock: vi.fn((input: unknown, options: unknown) => ({ input, options })),
}));

vi.mock('@/features/groups/hooks/useGroupConflictPreflight', () => ({
  useGroupConflictPreflight: preflightMock,
}));

vi.mock('../../logic/groupConnectionComposer', () => ({
  hasIncompleteMembershipRule: incompleteMock,
  hasConfiguredGroupConnection: configuredMock,
  buildCanonicalGroupConnectionPayload: payloadMock,
}));

import { useGroupConnectionComposerPreflight } from '../useGroupConnectionComposerPreflight';

function value(overrides: Record<string, unknown> = {}) {
  return {
    selectedGroupId: 'other',
    relationshipType: 'child',
    rightDirections: { informationRight: 'outgoing' },
    membershipDirection: 'current_members_to_partner',
    membershipRule: { mode: 'all_members' },
    ...overrides,
  } as never;
}

describe('useGroupConnectionComposerPreflight', () => {
  beforeEach(() => {
    preflightMock.mockClear();
    incompleteMock.mockReset().mockReturnValue(false);
    configuredMock.mockReset().mockReturnValue(true);
    payloadMock.mockReset().mockReturnValue({
      id: 'connection',
      group_a_id: 'current',
      group_b_id: 'other',
      connection_type: 'hierarchy',
      parent_group_id: 'current',
      child_group_id: 'other',
      grants: [
        {
          id: 'grant',
          right_key: 'informationRight',
          holder_group_id: 'current',
          scope_group_id: 'other',
        },
      ],
      membership_rule: { id: 'rule' },
    });
  });

  it('disables preflight for missing, incomplete, and unconfigured values', () => {
    const { result, rerender } = renderHook(
      ({ composerValue }) =>
        useGroupConnectionComposerPreflight({
          currentGroupId: 'current',
          initiatorGroupId: 'initiator',
          value: composerValue,
        }),
      { initialProps: { composerValue: value({ selectedGroupId: null }) } }
    );
    expect(result.current).toEqual({ input: null, options: { enabled: false } });
    expect(incompleteMock).not.toHaveBeenCalled();

    incompleteMock.mockReturnValue(true);
    rerender({ composerValue: value() });
    expect(preflightMock).toHaveBeenLastCalledWith(null, { enabled: false });
    expect(configuredMock).not.toHaveBeenCalled();

    incompleteMock.mockReturnValue(false);
    configuredMock.mockReturnValue(false);
    rerender({ composerValue: value({ rightDirections: {} }) });
    expect(preflightMock).toHaveBeenLastCalledWith(null, { enabled: false });
    expect(payloadMock).not.toHaveBeenCalled();
  });

  it('maps a canonical payload and respects explicit enablement and existing ids', () => {
    const { result, rerender } = renderHook(props => useGroupConnectionComposerPreflight(props), {
      initialProps: {
        currentGroupId: 'current',
        initiatorGroupId: 'initiator',
        value: value(),
        existingConnectionId: null as string | null,
        existingRightIdsByKey: undefined as Record<string, string> | undefined,
        membershipRuleId: null as string | null,
        enabled: undefined as boolean | undefined,
      },
    });

    expect(payloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentGroupId: 'current',
        otherGroupId: 'other',
        connectionId: undefined,
        membershipRuleId: undefined,
        status: 'active',
      })
    );
    expect(result.current).toEqual({
      input: {
        kind: 'group_connection_upsert',
        connection_id: 'connection',
        group_a_id: 'current',
        group_b_id: 'other',
        connection_type: 'hierarchy',
        parent_group_id: 'current',
        child_group_id: 'other',
        grants: [
          {
            id: 'grant',
            right_key: 'informationRight',
            holder_group_id: 'current',
            scope_group_id: 'other',
            status: 'active',
            initiator_group_id: 'initiator',
          },
        ],
        membership_rule: { id: 'rule' },
      },
      options: { enabled: true },
    });

    rerender({
      currentGroupId: 'current',
      initiatorGroupId: 'initiator-2',
      value: value({ relationshipType: 'parent' }),
      existingConnectionId: 'existing-connection',
      existingRightIdsByKey: { informationRight: 'existing-grant' },
      membershipRuleId: 'existing-rule',
      enabled: false,
    });
    expect(payloadMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectionId: 'existing-connection',
        membershipRuleId: 'existing-rule',
        initiatorGroupId: 'initiator-2',
      })
    );
    expect(preflightMock).toHaveBeenLastCalledWith(expect.any(Object), { enabled: false });
  });
});
