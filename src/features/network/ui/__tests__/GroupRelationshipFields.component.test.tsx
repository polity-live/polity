/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ translations: {} as Record<string, string> }));

import {
  GroupRelationshipConnector,
  GroupRelationshipDirectionSentence,
  GroupRelationshipMembershipModeDescription,
  GroupRelationshipMembershipModeSummary,
  GroupRelationshipNameTag,
  GroupRelationshipRightSentenceList,
  GroupRelationshipRightsSummary,
  GroupRelationshipRightsSelector,
  GroupRelationshipTypePreview,
  GroupRelationshipTypeSelect,
  GroupRelationshipTypeSummary,
  SiblingMembershipModeDescription,
  getCurrentGroupRelationshipLabel,
  getGroupRelationshipDirectionOptions,
  getGroupRelationshipRightLabel,
  getGroupRelationshipTypeLabel,
  invertGroupRelationshipType,
} from '../GroupRelationshipFields';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string | Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'common.network.addAllActiveMembersOf': 'Add all active members of',
      'common.network.addOnlyMembersOf': 'Add only',
      'common.network.membersWithRole': 'members with role',
      'common.network.directionTo': 'to',
    };
    return labels[key] ?? (typeof fallback === 'string' ? fallback : key);
  },
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
        'common.network.directionTo': 'to',
        'common.network.directionAnd': 'und',
        'common.network.directionHaveMutually': 'haben gegenseitig',
        'common.network.addAllActiveMembersOf': 'Add all active members of',
        'common.network.addOnlyMembersOf': 'Add only',
        'common.network.membersWithRole': 'members with role',
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
        state.translations[key] ??
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
  state.translations = {};
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
      /Add only[\s\S]*Fraktion H66[\s\S]*members with role[\s\S]*Admin[\s\S]*(?:to|an)[\s\S]*Parlament Rosbach/
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

    expect(container.textContent).toContain('Diese GruppegibtAntragsrechttoH1');
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

