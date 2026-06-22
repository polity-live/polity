/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GroupRelationshipConnector,
  GroupRelationshipDirectionSentence,
  GroupRelationshipMembershipModeDescription,
  GroupRelationshipNameTag,
  GroupRelationshipRightsSelector,
  SiblingMembershipModeDescription,
} from '../GroupRelationshipFields';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : key,
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.network.thisGroup': 'Diese Gruppe',
        'common.network.thisGroupEmbedded': 'diese Gruppe',
        'common.network.thisGroupWithName': 'Diese Gruppe ({{groupName}})',
        'common.network.thisGroupWithNameEmbedded': 'diese Gruppe ({{groupName}})',
        'common.network.siblingMembershipExplanationElectedBeforeSource': 'Eine Gruppenrolle in',
        'common.network.siblingMembershipExplanationElectedBetweenGroups':
          'erzeugt die Mitgliedschaft in',
        'common.network.siblingMembershipExplanationParliamentBeforeTarget': 'Mitgliedschaft in',
        'common.network.siblingMembershipExplanationParliamentBetweenGroups':
          'wird aus Gruppen abgeleitet, die passives Wahlrecht in',
        'common.network.directionHas': 'hat',
        'common.network.directionGrants': 'gibt',
        'common.network.directionIn': 'in',
        'common.network.directionTo': 'an',
        'common.network.directionAnd': 'und',
        'common.network.directionHaveMutually': 'haben gegenseitig',
        'common.network.asChildGroupOf': 'as child group of',
        'common.network.currentGroupGivesRightTo':
          '{{currentGroupName}} gibt {{rightLabel}} an {{selectedGroupName}}',
        'common.network.currentGroupHasRightIn':
          '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
        'common.network.groupsMutuallyShareRight':
          '{{currentGroupName}} und {{selectedGroupName}} haben gegenseitig {{rightLabel}}',
        'common.network.rightInfo': 'Information Right',
        'common.network.rightInfoDesc': 'Right to information and access',
        'common.network.rightAmendment': 'Antragsrecht',
        'common.network.rightAmendmentDesc': 'Recht, Anträge zu stellen',
        'common.network.rightSpeak': 'Rederechte',
        'common.network.rightSpeakDesc': 'Recht, in Sitzungen zu sprechen',
        'common.network.rightActiveVoting': 'Aktives Wahlrecht',
        'common.network.rightActiveVotingDesc': 'Recht, an Abstimmungen teilzunehmen',
        'common.network.rightPassiveVoting': 'Passives Wahlrecht',
        'common.network.rightPassiveVotingDesc': 'Recht, gewählt zu werden',
        'common.network.selectedRole': 'selected role',
        'common.unspecified': 'Unbekannt',
      };
      const template =
        templates[key] ??
        (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ??
        key;
      const params =
        typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : {};

      return Object.entries(params).reduce((result, [paramKey, value]) => {
        return result.replaceAll(`{{${paramKey}}}`, String(value ?? ''));
      }, template);
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SiblingMembershipModeDescription', () => {
  it('renders the elected mode with both group tags in the sentence', () => {
    render(
      <SiblingMembershipModeDescription
        siblingMembershipMode="elected"
        currentGroupName="Parlament Rosbach"
        selectedGroupName="Fraktion H1"
      />
    );

    expect(screen.getByText('Eine Gruppenrolle in')).toBeTruthy();
    expect(screen.getByText('Fraktion H1')).toBeTruthy();
    expect(screen.getByText('erzeugt die Mitgliedschaft in')).toBeTruthy();
    expect(screen.getByText('Parlament Rosbach')).toBeTruthy();
    expect(screen.getByText('automatisch.')).toBeTruthy();
  });

  it('renders the parliament mode as an indirect membership explanation', () => {
    render(
      <SiblingMembershipModeDescription
        siblingMembershipMode="parliament"
        currentGroupName="Parlament Rosbach"
        selectedGroupName="Stadtrat Rosbach"
      />
    );

    expect(screen.getByText('Mitgliedschaft in')).toBeTruthy();
    expect(screen.getByText('wird aus Gruppen abgeleitet, die passives Wahlrecht in')).toBeTruthy();
    expect(screen.getByText('Stadtrat Rosbach')).toBeTruthy();
    expect(screen.getByText('haben.')).toBeTruthy();
  });
});

