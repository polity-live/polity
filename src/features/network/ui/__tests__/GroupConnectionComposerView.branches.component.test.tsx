/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROUP_CONNECTION_PRESET_OPTIONS } from '../../logic/groupConnectionComposer';
import { GroupConnectionComposerView } from '../GroupConnectionComposerView';

const controls = vi.hoisted(() => ({
  radioGroups: [] as { value: string; onValueChange: (value: string) => void }[],
  tabs: null as null | { onValueChange: (value: string) => void },
  typeaheads: [] as {
    value?: string;
    items: { id: string }[];
    onChange?: (item: { id: string } | null) => void;
  }[],
  typeSelect: null as null | { onValueChange: (value: string) => void },
  rights: null as null | {
    onToggleRight: (right: string) => void;
    onDirectionChange: (right: string, direction: string) => void;
  },
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlRadioGroup: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    controls.radioGroups.push({ value, onValueChange });
    return <div>{children}</div>;
  },
  FormControlRadioGroupItem: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => {
    controls.tabs = { onValueChange };
    return <div>{children}</div>;
  },
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: {
    value?: string;
    items?: { id: string }[];
    onChange?: (item: { id: string } | null) => void;
  }) => {
    controls.typeaheads.push({ ...props, items: props.items ?? [] });
    return <div data-testid="typeahead" />;
  },
}));

vi.mock('../GroupRelationshipFields', () => ({
  GroupRelationshipMembershipModeDescription: () => <span>Membership description</span>,
  GroupRelationshipNameTag: ({ name }: { name: string }) => <span>{name}</span>,
  GroupRelationshipRightsSelector: (props: {
    onToggleRight: (right: string) => void;
    onDirectionChange: (right: string, direction: string) => void;
  }) => {
    controls.rights = props;
    return <div data-testid="rights-selector" />;
  },
  GroupRelationshipTypeSelect: (props: { onValueChange: (value: string) => void }) => {
    controls.typeSelect = props;
    return <div data-testid="relationship-type" />;
  },
}));

