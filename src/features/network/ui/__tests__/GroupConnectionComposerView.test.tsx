/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROUP_CONNECTION_PRESET_OPTIONS } from '../../logic/groupConnectionComposer';
import { GroupConnectionComposerView } from '../GroupConnectionComposerView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : _key,
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.network.selectedPartnerGroup': 'Selected partner group',
        'common.network.thisGroup': 'This group',
        'common.network.thisGroupEmbedded': 'this group',
        'common.network.membershipLabel': 'Membership',
        'common.network.existingRightsStatusHint': 'Existing rights are shown inline.',
        'common.network.rightInfo': 'Information Right',
        'common.network.rightInfoDesc': 'Right to information and access',
        'common.network.rightAmendment': 'Amendment Right',
        'common.network.rightAmendmentDesc': 'Right to submit amendments',
        'common.network.rightSpeak': 'Right to Speak',
        'common.network.rightSpeakDesc': 'Right to speak',
        'common.network.rightActiveVoting': 'Active Voting Right',
        'common.network.rightActiveVotingDesc': 'Right to vote',
        'common.network.rightPassiveVoting': 'Passive Voting Right',
        'common.network.rightPassiveVotingDesc': 'Right to be elected',
      };
      const template =
        templates[key] ??
        (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ??
        key;
      const params =
        typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : {};

      return Object.entries(params).reduce(
        (result, [paramKey, value]) => result.replaceAll(`{{${paramKey}}}`, String(value ?? '')),
        template
      );
    },
  }),
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: ({
    ariaRequired,
    placeholder,
    value,
  }: {
    ariaRequired?: boolean;
    placeholder?: string;
    value?: string;
  }) => (
    <div data-testid="typeahead" aria-required={ariaRequired || undefined}>
      {placeholder}:{value}
    </div>
  ),
}));

