/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasConfiguredGroupConnection,
  hasIncompleteMembershipRule,
} from '@/features/network/logic/groupConnectionComposer';
import { GroupConnectionsInput } from '../GroupConnectionsInput';

vi.mock('@/features/network/ui/GroupConnectionComposer', () => ({
  GroupConnectionComposer: () => <div data-testid="group-connection-composer" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseRightDirections = {
  informationRight: 'current_grants_right_to_partner',
  amendmentRight: 'none',
  rightToSpeak: 'none',
  activeVotingRight: 'none',
  passiveVotingRight: 'none',
} as const;

function renderInput(roleId: string) {
  const membershipRule = {
    membershipMode: 'role_members' as const,
    roleId,
    sourceGroupIds: [],
  };
  const addDisabled =
    !hasConfiguredGroupConnection({
      rightDirections: baseRightDirections,
      membershipDirection: 'partner_members_to_current',
      membershipRule,
    }) ||
    hasIncompleteMembershipRule({
      membershipDirection: 'partner_members_to_current',
      membershipRule,
    });

  render(
    <GroupConnectionsInput
      label="Verbindungen"
      hint="Hinweis"
      linkedGroupsLabel="Verlinkte Gruppen"
      addLabel="Gruppenzugehörigkeit hinzufügen"
      cancelLabel="Abbrechen"
      checkingLabel="Prüfe Konflikte"
      currentGroupId="current"
      currentGroupName="Aktuelle Gruppe"
      activeTab="preset"
      value={{
        selectedGroupId: 'partner',
        relationshipType: 'sibling',
        membershipDirection: 'partner_members_to_current',
        membershipRule,
        rightDirections: baseRightDirections,
        preset: 'elected',
      }}
      availableGroups={[]}
      selectableRolesByDirection={{}}
      existingRightStatuses={new Map()}
      preflight={{ blocking: false, isLoading: false, response: { blocking: false } }}
      groupSelectorLabel="Gruppe auswählen"
      linkedGroups={[]}
      addDisabled={addDisabled}
      onActiveTabChange={vi.fn()}
      onValueChange={vi.fn()}
      onAdd={vi.fn()}
      onCancel={vi.fn()}
      onRemove={vi.fn()}
      getSelectedRights={() => []}
      t={(key: string) => key}
    />
  );
}

describe('GroupConnectionsInput', () => {
  it('disables adding a role-members link until a role is selected', () => {
    renderInput('');

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /gruppenzugehörigkeit hinzufügen/i,
      }).disabled
    ).toBe(true);
  });

  it('enables adding a role-members link after a role is selected', () => {
    renderInput('role-1');

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: /gruppenzugehörigkeit hinzufügen/i,
      }).disabled
    ).toBe(false);
  });
});
