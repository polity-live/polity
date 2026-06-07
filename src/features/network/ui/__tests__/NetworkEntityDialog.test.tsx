/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkEntityDialog } from '../NetworkEntityDialog';

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
  useNavigate: () => vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) => {
      const templates: Record<string, string> = {
        'common.labels.relationshipDetails': 'Beziehungsdetails',
        'common.labels.viewRelationshipInfo': 'Informationen zu dieser Beziehung anzeigen',
        'common.network.relationshipTypeLabel': 'Beziehungstyp',
        'common.network.membershipModeLabel': 'Membership-Modus',
        'common.network.selectRights': 'Rechte auswählen (mehrere möglich)',
        'common.network.directionDetails': 'Richtung der einzelnen Rechte',
        'common.network.rightAmendment': 'Antragsrecht',
        'common.network.rightAmendmentDesc': 'Recht, Anträge zu stellen',
        'common.network.directionHas': 'hat',
        'common.network.directionIn': 'in',
        'common.network.directionGrants': 'vergibt',
        'common.network.directionTo': 'an',
        'common.network.currentGroupAsParentOf':
          '{{currentGroupName}} als übergeordnete Gruppe von {{selectedGroupName}}',
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NetworkEntityDialog', () => {
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
            membershipDirection: 'incoming',
            currentGroupId: 'group-current',
            currentGroupName: 'C1',
            selectedGroupId: 'group-partner',
            selectedGroupName: 'B1',
            rightDisplayDirections: { amendmentRight: 'outgoing' },
          },
        }}
      />
    );

    expect(screen.getByText('Die aktuelle Gruppe')).toBeTruthy();
    expect(screen.getByText('ist übergeordnet, die gewählte Partnergruppe')).toBeTruthy();
    expect(screen.queryByText('C1 als übergeordnete Gruppe von B1')).toBeNull();
    expect(screen.getByText('Membership-Modus')).toBeTruthy();
    expect(screen.getByText('All members')).toBeTruthy();
    expect(screen.getByText('Alle aktiven Mitglieder von')).toBeTruthy();
    expect(screen.getByText('werden in')).toBeTruthy();
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
            membershipDirection: 'outgoing',
            currentGroupId: 'group-b2',
            currentGroupName: 'B2',
            selectedGroupId: 'group-h1',
            selectedGroupName: 'H1',
            rightDisplayDirections: { amendmentRight: 'incoming' },
          },
        }}
      />
    );

    expect(screen.getByText('All members')).toBeTruthy();
    expect(screen.getByText('Alle aktiven Mitglieder von')).toBeTruthy();
    expect(screen.getByText('werden in')).toBeTruthy();
    expect(screen.getAllByText('B2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('H1').length).toBeGreaterThan(0);
  });

  it('renders hierarchy rights from the child-group perspective as "hat ... in"', () => {
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
            membershipDirection: 'incoming',
            currentGroupId: 'group-tb3',
            currentGroupName: 'TB3',
            selectedGroupId: 'group-th3',
            selectedGroupName: 'TH3',
            rightEdgeDirections: { amendmentRight: 'backward' },
            rightDisplayDirections: { amendmentRight: 'incoming' },
          },
        }}
      />
    );

    expect(screen.getAllByText('TB3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TH3').length).toBeGreaterThan(0);
    expect(screen.getByText('hat')).toBeTruthy();
    expect(screen.getByText('in')).toBeTruthy();
    expect(screen.queryByText('vergibt')).toBeNull();
  });
});
