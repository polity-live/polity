/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMembershipRightsAlignmentRows } from '@/features/groups/logic/membershipRightsAlignment';
import { MembershipRightsAlignmentPanel } from '../MembershipRightsAlignmentPanel';
import type { ParticipationLike } from '@/features/shared/types/participation';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { defaultValue?: string; count?: number }) => {
      if (typeof fallbackOrOptions === 'string') {
        return fallbackOrOptions;
      }
      return (
        fallbackOrOptions?.defaultValue?.replace(
          '{{count}}',
          String(fallbackOrOptions.count ?? '')
        ) ?? key
      );
    },
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) =>
    key === 'generated.inline.0722_view_documents_f5f5d899' ? 'View Documents' : (fallback ?? key),
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      (
        ({
          'features.groups.memberships.rightsAlignment.actions.rights': 'Rights',
          'features.groups.memberships.rightsAlignment.actions.manageRoles': 'Manage roles',
        }) as Record<string, string>
      )[key] ??
      fallback ??
      key,
  }),
}));

afterEach(() => {
  cleanup();
});

const viewRole = {
  id: 'role-view',
  name: 'Viewer',
  action_rights: [{ resource: 'groups', action: 'view' }],
};

const documentsRole = {
  id: 'role-documents',
  name: 'Documents',
  action_rights: [{ resource: 'groupDocuments', action: 'view' }],
};

const linksRole = {
  id: 'role-links',
  name: 'Links',
  action_rights: [{ resource: 'groupLinks', action: 'view' }],
};

function membership(overrides: Partial<ParticipationLike> = {}): ParticipationLike {
  return {
    id: 'membership-1',
    user_id: 'user-1',
    group_id: 'hierarchy',
    source_group_id: 'base',
    user: {
      id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
    },
    roles: [viewRole],
    role: null,
    baseGroup: { id: 'base', name: 'Base Group' },
    partGroup: { id: 'part', name: 'Part Group' },
    ...overrides,
  };
}

describe('MembershipRightsAlignmentPanel', () => {
  it('renders alignment rows and opens the existing rights and role dialogs', () => {
    const rows = buildMembershipRightsAlignmentRows({
      targetGroupId: 'hierarchy',
      memberships: [membership()],
      grants: [
        {
          id: 'grant-information',
          connection_id: 'connection-information',
          holder_group_id: 'base',
          scope_group_id: 'hierarchy',
          right_key: 'informationRight',
          status: 'active',
        },
      ],
    });
    const onOpenRightsDialog = vi.fn();
    const onOpenChangeRoleDialog = vi.fn();

    render(
      <MembershipRightsAlignmentPanel
        rows={rows}
        onOpenRightsDialog={onOpenRightsDialog}
        onOpenChangeRoleDialog={onOpenChangeRoleDialog}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Part Group')).toBeTruthy();
    expect(screen.getByText('Info')).toBeTruthy();
    expect(screen.getByText('View Documents')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: /^features\.groups\.memberships\.rightsAlignment\.actions\.rights$/,
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /^features\.groups\.memberships\.rightsAlignment\.actions\.manageRoles$/,
      })
    );

    expect(onOpenRightsDialog).toHaveBeenCalledWith(rows[0].membership);
    expect(onOpenChangeRoleDialog).toHaveBeenCalledWith(rows[0].membership);
  });

  it('filters by status without mutating the source rows', () => {
    const rows = buildMembershipRightsAlignmentRows({
      targetGroupId: 'hierarchy',
      memberships: [
        membership({ id: 'missing-membership', roles: [viewRole], role: null }),
        membership({
          id: 'aligned-membership',
          user_id: 'user-2',
          user: { id: 'user-2', first_name: 'Grace', last_name: 'Hopper' },
          roles: [viewRole, documentsRole, linksRole],
          role: null,
        }),
      ],
      grants: [
        {
          id: 'grant-information',
          connection_id: 'connection-information',
          holder_group_id: 'base',
          scope_group_id: 'hierarchy',
          right_key: 'informationRight',
          status: 'active',
        },
      ],
    });

    render(
      <MembershipRightsAlignmentPanel
        rows={rows}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /missing/i }));

    const missingFilter = screen.getByRole('radio', { name: /missing/i });
    expect(missingFilter.getAttribute('data-slot')).toBe('filter-toggle-group-item');
    expect(missingFilter.className).toContain('data-[state=on]:bg-primary');

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(rows).toHaveLength(2);
  });
});
