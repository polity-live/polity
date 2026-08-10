/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkEntityDialog } from '../NetworkEntityDialog';

const navigate = vi.hoisted(() => vi.fn());
const groupEvents = vi.hoisted(() => ({ props: [] as any[] }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: { id?: string };
    [key: string]: unknown;
  }) => (
    <a href={typeof to === 'string' ? to.replace('$id', String(params?.id ?? '')) : '#'} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (
    key: string,
    paramsOrFallback?: string | Record<string, unknown>,
    fallback?: string
  ) => {
    const labels: Record<string, string> = {
      'common.network.addAllActiveMembersOf': 'Add all active members of',
      'common.network.addOnlyMembersOf': 'Add only',
      'common.network.directionTo': 'to',
      'common.network.isChildGroupOf': 'is the child group of',
      'common.network.isConnectedWith': 'is connected with',
      'common.network.isParentGroupOf': 'is the parent group of',
      'common.network.membersWithRole': 'members with role',
      'features.network.membershipModes.all_members': 'All active members',
      'features.network.membershipModes.none': 'No automatic membership',
      'features.network.membershipModes.role_members': 'Members with selected role',
      'features.network.membershipModes.selected_source_groups': 'Parliament membership',
      'generated.inline.0770_ist_bergeordnet_die_aktuelle_gruppe_36b12d80':
        'ist übergeordnet, die aktuelle Gruppe',
      'generated.inline.0771_ist_untergeordnet_9610f87b': 'ist untergeordnet',
      'generated.inline.0772_die_aktuelle_gruppe_d7fbaf59': 'Die aktuelle Gruppe',
      'generated.inline.0773_ist_bergeordnet_die_gew_hlte_partnergruppe_4d9d2a93':
        'ist übergeordnet, die gewählte Partnergruppe',
      'generated.inline.0795_die_gew_hlte_partnergruppe_1a260d6d': 'Die gewählte Partnergruppe',
    };

    return (
      labels[key] ?? (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key
    );
  },
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.labels.relationshipDetails': 'Beziehungsdetails',
        'common.labels.viewRelationshipInfo': 'Informationen zu dieser Beziehung anzeigen',
        'common.network.relationshipTypeLabel': 'Beziehungstyp',
        'common.network.membershipModeLabel': 'Membership-Modus',
        'common.network.selectRights': 'Rechte auswählen (mehrere möglich)',
        'common.network.directionDetails': 'Richtung der einzelnen Rechte',
        'common.network.thisGroup': 'Diese Gruppe',
        'common.network.thisGroupEmbedded': 'diese Gruppe',
        'common.network.addAllActiveMembersOf': 'Add all active members of',
        'common.network.addOnlyMembersOf': 'Add only',
        'common.network.isChildGroupOf': 'is the child group of',
        'common.network.isConnectedWith': 'is connected with',
        'common.network.isParentGroupOf': 'is the parent group of',
        'common.network.membersWithRole': 'members with role',
        'common.network.rightAmendment': 'Antragsrecht',
        'common.network.rightAmendmentDesc': 'Recht, Anträge zu stellen',
        'common.network.directionHas': 'hat',
        'common.network.directionIn': 'in',
        'common.network.directionGrants': 'gibt',
        'common.network.directionTo': 'to',
        'common.network.directionAnd': 'und',
        'common.network.directionHaveMutually': 'haben gegenseitig',
        'common.network.currentGroupGivesRightTo':
          '{{currentGroupName}} gibt {{rightLabel}} an {{selectedGroupName}}',
        'common.network.currentGroupHasRightIn':
          '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
        'common.network.groupsMutuallyShareRight':
          '{{currentGroupName}} und {{selectedGroupName}} haben gegenseitig {{rightLabel}}',
        'common.network.currentGroupAsParentOf':
          '{{currentGroupName}} als übergeordnete Gruppe von {{selectedGroupName}}',
        'common.network.selectedRole': 'selected role',
        'common.actions.cancel': 'Abbrechen',
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

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/search/ui/GroupSearchCard', () => ({
  GroupSearchCard: () => <div data-testid="group-search-card" />,
}));