describe('GroupRelationshipMembershipModeDescription', () => {
  it('renders role-members membership with the selected role tag', () => {
    const { container } = render(
      <GroupRelationshipMembershipModeDescription
        membershipMode="role_members"
        direction="partner_members_to_current"
        currentGroupName="Parlament Rosbach"
        selectedGroupName="Fraktion H66"
        currentGroupId="group-parliament"
        selectedGroupId="group-faction"
        requiredSourceRoleId="role-admin"
        requiredSourceRoleName="Admin"
      />
    );

    expect(container.textContent).toMatch(
      /Add only[\s\S]*Fraktion H66[\s\S]*members with role[\s\S]*Admin[\s\S]*to[\s\S]*Parlament Rosbach/
    );
    expect(screen.getByText('Admin').closest('[data-role-key="role-admin"]')).toBeTruthy();
  });

  it('falls back to selected role when role data is missing', () => {
    render(
      <GroupRelationshipMembershipModeDescription
        membershipMode="role_members"
        direction="current_members_to_partner"
        currentGroupName="H66"
        selectedGroupName="H66 Fraktion"
      />
    );

    expect(screen.getByText('selected role')).toBeTruthy();
  });

  it('renders source-group membership through the parliament description', () => {
    render(
      <GroupRelationshipMembershipModeDescription
        membershipMode="selected_source_groups"
        direction="partner_members_to_current"
        currentGroupName="Fraktion H66"
        selectedGroupName="Stadtrat Rosbach"
      />
    );

    expect(screen.getByText('Mitgliedschaft in')).toBeTruthy();
    expect(screen.getByText('Fraktion H66')).toBeTruthy();
    expect(screen.getByText('wird aus Gruppen abgeleitet, die passives Wahlrecht in')).toBeTruthy();
    expect(screen.getByText('Stadtrat Rosbach')).toBeTruthy();
    expect(screen.queryByText(/source-group rule from/i)).toBeNull();
  });
});

describe('GroupRelationshipNameTag', () => {
  it('renders a non-clickable badge when links are disabled for interactive containers', () => {
    const { container } = render(
      <GroupRelationshipNameTag
        name="Parlament Rosbach"
        kind="current"
        groupId="group-1"
        linkGroups={false}
      />
    );

    const badge = screen
      .getByText('Diese Gruppe (Parlament Rosbach)')
      .closest('[data-slot="badge-control"]');

    expect(screen.getByText('Diese Gruppe (Parlament Rosbach)')).toBeTruthy();
    expect(badge?.className).toContain('hover:bg-accent');
    expect(badge?.className).toContain('hover:text-accent-foreground');
    expect(badge?.className).not.toContain('hover:bg-primary');
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('GroupRelationshipConnector', () => {
  it('keeps relationship type badges readable on hover like right filters', () => {
    render(<GroupRelationshipConnector relationshipType="child" />);

    const badge = screen.getByText('as child group of');

    expect(badge.className).toContain('hover:bg-accent');
    expect(badge.className).toContain('hover:text-accent-foreground');
    expect(badge.className).not.toContain('hover:bg-primary');
  });
});

describe('GroupRelationshipDirectionSentence', () => {
  it('renders right sentences with token chips instead of legacy gradient text', () => {
    const { container } = render(
      <GroupRelationshipDirectionSentence
        direction="current_grants_right_to_partner"
        right="amendmentRight"
        currentGroupName="B1"
        selectedGroupName="H1"
        linkGroups={false}
      />
    );

    const rightChip = screen.getByText('Antragsrecht');

    expect(container.textContent).toContain('Diese GruppegibtAntragsrechtanH1');
    expect(rightChip).toBeTruthy();
    expect(rightChip.className).toContain('hover:bg-accent');
    expect(rightChip.className).toContain('hover:text-accent-foreground');
    expect(rightChip.className).not.toContain('hover:bg-primary');
    expect(container.innerHTML).toContain('var(--entity-group-bg)');
    expect(container.innerHTML).toContain('var(--entity-amendment-bg)');
    expect(container.innerHTML).not.toContain('bg-gradient');
    expect(container.innerHTML).not.toContain('text-transparent');
    expect(container.innerHTML).not.toContain('text-white');
  });

  it('renders partner-held rights as rights this group has in the partner group', () => {
    const { container } = render(
      <GroupRelationshipDirectionSentence
        direction="partner_grants_right_to_current"
        right="amendmentRight"
        currentGroupName="B1"
        selectedGroupName="H1"
        linkGroups={false}
      />
    );

    expect(container.textContent).toContain('Diese GruppehatAntragsrechtinH1');
    expect(container.textContent).not.toContain('H1gibtAntragsrechtan');
    expect(container.textContent).not.toContain('gives');
  });
});

describe('GroupRelationshipRightsSelector', () => {
  it('keeps selected right descriptions readable on token surfaces', () => {
    const { container } = render(
      <GroupRelationshipRightsSelector
        label="Rights"
        selectedRights={new Set(['informationRight'])}
        onToggleRight={() => undefined}
      />
    );

    const description = screen.getByText('Right to information and access');

    expect(description).toBeTruthy();
    expect(description.className).toContain('text-muted-foreground');
    expect(container.innerHTML).toContain('var(--badge-info-bg)');
    expect(container.innerHTML).not.toContain('text-white');
  });
});
