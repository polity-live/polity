/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GroupRelationshipDirectionSentence,
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
        'common.network.directionIn': 'in',
        'common.network.currentGroupHasRightIn':
          '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
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

    expect(screen.getByText('Diese Gruppe (Parlament Rosbach)')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('GroupRelationshipDirectionSentence', () => {
  it('renders right sentences with token chips instead of legacy gradient text', () => {
    const { container } = render(
      <GroupRelationshipDirectionSentence
        direction="current_has_right_in_partner"
        right="amendmentRight"
        currentGroupName="B1"
        selectedGroupName="H1"
        linkGroups={false}
      />
    );

    expect(container.textContent).toContain('B1hatAntragsrechtinH1');
    expect(screen.getByText('Antragsrecht')).toBeTruthy();
    expect(container.innerHTML).toContain('var(--entity-group-bg)');
    expect(container.innerHTML).toContain('var(--entity-amendment-bg)');
    expect(container.innerHTML).not.toContain('bg-gradient');
    expect(container.innerHTML).not.toContain('text-transparent');
    expect(container.innerHTML).not.toContain('text-white');
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