vi.mock('../GroupEventsList', () => ({
  GroupEventsList: (props: any) => {
    groupEvents.props.push(props);
    return <div data-testid="group-events-list" />;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  groupEvents.props = [];
});

describe('NetworkEntityDialog', () => {
  it('uses custom and default group-event selection and nullable group names', () => {
    const onOpenChange = vi.fn();
    const onEventSelect = vi.fn();
    const { rerender } = render(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{
          type: 'group',
          data: { id: 'group-1', name: null, onEventSelect },
        }}
      />
    );
    groupEvents.props.at(-1).onEventClick('event-1', { id: 'event-1' });
    expect(onEventSelect).toHaveBeenCalledWith('event-1', { id: 'event-1' });
    expect(navigate).not.toHaveBeenCalled();

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{ type: 'group', data: { id: 'group-2', name: 'Council' } }}
      />
    );
    groupEvents.props.at(-1).onEventClick('event-2', { id: 'event-2' });
    expect(navigate).toHaveBeenCalledWith({ to: '/event/event-2' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders complete and minimal event and user details', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{
          type: 'event',
          data: {
            id: 'event-full',
            imageURL: 'event.png',
            title: null,
            description: 'Description',
            startDate: 1,
            location: 'Berlin',
          },
        }}
      />
    );
    expect(document.querySelector('img')?.getAttribute('alt')).toBeNull();
    rerender(
      <NetworkEntityDialog open onOpenChange={onOpenChange} entity={{ type: 'event', data: {} }} />
    );
    expect(
      document.querySelector('[data-action-id="network.entity-dialog.event.open"]')
    ).toBeNull();

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{
          type: 'user',
          data: {
            id: 'user-full',
            name: null,
            subtitle: 'Subtitle',
            avatarFile: { url: 'avatar.png' },
          },
        }}
      />
    );
    expect(document.querySelector('img')?.getAttribute('alt')).toBeNull();
    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{ type: 'user', data: { avatarFile: null } }}
      />
    );
    expect(document.querySelector('[data-action-id="network.entity-dialog.user.open"]')).toBeNull();
  });

  it('renders relationship fallbacks without canonical preview metadata', () => {
    const base = {
      source: 'source',
      target: 'target',
      sourceName: 'Source',
      targetName: 'Target',
    };
    const { rerender } = render(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{
          type: 'relationship',
          data: {
            ...base,
            relationshipType: 'other' as never,
            label: 'Relation',
            membershipMode: 'all_members',
            rights: ['amendmentRight', 'not-a-right'],
          },
        }}
      />
    );
    expect(screen.getByText('Relation')).toBeTruthy();

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{
          type: 'relationship',
          data: {
            ...base,
            relationshipType: 'other' as never,
            label: 'Connection label',
            rights: [],
            relationshipKinds: ['active', 'incoming', 'outgoing', 'custom'] as never,
          },
        }}
      />
    );
    expect(screen.getAllByText('Connection label').length).toBeGreaterThan(0);

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={vi.fn()}
        entity={{
          type: 'relationship',
          data: { ...base, relationshipType: 'other' as never, label: null, rights: null as never },
        }}
      />
    );
    expect(screen.getByText('common.labels.connection')).toBeTruthy();
  });

  it('closes and navigates to every supported entity through stable actions', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{ type: 'group', data: { id: 'group-1', name: 'Council' } }}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="network.entity-dialog.group.open"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/group/group-1' });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{ type: 'user', data: { id: 'user-1', name: 'Ada' } }}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.entity-dialog.user.open"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/user/user-1' });

    rerender(
      <NetworkEntityDialog
        open
        onOpenChange={onOpenChange}
        entity={{ type: 'event', data: { id: 'event-1', title: 'Assembly' } }}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.entity-dialog.event.open"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/event/event-1' });

    fireEvent.click(document.querySelector('[data-action-id="network.entity-dialog.close"]')!);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('renders static relationship summaries without the compact duplicate helper line', () => {
    const { container } = render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'group-current',
            target: 'group-partner',
            sourceName: 'C1',
            targetName: 'B1',
            rights: ['amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: { amendmentRight: 'active' },
            relationshipType: 'parent',
            membershipMode: 'all_members',
            membershipDirection: 'partner_members_to_current',
            currentGroupId: 'group-current',
            currentGroupName: 'C1',
            selectedGroupId: 'group-partner',
            selectedGroupName: 'B1',
            rightDisplayDirections: { amendmentRight: 'current_grants_right_to_partner' },
          },
        }}
      />
    );

    expect(screen.getByText('Diese Gruppe')).toBeTruthy();
    expect(screen.getByText('is the parent group of')).toBeTruthy();
    expect(screen.queryByText('C1 als übergeordnete Gruppe von B1')).toBeNull();
    expect(screen.getByText('Membership-Modus')).toBeTruthy();
    expect(screen.getByText('All active members')).toBeTruthy();
    expect(screen.getByText('Add all active members of')).toBeTruthy();
    expect(screen.getAllByText('to').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Antragsrecht').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('renders a full membership sentence for foreign edges when explicit preview metadata is present', () => {
    render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'parent-group-h1',
            target: 'child-group-b2',
            sourceName: 'H1',
            targetName: 'B2',
            rights: ['amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: { amendmentRight: 'active' },
            relationshipType: 'child',
            membershipMode: 'all_members',
            membershipDirection: 'current_members_to_partner',
            currentGroupId: 'group-b2',
            currentGroupName: 'B2',
            selectedGroupId: 'group-h1',
            selectedGroupName: 'H1',
            rightDisplayDirections: { amendmentRight: 'partner_grants_right_to_current' },
          },
        }}
      />
    );

    expect(screen.getByText('All active members')).toBeTruthy();
    expect(screen.getByText('Add all active members of')).toBeTruthy();
    expect(screen.getAllByText('to').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('H1').length).toBeGreaterThan(0);
  });

  it('renders membership mode from canonical source and target groups', () => {
    const { container } = render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'group-h1',
            target: 'group-b2',
            sourceName: 'H1',
            targetName: 'B2',
            rights: [],
            relationshipKinds: ['active'],
            rightRelationshipKinds: {},
            relationshipType: 'parent',
            membershipMode: 'all_members',
            membershipDirection: 'current_members_to_partner',
            currentGroupId: 'group-h1',
            currentGroupName: 'H1',
            selectedGroupId: 'group-b2',
            selectedGroupName: 'B2',
            membershipSourceGroupId: 'group-b2',
            membershipTargetGroupId: 'group-h1',
            membershipSourceGroupName: 'B2',
            membershipTargetGroupName: 'H1',
          },
        }}
      />
    );

    expect(container.textContent).toMatch(/Add all active members of[\s\S]*B2[\s\S]*to[\s\S]*H1/);
    expect(container.textContent).not.toMatch(
      /Add all active members of[\s\S]*H1[\s\S]*to[\s\S]*B2/
    );
  });

  it('renders the selected source role in role-members membership summaries', () => {
    const { container } = render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'group-h66',
            target: 'group-h66-faction',
            sourceName: 'H66',
            targetName: 'H66 Fraktion',
            rights: [],
            relationshipKinds: ['active'],
            rightRelationshipKinds: {},
            relationshipType: 'sibling',
            membershipMode: 'role_members',
            membershipDirection: 'current_members_to_partner',
            currentGroupId: 'group-h66',
            currentGroupName: 'H66',
            selectedGroupId: 'group-h66-faction',
            selectedGroupName: 'H66 Fraktion',
            membershipSourceGroupId: 'group-h66',
            membershipTargetGroupId: 'group-h66-faction',
            membershipSourceGroupName: 'H66',
            membershipTargetGroupName: 'H66 Fraktion',
            membershipRequiredSourceRoleId: 'role-admin',
            membershipRequiredSourceRoleName: 'Admin',
          },
        }}
      />
    );

    expect(container.textContent).toMatch(
      /Add only[\s\S]*H66[\s\S]*members with role[\s\S]*Admin[\s\S]*to[\s\S]*H66 Fraktion/
    );
    expect(screen.getByText('Admin').closest('[data-role-key="role-admin"]')).toBeTruthy();
  });

  it('renders hierarchy rights from the current-group perspective as "has ... in"', () => {
    render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'parent-group-th3',
            target: 'child-group-tb3',
            sourceName: 'TH3',
            targetName: 'TB3',
            rights: ['amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: { amendmentRight: 'active' },
            relationshipType: 'child',
            membershipMode: 'all_members',
            membershipDirection: 'current_members_to_partner',
            currentGroupId: 'group-tb3',
            currentGroupName: 'TB3',
            selectedGroupId: 'group-th3',
            selectedGroupName: 'TH3',
            rightEdgeDirections: { amendmentRight: 'backward' },
            rightDisplayDirections: { amendmentRight: 'partner_grants_right_to_current' },
          },
        }}
      />
    );

    expect(screen.getAllByText('TB3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TH3').length).toBeGreaterThan(0);
    expect(screen.getByText('hat')).toBeTruthy();
    expect(screen.getByText('in')).toBeTruthy();
    expect(screen.queryByText('gives')).toBeNull();
    expect(screen.queryByText('vergibt')).toBeNull();
  });

  it('does not render the synthetic membership flow channel as a real right', () => {
    render(
      <NetworkEntityDialog
        open
        onOpenChange={() => undefined}
        entity={{
          type: 'relationship',
          data: {
            source: 'group-h1',
            target: 'group-b1',
            sourceName: 'H1',
            targetName: 'B1',
            rights: ['membership', 'amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: { membership: 'active', amendmentRight: 'active' },
            relationshipType: 'parent',
            membershipMode: 'all_members',
            membershipDirection: 'partner_members_to_current',
            currentGroupId: 'group-h1',
            currentGroupName: 'H1',
            selectedGroupId: 'group-b1',
            selectedGroupName: 'B1',
            membershipSourceGroupId: 'group-b1',
            membershipTargetGroupId: 'group-h1',
            membershipSourceGroupName: 'B1',
            membershipTargetGroupName: 'H1',
            rightDisplayDirections: {
              membership: 'partner_grants_right_to_current',
              amendmentRight: 'current_grants_right_to_partner',
            },
          },
        }}
      />
    );

    expect(screen.getAllByText('Antragsrecht').length).toBeGreaterThan(0);
    expect(screen.queryByText('Membership')).toBeNull();
  });
});