vi.mock('@/features/groups/ui/GroupConflictPanel', () => ({
  GroupConflictDialog: () => <div data-testid="conflict-dialog" />,
  GroupConflictPanel: () => <div data-testid="conflict-panel" />,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

afterEach(() => {
  cleanup();
  controls.radioGroups = [];
  controls.tabs = null;
  controls.typeaheads = [];
  controls.typeSelect = null;
  controls.rights = null;
  vi.clearAllMocks();
});

function createValue(overrides: Record<string, unknown> = {}) {
  return {
    selectedGroupId: 'partner-group',
    relationshipType: 'sibling',
    membershipDirection: 'partner_members_to_current',
    membershipRule: { membershipMode: 'role_members', roleId: 'role-1', sourceGroupIds: [] },
    rightDirections: {
      informationRight: 'partner_grants_right_to_current',
      amendmentRight: 'none',
      rightToSpeak: 'none',
      activeVotingRight: 'none',
      passiveVotingRight: 'none',
    },
    preset: 'elected',
    ...overrides,
  };
}

function renderView(overrides: Record<string, unknown> = {}) {
  const value = (overrides.value ?? createValue()) as ReturnType<typeof createValue>;
  return render(
    <GroupConnectionComposerView
      activeTab="advanced"
      onActiveTabChange={vi.fn()}
      value={value}
      onValueChange={vi.fn()}
      currentGroupId="current-group"
      currentGroupName="Current Group"
      availableGroups={[
        {
          id: 'partner-group',
          name: null,
          description: null,
          tutorial_run_id: 'tutorial-run',
        },
      ]}
      selectableRolesByDirection={{} as never}
      existingRightStatuses={new Map()}
      preflight={{ blocking: true, isLoading: false, response: { blocking: true, summary: null } }}
      disabledRelationshipOptions={{}}
      disableGroupSelection={false}
      groupSelectorLabel="Partner group"
      t={(key: string, fallback?: string) => fallback ?? key}
      language="en"
      selectedGroupName="   "
      directionOptions={[]}
      selectedRights={new Set(['informationRight'])}
      selectedPreset={GROUP_CONNECTION_PRESET_OPTIONS[2]}
      selectedPresetMembershipDirection="partner_members_to_current"
      presetMembershipRule={value.membershipRule}
      presetDisabled={() => false}
      getPresetDisabledReason={() => null}
      membershipDirection="partner_members_to_current"
      activeMembershipRule={value.membershipRule}
      selectableRoles={[{ id: 'role-1', name: null, description: null }]}
      updateMembershipRule={vi.fn()}
      setActiveMembershipDirection={vi.fn()}
      updateRightDirection={vi.fn()}
      {...overrides}
    />
  );
}

describe('GroupConnectionComposerView branch harness', () => {
  it('forwards selector callbacks including clear, disabled, and tutorial paths', () => {
    let presetIsDisabled = true;
    const onActiveTabChange = vi.fn();
    const onValueChange = vi.fn();
    const updateMembershipRule = vi.fn();
    const setActiveMembershipDirection = vi.fn();
    const updateRightDirection = vi.fn();

    renderView({
      onActiveTabChange,
      onValueChange,
      updateMembershipRule,
      setActiveMembershipDirection,
      updateRightDirection,
      selectableRolesByDirection: {
        partner_members_to_current: [{ id: 'unnamed-role', name: null, description: null }],
      },
      presetDisabled: () => presetIsDisabled,
      getPresetDisabledReason: () => 'Disabled reason',
    });

    act(() => controls.tabs!.onValueChange('preset'));
    const presetGroup = controls.radioGroups.find(group => group.value === 'elected')!;
    act(() => presetGroup.onValueChange('child'));
    expect(onValueChange).not.toHaveBeenCalled();
    presetIsDisabled = false;
    act(() => presetGroup.onValueChange('child'));

    const groupSelector = controls.typeaheads[0];
    act(() => groupSelector.onChange?.(null));
    act(() => groupSelector.onChange?.(groupSelector.items[0]));

    const presetRoleSelector = controls.typeaheads[1];
    act(() => presetRoleSelector.onChange?.(null));
    const advancedRoleSelector = controls.typeaheads.at(-1)!;
    act(() => advancedRoleSelector.onChange?.(null));

    act(() => controls.typeSelect!.onValueChange('parent'));
    const directionGroup = controls.radioGroups.find(
      group => group.value === 'partner_members_to_current'
    )!;
    act(() => directionGroup.onValueChange('current_members_to_partner'));
    const modeGroup = controls.radioGroups.find(group => group.value === 'role_members')!;
    act(() => modeGroup.onValueChange('role_members'));
    act(() => modeGroup.onValueChange('all_members'));

    act(() => controls.rights!.onToggleRight('informationRight'));
    act(() => controls.rights!.onToggleRight('amendmentRight'));
    act(() =>
      controls.rights!.onDirectionChange('amendmentRight', 'partner_grants_right_to_current')
    );
    act(() =>
      controls.rights!.onDirectionChange('amendmentRight', 'current_grants_right_to_partner')
    );

    expect(onActiveTabChange).toHaveBeenCalledWith('preset');
    expect(onValueChange).toHaveBeenCalled();
    expect(updateMembershipRule).toHaveBeenCalled();
    expect(setActiveMembershipDirection).toHaveBeenCalledWith('current_members_to_partner');
    expect(updateRightDirection).toHaveBeenCalled();
  });

  it('renders locked, empty, outgoing-right, and non-role variants', () => {
    const outgoingValue = createValue({
      relationshipType: 'child',
      membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
      rightDirections: {
        informationRight: 'current_grants_right_to_partner',
        amendmentRight: 'current_grants_right_to_partner',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
    });
    renderView({
      value: outgoingValue,
      selectedGroupName: '',
      disableGroupSelection: true,
      activeMembershipRule: outgoingValue.membershipRule,
      selectedPreset: GROUP_CONNECTION_PRESET_OPTIONS[3],
      selectedPresetMembershipDirection: 'current_members_to_partner',
      presetMembershipRule: { membershipMode: 'role_members', roleId: '', sourceGroupIds: [] },
      preflight: { blocking: false, isLoading: false, response: { blocking: false } },
    });

    cleanup();
    renderView({
      value: { ...outgoingValue, selectedGroupId: '' },
      selectedGroupName: 'Visible partner',
      disableGroupSelection: true,
      activeMembershipRule: outgoingValue.membershipRule,
      preflight: {
        blocking: true,
        isLoading: false,
        response: { blocking: true, summary: 'Explicit conflict' },
      },
    });

    cleanup();
    renderView({
      value: { ...outgoingValue, relationshipType: 'sibling' },
      activeMembershipRule: { membershipMode: undefined, roleId: '', sourceGroupIds: [] },
    });
  });
});