vi.mock('@/features/groups/ui/GroupConflictPanel', () => ({
  GroupConflictDialog: () => null,
  GroupConflictPanel: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createValue() {
  return {
    selectedGroupId: 'h1',
    relationshipType: 'child',
    membershipDirection: 'partner_members_to_current',
    membershipRule: { membershipMode: 'all_members', roleId: '', sourceGroupIds: [] },
    rightDirections: {
      informationRight: 'none',
      amendmentRight: 'none',
      rightToSpeak: 'none',
      activeVotingRight: 'none',
      passiveVotingRight: 'none',
    },
    preset: 'parent',
  } as const;
}

function renderComposerView(
  overrides: Partial<Parameters<typeof GroupConnectionComposerView>[0]> = {}
) {
  const value = overrides.value ?? createValue();

  return render(
    <GroupConnectionComposerView
      activeTab="preset"
      onActiveTabChange={() => undefined}
      value={value}
      onValueChange={() => undefined}
      currentGroupId="current"
      currentGroupName="This group"
      availableGroups={[{ id: 'h1', name: 'H1' }]}
      selectableRolesByDirection={{
        partner_members_to_current: [{ id: 'role-1', name: 'Delegate' }],
        current_members_to_partner: [{ id: 'role-current', name: 'Admin' }],
      }}
      existingRightStatuses={new Map()}
      preflight={{ blocking: false, isLoading: false, response: { blocking: false } }}
      disabledRelationshipOptions={{}}
      disableGroupSelection={false}
      groupSelectorLabel="Partner group"
      t={(key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
        (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key
      }
      selectedGroupName="H1"
      directionOptions={[]}
      selectedRights={new Set()}
      selectedPreset={GROUP_CONNECTION_PRESET_OPTIONS[0]}
      selectedPresetMembershipDirection="partner_members_to_current"
      presetMembershipRule={value.membershipRule}
      presetDisabled={() => false}
      getPresetDisabledReason={() => null}
      membershipDirection="partner_members_to_current"
      activeMembershipRule={value.membershipRule}
      selectableRoles={[{ id: 'role-1', name: 'Delegate' }]}
      updateMembershipRule={() => undefined}
      setActiveMembershipDirection={() => undefined}
      updateRightDirection={() => undefined}
      {...overrides}
    />
  );
}

describe('GroupConnectionComposerView', () => {
  it('renders four this-group presets without parliament or source-group wording', () => {
    const value = createValue();

    render(
      <GroupConnectionComposerView
        activeTab="preset"
        onActiveTabChange={() => undefined}
        value={value}
        onValueChange={() => undefined}
        currentGroupId="current"
        currentGroupName="This group"
        availableGroups={[{ id: 'h1', name: 'H1' }]}
        selectableRolesByDirection={{
          partner_members_to_current: [{ id: 'role-1', name: 'Delegate' }],
          current_members_to_partner: [],
        }}
        existingRightStatuses={new Map()}
        preflight={{ blocking: false, isLoading: false, response: { blocking: false } }}
        disabledRelationshipOptions={{}}
        disableGroupSelection={false}
        groupSelectorLabel="Partner group"
        t={(key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
          (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key
        }
        selectedGroupName="H1"
        directionOptions={[]}
        selectedRights={new Set()}
        selectedPreset={GROUP_CONNECTION_PRESET_OPTIONS[0]}
        selectedPresetMembershipDirection="partner_members_to_current"
        presetMembershipRule={value.membershipRule}
        presetDisabled={() => false}
        getPresetDisabledReason={() => null}
        membershipDirection="partner_members_to_current"
        activeMembershipRule={value.membershipRule}
        selectableRoles={[{ id: 'role-1', name: 'Delegate' }]}
        updateMembershipRule={() => undefined}
        setActiveMembershipDirection={() => undefined}
        updateRightDirection={() => undefined}
      />
    );

    expect(screen.getByText('This group is child')).toBeTruthy();
    expect(screen.getByText('This group is parent')).toBeTruthy();
    expect(screen.getByText('This group receives role members')).toBeTruthy();
    expect(screen.getByText('This group sends role members')).toBeTruthy();
    expect(screen.getAllByText('This group', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText('is the child group of')).toBeTruthy();
    expect(screen.getByText('is the parent group of')).toBeTruthy();
    expect(screen.queryByText(['Parliament', 'group'].join(' '))).toBeNull();
    expect(screen.queryByText(['Selected', 'source', 'groups'].join(' '))).toBeNull();
    expect(
      (document.querySelector('#preset-role_members_to_partner') as HTMLInputElement).disabled
    ).toBe(false);
  });

  it('renders a disabled role-members-to-partner preset with an explanation', () => {
    const reason =
      'Create this group first before sending members by one of its roles. Roles for this group are created after the group exists.';

    renderComposerView({
      presetDisabled: (preset: string) => preset === 'role_members_to_partner',
      getPresetDisabledReason: (preset: string) =>
        preset === 'role_members_to_partner' ? reason : null,
    });

    expect(screen.getByText('This group sends role members')).toBeTruthy();
    expect(screen.getByText(reason)).toBeTruthy();
    expect(
      (document.querySelector('#preset-role_members_to_partner') as HTMLInputElement).disabled
    ).toBe(true);
    expect((document.querySelector('#preset-child') as HTMLInputElement).disabled).toBe(false);
  });

  it('uses the current-group role label as the preset role placeholder when this group sends members', () => {
    const value = {
      ...createValue(),
      membershipDirection: 'current_members_to_partner',
      membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      preset: 'role_members_to_partner',
    } as const;

    renderComposerView({
      value,
      selectedPreset: GROUP_CONNECTION_PRESET_OPTIONS[3],
      selectedPresetMembershipDirection: 'current_members_to_partner',
      presetMembershipRule: value.membershipRule,
    });

    expect(screen.getAllByText(/Role in this group/).length).toBeGreaterThan(0);
    expect(screen.getByText('Role in this group:')).toBeTruthy();
    expect(
      screen
        .getAllByTestId('typeahead')
        .some(element => element.getAttribute('aria-required') === 'true')
    ).toBe(true);
  });

  it('uses the selected-group role label as the preset role placeholder when this group receives members', () => {
    const value = {
      ...createValue(),
      membershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      preset: 'elected',
    } as const;

    renderComposerView({
      value,
      selectedPreset: GROUP_CONNECTION_PRESET_OPTIONS[2],
      selectedPresetMembershipDirection: 'partner_members_to_current',
      presetMembershipRule: value.membershipRule,
    });

    expect(screen.getAllByText(/Role in selected group/).length).toBeGreaterThan(0);
    expect(screen.getByText('Role in selected group:')).toBeTruthy();
    expect(
      screen
        .getAllByTestId('typeahead')
        .some(element => element.getAttribute('aria-required') === 'true')
    ).toBe(true);
  });

  it('blocks current-group role membership in advanced mode when the preset is disabled', () => {
    const reason =
      'Create this group first before sending members by one of its roles. Roles for this group are created after the group exists.';
    const value = {
      ...createValue(),
      relationshipType: 'sibling',
      membershipDirection: 'current_members_to_partner',
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
    } as const;

    renderComposerView({
      activeTab: 'advanced',
      value,
      membershipDirection: 'current_members_to_partner',
      activeMembershipRule: value.membershipRule,
      getPresetDisabledReason: (preset: string) =>
        preset === 'role_members_to_partner' ? reason : null,
    });

    expect(screen.getByText(reason)).toBeTruthy();
    expect(
      (
        document.querySelector(
          '#advanced-membership-mode-current_members_to_partner-role_members'
        ) as HTMLInputElement
      ).disabled
    ).toBe(true);
  });

  it('keeps the supported membership choices visible for non-selectable source-group rules', () => {
    const value = {
      ...createValue(),
      relationshipType: 'sibling',
      membershipRule: {
        membershipMode: 'selected_source_groups',
        roleId: '',
        sourceGroupIds: ['b1'],
      },
      preset: 'elected',
    } as const;

    render(
      <GroupConnectionComposerView
        activeTab="advanced"
        onActiveTabChange={() => undefined}
        value={value}
        onValueChange={() => undefined}
        currentGroupId="current"
        currentGroupName="This group"
        availableGroups={[{ id: 'h1', name: 'H1' }]}
        selectableRolesByDirection={{
          partner_members_to_current: [{ id: 'role-1', name: 'Delegate' }],
          current_members_to_partner: [],
        }}
        existingRightStatuses={new Map()}
        preflight={{ blocking: false, isLoading: false, response: { blocking: false } }}
        disabledRelationshipOptions={{}}
        disableGroupSelection={false}
        groupSelectorLabel="Partner group"
        t={(key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
          (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key
        }
        selectedGroupName="H1"
        directionOptions={[]}
        selectedRights={new Set()}
        selectedPreset={GROUP_CONNECTION_PRESET_OPTIONS[2]}
        selectedPresetMembershipDirection="partner_members_to_current"
        presetMembershipRule={value.membershipRule}
        presetDisabled={() => false}
        getPresetDisabledReason={() => null}
        membershipDirection="partner_members_to_current"
        activeMembershipRule={value.membershipRule}
        selectableRoles={[{ id: 'role-1', name: 'Delegate' }]}
        updateMembershipRule={() => undefined}
        setActiveMembershipDirection={() => undefined}
        updateRightDirection={() => undefined}
      />
    );

    expect(screen.getByText('No automatic membership')).toBeTruthy();
    expect(screen.getByText('All active members')).toBeTruthy();
    expect(screen.getByText('Members with selected role')).toBeTruthy();
    expect(screen.queryByText('Parliament membership')).toBeNull();
    expect(screen.queryByText(['Selected', 'source', 'groups'].join(' '))).toBeNull();
  });
});