describe('GroupRelationshipFields branch contracts', () => {
  const t = (key: string, params?: unknown) =>
    typeof params === 'object' && params !== null ? `${key}:${JSON.stringify(params)}` : key;

  it('covers all pure relationship label and inversion decisions', () => {
    expect(getGroupRelationshipDirectionOptions(t)).toHaveLength(3);
    expect(
      ['parent', 'child', 'sibling'].map(value => invertGroupRelationshipType(value as any))
    ).toEqual(['child', 'parent', 'sibling']);
    expect(
      ['parent', 'child', 'sibling'].map(value => getGroupRelationshipTypeLabel(value as any, t))
    ).toEqual(['common.network.parent', 'common.network.child', 'common.network.sibling']);
    expect(getGroupRelationshipRightLabel('informationRight', t)).toBe('common.network.rightInfo');
    expect(getGroupRelationshipRightLabel('customRight' as any, t)).toBe('customRight');
    for (const relationshipType of ['parent', 'child', 'sibling'] as const) {
      expect(
        getCurrentGroupRelationshipLabel({
          relationshipType,
          currentGroupName: relationshipType === 'parent' ? ' ' : 'Current',
          selectedGroupName: relationshipType === 'child' ? ' ' : 'Selected',
          siblingMembershipMode: 'open',
          t,
        })
      ).toBeTruthy();
    }
  });

  it('covers name tags, connector modes, previews, and summaries', () => {
    const { rerender, container } = render(
      <GroupRelationshipNameTag name="" kind="current" caseStyle="embedded" groupId="group-1" />
    );
    expect(container.querySelector('a')).toBeTruthy();
    rerender(
      <GroupRelationshipNameTag
        name="Selected"
        kind="selected"
        displayMode="name-only"
        groupId="group-2"
      />
    );
    rerender(<GroupRelationshipNameTag name="" kind="selected" />);

    for (const relationshipType of ['parent', 'child', 'sibling'] as const) {
      for (const mode of ['selection', 'statement', 'role'] as const) {
        rerender(
          <GroupRelationshipConnector
            relationshipType={relationshipType}
            mode={mode}
            siblingMembershipMode={mode === 'role' ? 'elected' : null}
            className="custom"
          />
        );
      }
    }
    rerender(
      <GroupRelationshipConnector
        relationshipType="sibling"
        mode="role"
        siblingMembershipMode="parliament"
      />
    );
    rerender(
      <GroupRelationshipConnector
        relationshipType="sibling"
        mode="role"
        siblingMembershipMode="open"
      />
    );
    rerender(
      <GroupRelationshipTypePreview
        relationshipType="parent"
        currentGroupName=""
        selectedGroupName=""
        currentGroupId="current"
        selectedGroupId="selected"
      />
    );
    rerender(
      <GroupRelationshipTypeSummary
        label="Summary"
        relationshipType="sibling"
        siblingMembershipMode="open"
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );
  });

  it('covers every membership description mode and canonical endpoint shape', () => {
    const common = {
      currentGroupName: '',
      selectedGroupName: '',
      currentGroupId: 'current',
      selectedGroupId: 'selected',
    };
    const { rerender } = render(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="all_members"
        direction="partner_members_to_current"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="all_members"
        direction="current_members_to_partner"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="role_members"
        direction="current_members_to_partner"
        requiredSourceRoleId="role-1"
        requiredSourceRoleName={null}
      />
    );
    rerender(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="selected_source_groups"
        direction="current_members_to_partner"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="selected_source_groups"
        direction="partner_members_to_current"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeDescription
        {...common}
        membershipMode="none"
        direction="current_members_to_partner"
      />
    );
    rerender(
      <SiblingMembershipModeDescription
        siblingMembershipMode="open"
        currentGroupName="Current"
        selectedGroupName="Selected"
        currentGroupId="current"
        selectedGroupId="selected"
        linkGroups={false}
      />
    );
    state.translations['common.network.siblingMembershipExplanationParliamentAfterSource'] = '.';
    rerender(
      <SiblingMembershipModeDescription
        siblingMembershipMode="parliament"
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );

    rerender(
      <GroupRelationshipMembershipModeSummary
        label="Membership"
        membershipMode="all_members"
        membershipDirection={null}
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeSummary
        label="Membership"
        membershipMode="role_members"
        membershipDirection="partner_members_to_current"
        currentGroupName="Current"
        selectedGroupName="Selected"
        membershipSourceGroupName="Source"
        membershipTargetGroupName="Target"
      />
    );
    rerender(
      <GroupRelationshipMembershipModeSummary
        label="Membership"
        membershipMode="all_members"
        currentGroupName="Current"
        selectedGroupName="Selected"
        membershipSourceGroupId="source-id"
        membershipTargetGroupId="target-id"
      />
    );
  });

  it('covers type selection, direction sentences, right lists, summaries, and selectors', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <GroupRelationshipTypeSelect
        label="Type"
        value="parent"
        currentGroupName="Current"
        selectedGroupName="Selected"
        onValueChange={onValueChange}
        helperText="Help"
        disabled
        disabledOptions={{ parent: true, child: false, sibling: true }}
      />
    );
    rerender(
      <GroupRelationshipTypeSelect
        label="Type"
        value="sibling"
        currentGroupName="Current"
        selectedGroupName="Selected"
        onValueChange={onValueChange}
      />
    );

    rerender(
      <GroupRelationshipDirectionSentence
        direction="mutual"
        right="informationRight"
        currentGroupName=""
        selectedGroupName=""
        currentGroupId="current"
        selectedGroupId="selected"
      />
    );
    rerender(
      <GroupRelationshipRightSentenceList currentGroupName="Current" selectedGroupName="Selected" />
    );
    rerender(
      <GroupRelationshipRightSentenceList
        rights={['informationRight', 'amendmentRight', 'speakingRight'] as never}
        rightDirections={
          {
            informationRight: 'none',
            amendmentRight: 'mutual',
            speakingRight: 'partner_grants_right_to_current',
          } as never
        }
        currentGroupName="Current"
        selectedGroupName="Selected"
        className="list"
        itemClassName="item"
        linkGroups={false}
      />
    );

    rerender(
      <GroupRelationshipRightsSummary
        label="Rights"
        selectedRights={[]}
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );
    rerender(
      <GroupRelationshipRightsSummary
        label="Rights"
        helperText="Help"
        selectedRights={[
          'informationRight',
          'amendmentRight',
          'rightToSpeak',
          'activeVotingRight',
          'passiveVotingRight',
        ]}
        existingRightStatuses={
          new Map([
            ['informationRight', 'accepted'],
            ['amendmentRight', 'incoming'],
            ['rightToSpeak', 'outgoing'],
            ['activeVotingRight', 'custom' as any],
          ])
        }
        rightDirections={{
          informationRight: 'none',
          amendmentRight: 'mutual',
        }}
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );
    rerender(
      <GroupRelationshipRightsSummary
        label="Rights"
        selectedRights={['informationRight']}
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );

    rerender(
      <GroupRelationshipRightsSelector
        label="Rights"
        tutorialAnchor="anchor"
        tutorialInputValues={['one']}
        selectedRights={new Set()}
        onToggleRight={vi.fn()}
        helperText="Help"
        disabled
        optionsContainerClassName="options"
      />
    );
    rerender(
      <GroupRelationshipRightsSelector
        label="Rights"
        tutorialInputValues={[]}
        selectedRights={new Set(['informationRight', 'amendmentRight'])}
        onToggleRight={vi.fn()}
        existingRightStatuses={
          new Map([
            ['informationRight', 'accepted'],
            ['amendmentRight', 'incoming'],
          ])
        }
        rightDirections={{ informationRight: 'none' }}
        currentGroupName="Current"
        selectedGroupName="Selected"
      />
    );
  });
});
