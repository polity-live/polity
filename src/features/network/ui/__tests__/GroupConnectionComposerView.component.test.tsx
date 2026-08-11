/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROUP_CONNECTION_PRESET_OPTIONS } from '../../logic/groupConnectionComposer';
import { GroupConnectionComposerView } from '../GroupConnectionComposerView';
import { APP_TUTORIAL_ACTION_EVENT } from '@/features/app-tutorial/events';

const TEST_NETWORK_TRANSLATIONS: Record<string, string> = {
  'common.network.relationship': 'Relationship',
  'common.network.presetChildLabel': 'This group is child',
  'common.network.presetParentLabel': 'This group is parent',
  'common.network.presetSendsRoleMembersLabel': 'This group sends role members',
  'common.network.presetReceivesRoleMembersLabel': 'This group receives role members',
  'common.network.roleInSelectedGroup': 'Role in selected group',
  'common.network.roleInThisGroup': 'Role in this group',
};

function testTranslate(
  key: string,
  paramsOrFallback?: string | Record<string, unknown>,
  fallback?: string
) {
  return (
    TEST_NETWORK_TRANSLATIONS[key] ??
    (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ??
    key
  );
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string | Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'features.network.membershipModes.all_members': 'All active members',
      'features.network.membershipModes.role_members': 'Members with selected role',
      'features.network.membershipModes.selected_source_groups': 'Parliament membership',
      'features.network.membershipModes.none': 'No automatic membership',
    };
    return labels[_key] ?? (typeof fallback === 'string' ? fallback : _key);
  },
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.network.selectedPartnerGroup': 'Selected partner group',
        'common.network.thisGroup': 'This group',
        'common.network.thisGroupEmbedded': 'this group',
        'common.network.membershipLabel': 'Membership',
        'common.network.relationship': 'Relationship',
        'common.network.isChildGroupOf': 'is the child group of',
        'common.network.isParentGroupOf': 'is the parent group of',
        'common.network.sendsRoleMembersTo': 'sends members with the selected role to',
        'common.network.receivesRoleMembersFrom': 'receives members with the selected role from',
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
    items = [],
    onChange,
    placeholder,
    value,
  }: {
    ariaRequired?: boolean;
    items?: {
      id: string;
      label: string;
      description?: string;
      secondaryLabel?: string;
      keywords?: string[];
    }[];
    onChange?: (item: {
      id: string;
      label: string;
      description?: string;
      secondaryLabel?: string;
      keywords?: string[];
    }) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <div data-testid="typeahead" aria-required={ariaRequired || undefined}>
      {placeholder}:{value}
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          data-testid={`typeahead-item-${item.id}`}
          data-description={item.description ?? item.secondaryLabel}
          data-keywords={item.keywords?.join('|')}
          onClick={() => onChange?.(item)}
        >
          {item.label}
        </button>
      ))}
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
      language="en"
      t={testTranslate}
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
  it('dispatches composer modes, presets, membership directions, and modes as stable intents', () => {
    const onActiveTabChange = vi.fn();
    const onValueChange = vi.fn();
    renderComposerView({ onActiveTabChange, onValueChange });

    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.connection-composer.mode.advanced"]')!,
      { button: 0, ctrlKey: false }
    );
    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.connection-composer.mode.preset"]')!,
      { button: 0, ctrlKey: false }
    );
    fireEvent.click(document.querySelector('#preset-child')!);
    expect(onActiveTabChange.mock.calls).toEqual([['advanced']]);
    expect(onValueChange).toHaveBeenCalled();

    cleanup();
    const setActiveMembershipDirection = vi.fn();
    const updateMembershipRule = vi.fn();
    renderComposerView({
      activeTab: 'advanced',
      setActiveMembershipDirection,
      updateMembershipRule,
    });
    fireEvent.click(document.querySelector('#membership-direction-current_members_to_partner')!);
    fireEvent.click(
      document.querySelector('#advanced-membership-mode-partner_members_to_current-role_members')!
    );
    expect(setActiveMembershipDirection).toHaveBeenCalled();
    expect(updateMembershipRule).toHaveBeenCalled();
  });

  it('exposes only the group selector as the opened-dialog spotlight target', () => {
    const { container } = renderComposerView();

    const selector = container.querySelector('[data-tutorial-anchor="network-group-search"]');
    expect(selector).toBeTruthy();
    expect(selector?.querySelector('[data-testid="typeahead"]')).toBeTruthy();
  });

  it('exposes selected rights and their direction using stable tutorial values', () => {
    const value = {
      ...createValue(),
      rightDirections: {
        ...createValue().rightDirections,
        informationRight: 'partner_grants_right_to_current',
        amendmentRight: 'partner_grants_right_to_current',
      },
    } as const;

    const { container } = renderComposerView({
      value,
      selectedRights: new Set(['informationRight', 'amendmentRight']),
    });

    const selector = container.querySelector('[data-tutorial-anchor="network-rights-selector"]');
    expect(JSON.parse(selector?.getAttribute('data-tutorial-input-values') ?? '[]')).toEqual([
      'informationRight amendmentRight',
      'informationRight amendmentRight current_has_right_in_partner',
    ]);
  });

  it('projects tutorial groups in English and reports the stable entity id only for fixtures', () => {
    const evidence: unknown[] = [];
    const listener = (event: Event) => {
      evidence.push((event as CustomEvent).detail);
    };
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, listener);

    try {
      renderComposerView({
        availableGroups: [
          {
            id: 'climate-council-id',
            name: 'Münchner Klimarat',
            description: 'Transparente, vernetzte Klimapolitik für München.',
            tutorial_run_id: 'tutorial-run',
          },
        ],
        language: 'en',
      });

      const tutorialItem = screen.getByTestId('typeahead-item-climate-council-id');
      expect(tutorialItem.textContent).toBe('Munich Climate Council');
      expect(tutorialItem.getAttribute('data-description')).toBe(
        'Transparent, connected climate policy for Munich.'
      );
      expect(tutorialItem.getAttribute('data-keywords')).toContain('Münchner Klimarat');
      expect(tutorialItem.getAttribute('data-keywords')).toContain('Munich Climate Council');
      expect(tutorialItem.getAttribute('data-keywords')).toContain(
        'Transparent, connected climate policy for Munich.'
      );

      fireEvent.click(tutorialItem);
      expect(evidence).toEqual([
        {
          type: 'entity-selection',
          entityId: 'climate-council-id',
        },
      ]);

      cleanup();
      renderComposerView({
        availableGroups: [
          {
            id: 'normal-group-id',
            name: 'Münchner Klimarat',
            description: 'Nutzerdaten',
          },
        ],
        language: 'en',
      });

      const normalItem = screen.getByTestId('typeahead-item-normal-group-id');
      expect(normalItem.textContent).toBe('Münchner Klimarat');
      fireEvent.click(normalItem);
      expect(evidence).toHaveLength(1);
    } finally {
      window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, listener);
    }
  });

  it('keeps both composer tabs within their content width on narrow screens', () => {
    renderComposerView();
    const tabsList = screen.getByRole('tablist');
    const tabs = screen.getAllByRole('tab');

    expect(tabsList.className).toContain('w-full');
    expect(tabsList.className).toContain('overflow-x-auto');
    expect(tabsList.className).not.toContain('grid-cols-2');
    expect(tabs).toHaveLength(2);
    tabs.forEach(tab => {
      expect(tab.className).toContain('min-w-max');
      expect(tab.className).toContain('flex-1');
      expect(tab.className).toContain('whitespace-nowrap');
    });
    expect(tabsList.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('preserves pointer and keyboard navigation between composer tabs', async () => {
    const onActiveTabChange = vi.fn();

    renderComposerView({ onActiveTabChange });
    const [presetTab, advancedTab] = screen.getAllByRole('tab');

    fireEvent.mouseDown(advancedTab, { button: 0, ctrlKey: false });
    expect(onActiveTabChange).toHaveBeenCalledWith('advanced');

    presetTab.focus();
    fireEvent.keyDown(presetTab, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(advancedTab));
  });

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
        language="en"
        t={testTranslate}
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
    expect(document.querySelector('[data-tutorial-anchor="network-child-preset"]')).toBeTruthy();
    expect(document.querySelector('[data-tutorial-anchor="network-rights-selector"]')).toBeTruthy();
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
        language="en"
        t={testTranslate}
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
