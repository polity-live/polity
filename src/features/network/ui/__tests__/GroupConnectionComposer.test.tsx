/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildGroupConnectionComposerDefaults } from '../../logic/groupConnectionComposer';
import type { GroupConnectionComposerValue } from '../../types/network.types';
import { GroupConnectionComposer } from '../GroupConnectionComposer';

const viewHarness = vi.hoisted(() => ({ props: null as Record<string, any> | null }));

vi.mock('../GroupConnectionComposerView', () => ({
  GroupConnectionComposerView: (props: Record<string, unknown>) => {
    viewHarness.props = props;
    return <div data-testid="composer-view" />;
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    language: 'de',
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
  viewHarness.props = null;
  vi.clearAllMocks();
});

function valueWith(overrides: Partial<GroupConnectionComposerValue> = {}) {
  return {
    ...buildGroupConnectionComposerDefaults(),
    selectedGroupId: 'partner-group',
    ...overrides,
  };
}

function baseProps(value: GroupConnectionComposerValue, onValueChange = vi.fn()) {
  return {
    activeTab: 'preset' as const,
    onActiveTabChange: vi.fn(),
    value,
    onValueChange,
    currentGroupId: 'current-group',
    currentGroupName: 'Current Group',
    availableGroups: [
      { id: 'partner-group', name: 'Partner Group' },
      { id: 'unnamed-group', name: null },
    ],
    selectableRolesByDirection: {
      partner_members_to_current: [{ id: 'partner-role', name: 'Partner Role' }],
      current_members_to_partner: [{ id: 'current-role', name: 'Current Role' }],
    },
    preflight: { blocking: false, isLoading: false, response: { blocking: false } },
  };
}

describe('GroupConnectionComposer', () => {
  it('derives view state and forwards membership and right updates', () => {
    const onValueChange = vi.fn();
    const value = valueWith({
      rightDirections: {
        ...buildGroupConnectionComposerDefaults().rightDirections,
        informationRight: 'mutual',
      },
    });

    render(<GroupConnectionComposer {...baseProps(value, onValueChange)} />);

    const props = viewHarness.props!;
    expect(props.selectedGroupName).toBe('Partner Group');
    expect(props.selectedRights).toEqual(new Set(['informationRight']));
    expect(props.groupSelectorLabel).toBe('Partnergruppe');
    expect(props.disableGroupSelection).toBe(false);
    expect(props.existingRightStatuses).toEqual(new Map());
    expect(props.presetDisabled('parent')).toBe(false);
    expect(props.getPresetDisabledReason('parent')).toBeUndefined();

    props.updateMembershipRule('partner_members_to_current', {
      membershipMode: 'role_members',
      roleId: 'partner-role',
    });
    props.setActiveMembershipDirection('partner_members_to_current');
    props.updateRightDirection('amendmentRight', 'current_grants_right_to_partner');

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipDirection: 'partner_members_to_current',
        membershipRule: expect.objectContaining({ roleId: 'partner-role' }),
      })
    );
    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rightDirections: expect.objectContaining({
          amendmentRight: 'current_grants_right_to_partner',
        }),
      })
    );
  });

  it('replaces disabled presets through explicit, discovered, and terminal fallbacks', async () => {
    const value = valueWith();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <GroupConnectionComposer
        {...baseProps(value, onValueChange)}
        disabledPresets={{ parent: 'Unavailable' }}
        disabledPresetFallback="child"
      />
    );

    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(viewHarness.props!.presetDisabled('parent')).toBe(true);
    expect(viewHarness.props!.getPresetDisabledReason('parent')).toBe('Unavailable');

    onValueChange.mockClear();
    rerender(
      <GroupConnectionComposer
        {...baseProps(value, onValueChange)}
        disabledRelationshipOptions={{ child: true }}
        disabledPresetFallback="parent"
      />
    );
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(viewHarness.props!.presetDisabled('parent')).toBe(true);

    onValueChange.mockClear();
    rerender(
      <GroupConnectionComposer
        {...baseProps(value, onValueChange)}
        disabledRelationshipOptions={{ child: true, parent: true, sibling: true }}
      />
    );
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ preset: 'parent' })
    );
  });

  it('blocks the disabled outgoing role mode and resets an already selected role rule', async () => {
    const onValueChange = vi.fn();
    const value = valueWith({
      preset: 'role_members_to_partner',
      relationshipType: 'sibling',
      membershipDirection: 'current_members_to_partner',
      membershipRule: {
        membershipMode: 'role_members',
        roleId: 'current-role',
        sourceGroupIds: ['source-group'],
      },
    });

    render(
      <GroupConnectionComposer
        {...baseProps(value, onValueChange)}
        disabledPresets={{ role_members_to_partner: 'Role mode unavailable' }}
        disabledPresetFallback="elected"
      />
    );

    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({
          membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
        })
      )
    );
    const callsBeforeBlockedUpdate = onValueChange.mock.calls.length;
    viewHarness.props!.updateMembershipRule('current_members_to_partner', {
      membershipMode: 'role_members',
    });
    expect(onValueChange).toHaveBeenCalledTimes(callsBeforeBlockedUpdate);

    viewHarness.props!.setActiveMembershipDirection('current_members_to_partner');
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      })
    );
  });

  it('handles missing selections, inactive membership, and a sparse role map', () => {
    const value = valueWith({
      selectedGroupId: 'missing-group',
      membershipDirection: null,
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
    });

    render(
      <GroupConnectionComposer {...baseProps(value)} selectableRolesByDirection={{} as never} />
    );

    expect(viewHarness.props!.selectedGroupName).toBe('');
    expect(viewHarness.props!.membershipDirection).toBe('current_members_to_partner');
    expect(viewHarness.props!.selectableRoles).toEqual([]);
  });
});
