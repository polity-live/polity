/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  membershipTabsProps: null as any,
  roleFilterChange: undefined as undefined | ((ids: string[]) => void),
  changeRoleProps: null as any,
  pageQueries: [] as any[],
  singleQueries: [] as any[],
  mappedRows: [] as any[],
}));

function exerciseSource(source: any) {
  if (!source) return;
  mocks.pageQueries.push(
    source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }),
    source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false })
  );
  mocks.singleQueries.push(
    source.getSingleQuery({ id: 'known', settled: true }),
    source.getSingleQuery({ id: 'unknown', settled: false })
  );
  source.getRowKey({ id: 'row' });
  source.toStartRow({ id: 'row', created_at: 1 });
  mocks.mappedRows.push(source.mapRow({ id: 'known' }), source.mapRow({ id: 'unknown' }));
}

vi.mock('@/features/shared/ui/form', () => ({
  ManagementToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({ EntitySearchBar: () => <div>search</div> }));
vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: ({ onSelectedRoleIdsChange }: any) => {
    mocks.roleFilterChange = onSelectedRoleIdsChange;
    return <div>role filter</div>;
  },
  filterParticipationsByRole: (items: any[], roleIds: string[]) =>
    roleIds.length === 0 ? items : items.filter(item => roleIds.includes(item.role_id)),
}));
vi.mock('@/features/groups/ui/MembershipTabs', () => ({
  MembershipTabs: (props: any) => {
    mocks.membershipTabsProps = props;
    return (
      <div>
        {props.tabBarAction}
        {props.membershipsByUserContent}
        {props.membershipsByRoleContent}
        {props.rolesContent}
      </div>
    );
  },
}));
vi.mock('@/features/groups/ui/PendingRequestsTable', () => ({
  PendingRequestsTable: ({ virtualSource }: any) => {
    exerciseSource(virtualSource);
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/PendingInvitationsTable', () => ({
  PendingInvitationsTable: ({ virtualSource }: any) => {
    exerciseSource(virtualSource);
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/ActiveMembersTable', () => ({
  ActiveMembersTable: ({ virtualSource }: any) => {
    exerciseSource(virtualSource);
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/MembershipsByRoleTables', () => ({
  MembershipsByRoleTables: ({ getVirtualSource }: any) => {
    exerciseSource(getVirtualSource('role'));
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/ChangeRoleDialog', () => ({
  ChangeRoleDialog: (props: any) => {
    mocks.changeRoleProps = props;
    return <div />;
  },
}));
vi.mock('@/features/groups/ui/MemberRightsDialog', () => ({ MemberRightsDialog: () => <div /> }));
vi.mock('../InviteDialog.tsx', () => ({ InviteDialog: () => <div>invite</div> }));
vi.mock('../RolesManagementCard.tsx', () => ({ RolesManagementCard: () => <div>roles</div> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      collaboratorPage: (args: any) => ({ type: 'page', args }),
      collaboratorById: (args: any) => ({ type: 'single', args }),
    },
  },
}));

import { CollaboratorsView } from '../CollaboratorsView';

const collaborator = (overrides: Record<string, any> = {}) => ({
  id: 'known',
  user_id: 'user',
  role_id: 'role',
  status: 'member',
  user: { first_name: 'Ada', last_name: 'Lovelace' },
  ...overrides,
});

function props(overrides: Record<string, any> = {}) {
  const known = collaborator();
  return {
    activeCollaborators: [known],
    activeTab: 'membershipsByUser',
    amendmentId: 'amendment',
    amendmentTitle: 'Title',
    collaborators: [known],
    changeRoleMembership: known,
    changeRoleOpen: true,
    memberRightsMembership: null,
    memberRightsOpen: false,
    membershipSort: { field: 'user', direction: 'asc' },
    onActiveTabChange: vi.fn(),
    onApproveRequest: vi.fn(),
    onChangeRoleOpenChange: vi.fn(),
    onConfirmRoleChange: vi.fn(),
    onCreateRole: vi.fn(),
    onDeleteRole: vi.fn(),
    onInviteUsers: vi.fn(),
    onMemberRightsOpenChange: vi.fn(),
    onMembershipSortChange: vi.fn(),
    onNavigateToUser: vi.fn(),
    onOpenChangeRoleDialog: vi.fn(),
    onOpenMemberRightsDialog: vi.fn(),
    onRejectRequest: vi.fn(),
    onRemoveCollaborator: vi.fn(),
    onRemoveRoleFromByRoleView: vi.fn(),
    onSearchQueryChange: vi.fn(),
    onToggleActionRight: vi.fn(),
    onWithdrawInvitation: vi.fn(),
    pendingInvitations: [],
    pendingRequests: [],
    roles: [
      { id: 'role', name: 'Role' },
      { id: '', name: 'Invalid' },
    ],
    searchQuery: 'query',
    ...overrides,
  } as any;
}

describe('CollaboratorsView A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    mocks.membershipTabsProps = null;
    mocks.roleFilterChange = undefined;
    mocks.changeRoleProps = null;
    mocks.pageQueries = [];
    mocks.singleQueries = [];
    mocks.mappedRows = [];
  });

  it('builds virtual sources with settled and live query policies and row fallbacks', () => {
    render(<CollaboratorsView {...props()} />);
    expect(mocks.pageQueries.some(result => result.options.ttl === '5m')).toBe(true);
    expect(mocks.pageQueries.some(result => result.options.ttl === 'none')).toBe(true);
    expect(mocks.singleQueries.some(result => result.options.ttl === '5m')).toBe(true);
    expect(mocks.singleQueries.some(result => result.options.ttl === 'none')).toBe(true);
    expect(mocks.mappedRows).toEqual(
      expect.arrayContaining([expect.objectContaining({ user_id: 'user' }), { id: 'unknown' }])
    );
    expect(mocks.membershipTabsProps.tabBarAction).toBeTruthy();
    expect(mocks.changeRoleProps.memberName).toBe('Ada Lovelace');
  });

  it('filters active role ids and marks role sections as filtered', () => {
    render(<CollaboratorsView {...props()} />);
    act(() => mocks.roleFilterChange?.(['role', 'removed']));
    expect(mocks.membershipTabsProps.membershipsByRoleContent.props.hideEmptyRoleSections).toBe(
      true
    );
  });

  it('hides toolbar and invite actions on the roles tab', () => {
    render(<CollaboratorsView {...props({ activeTab: 'roles' })} />);
    expect(mocks.membershipTabsProps.tabBarAction).toBeNull();
    expect(mocks.roleFilterChange).toBeUndefined();
  });

  it('handles no roles and default collaborator rows', () => {
    render(<CollaboratorsView {...props({ roles: [], collaborators: undefined })} />);
    expect(mocks.roleFilterChange).toBeUndefined();
    expect(mocks.membershipTabsProps.membershipsByRoleContent.props.hideEmptyRoleSections).toBe(
      false
    );
  });

  it('resolves unknown names and every current-role fallback', () => {
    const unknown = collaborator({
      user: { first_name: null, last_name: null },
      roles: undefined,
      role: { id: 'single' },
    });
    const { rerender } = render(
      <CollaboratorsView {...props({ changeRoleMembership: unknown })} />
    );
    expect(mocks.changeRoleProps.memberName).toBe('Unknown User');
    expect(mocks.changeRoleProps.currentRoles).toEqual([{ id: 'single' }]);

    rerender(
      <CollaboratorsView
        {...props({ changeRoleMembership: collaborator({ roles: undefined, role: undefined }) })}
      />
    );
    expect(mocks.changeRoleProps.currentRoles).toEqual([]);

    rerender(<CollaboratorsView {...props({ changeRoleMembership: null })} />);
    expect(mocks.changeRoleProps.memberName).toBe('');
  });
});
