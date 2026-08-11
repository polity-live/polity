/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  data: [] as any[],
  virtual: [] as any[],
  actions: [] as any[],
  requestActions: [] as any[],
  useFallbackTranslation: false,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      mocks.useFallbackTranslation && fallback ? fallback : key,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock('@/features/groups/logic/buildMembershipRightsSummary', () => ({
  getMembershipDisplayRoles: (membership: any) => membership.displayRoles ?? [],
}));
vi.mock('@/features/groups/logic/membershipDisplayRoles', () => ({
  getMembershipDisplayRoles: (membership: any) => membership.displayRoles ?? [],
  hasElectedDisplayRole: (membership: any) => Boolean(membership.elected),
}));
vi.mock('@/features/groups/logic/membershipComposition', () => ({
  getMembershipProvenanceDisplayLabel: (membership: any, column: string) =>
    membership[column]?.name ?? 'Direct',
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    mocks.data.push(props);
    return <div data-testid="data" />;
  },
  VirtualDataTable: (props: any) => {
    mocks.virtual.push(props);
    return <div data-testid="virtual" />;
  },
  TableActionIconButton: (props: any) => {
    mocks.actions.push(props);
    return (
      <button disabled={props.disabled} onClick={props.onClick}>
        {props.label}
      </button>
    );
  },
  UserTableCell: ({ user }: any) => <span>{user?.first_name ?? 'user'}</span>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  CountBadge: ({ count }: any) => <span>{count}</span>,
  EntityBadge: ({ children }: any) => <span>{children}</span>,
  StatusBadge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  ManagementSection: ({ children }: any) => <section>{children}</section>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt }: any) => <span>{alt}</span>,
}));
vi.mock('../RoleTag', () => ({
  RoleTag: ({ children, roleName }: any) => <span>{children ?? roleName}</span>,
}));
vi.mock('../PendingRequestActionCell', () => ({
  PendingRequestActionCell: (props: any) => {
    mocks.requestActions.push(props);
    return <button>request action</button>;
  },
}));

import { ActiveMembersTable } from '../ActiveMembersTable';
import { MembershipsByRoleTables } from '../MembershipsByRoleTables';
import { PendingInvitationsTable } from '../PendingInvitationsTable';
import { PendingRequestsTable } from '../PendingRequestsTable';

beforeEach(() => {
  mocks.data.length = 0;
  mocks.virtual.length = 0;
  mocks.actions.length = 0;
  mocks.requestActions.length = 0;
  mocks.useFallbackTranslation = false;
});
afterEach(cleanup);
const membership = (extra: any = {}) => ({
  id: 'm',
  user_id: 'u',
  group_id: 'g',
  user: {},
  displayRoles: [],
  source: 'direct',
  created_at: null,
  ...extra,
});
const cell = (column: any, value: any) => column.cell({ row: { original: value } });

describe('membership table branch cells', () => {
  it('covers active-member sorting, provenance, delegation, roles, dates, actions, and virtual data', () => {
    const openRights = vi.fn(),
      changeRole = vi.fn(),
      remove = vi.fn(),
      sort = vi.fn();
    const props = {
      members: [],
      sort: { field: 'user' as const, direction: 'asc' as const },
      onSortChange: sort,
      onOpenRightsDialog: openRights,
      onOpenChangeRoleDialog: changeRole,
      onRemove: remove,
    };
    const view = render(
      <ActiveMembersTable {...props} showProvenanceColumns showDelegateRepresentationColumn />
    );
    let columns = mocks.data.at(-1).columns;
    const byId = (id: string) => columns.find((column: any) => column.id === id);
    const direct = membership();
    const populated = membership({
      user: { id: 'u', first_name: 'Ada' },
      created_at: 1,
      displayRoles: [{ id: 'r', name: '' }],
      partGroup: { id: 'p', name: 'Part' },
      baseGroup: { id: 'b', name: 'Base' },
      delegateRepresentedGroups: [
        { id: 'one', name: 'One', seatCount: 1 },
        { id: 'two', name: 'Two', seatCount: 2 },
      ],
    });
    const derived = membership({ user: { id: 'u' }, source: 'derived' });
    const readOnly = membership({ user: { id: 'u' }, effectiveReadOnly: true });
    render(
      <>
        {byId('user').header()}
        {byId('user').cell({ row: { original: populated } })}
        {['role', 'delegateRepresents', 'partGroup', 'baseGroup', 'joined', 'actions'].flatMap(
          id => [cell(byId(id), direct), cell(byId(id), populated)]
        )}
        {cell(byId('actions'), derived)}
        {cell(byId('actions'), readOnly)}
      </>
    );
    mocks.actions.forEach(action => action.onClick());
    expect(openRights).toHaveBeenCalled();
    expect(changeRole).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('m', 'u');

    view.rerender(<ActiveMembersTable {...props} sort={{ field: 'role', direction: 'asc' }} />);
    columns = mocks.data.at(-1).columns;
    render(<>{columns.find((column: any) => column.id === 'user').header()}</>);
    view.rerender(<ActiveMembersTable {...props} sort={{ field: 'user', direction: 'desc' }} />);
    columns = mocks.data.at(-1).columns;
    render(<>{columns.find((column: any) => column.id === 'user').header()}</>);
    fireEvent.click(document.querySelector('[data-action-id="groups.members.active.sort-user"]')!);
    view.rerender(
      <ActiveMembersTable
        {...props}
        showPartGroupColumn
        showBaseGroupColumn
        virtualSource={{} as any}
        title="Title"
        description="Desc"
        fallbackRoleLabel="Fallback"
        manageRolesLabel="Manage"
        removeLabel="Remove"
      />
    );
    expect(mocks.virtual.at(-1).source).toEqual({});
    expect(mocks.data[0].getRowId(populated)).toBe('m');
  });

  it('covers role-section filtering, no-role rows, provenance, elected/read-only actions, defaults, and virtual sources', () => {
    const openRights = vi.fn(),
      removeRole = vi.fn(),
      secondary = vi.fn();
    const roles = [
      {
        id: 'r1',
        name: '',
        description: '',
        assignment_mode: 'assigned',
        default_request_role: true,
        default_invite_role: true,
      },
      { id: 'r2', name: 'Second', description: 'Desc', assignment_mode: 'elected' },
      { id: 'empty', name: 'Empty' },
    ];
    const members = [
      membership({
        id: 'both',
        displayRoles: [
          { id: 'r1', name: '' },
          { id: 'r2', name: 'Second' },
        ],
        user: { id: 'u' },
        created_at: 1,
        partGroup: { id: 'p', name: 'Part' },
        baseGroup: { id: 'b', name: 'Base' },
        delegateRepresentedGroups: [
          { id: 'one', name: 'One', seatCount: 1 },
          { id: 'two', name: 'Two', seatCount: 3 },
        ],
      }),
      membership({ id: 'none' }),
    ];
    render(
      <MembershipsByRoleTables
        roles={roles}
        members={members}
        onOpenRightsDialog={openRights}
        onRemoveRole={removeRole}
        onSecondaryAction={secondary}
        secondaryActionLabel=""
        showProvenanceColumns
        showDelegateRepresentationColumn
        getVirtualSource={id => ({ id }) as any}
      />
    );
    expect(mocks.virtual).toHaveLength(3);
    const noRoleTable = mocks.data.at(-1);
    expect(noRoleTable.getRowId(members[1])).toBe('no-user-role-none');
    const columns = mocks.virtual[0].columns;
    const byId = (id: string) => columns.find((column: any) => column.id === id);
    const variants = [
      members[0],
      membership({ id: 'derived', source: 'derived', user: { id: 'u' } }),
      membership({ id: 'readonly', effectiveReadOnly: true, user: { id: 'u' } }),
      membership({ id: 'elected', elected: true, user: { id: 'u' } }),
    ];
    render(
      <>
        {columns.map((column: any) =>
          typeof column.header === 'function' ? column.header() : null
        )}
        {[
          'user',
          'roles',
          'delegateRepresents',
          'partGroup',
          'baseGroup',
          'joined',
          'actions',
        ].flatMap(id => variants.map(value => cell(byId(id), value)))}
        {cell(
          noRoleTable.columns.find((column: any) => column.id === 'roles'),
          members[1]
        )}
        {cell(
          noRoleTable.columns.find((column: any) => column.id === 'actions'),
          members[1]
        )}
      </>
    );
    render(
      <>
        {cell(
          mocks.virtual[1].columns.find((column: any) => column.id === 'roles'),
          members[0]
        )}
      </>
    );
    mocks.actions.forEach(action => action.onClick());
    expect(openRights).toHaveBeenCalled();
    expect(secondary).toHaveBeenCalled();
    expect(removeRole).toHaveBeenCalled();

    mocks.data.length = 0;
    mocks.virtual.length = 0;
    mocks.useFallbackTranslation = true;
    render(
      <MembershipsByRoleTables
        roles={roles}
        members={members}
        onOpenRightsDialog={openRights}
        onRemoveRole={removeRole}
        hideEmptyRoleSections
        countLabel="People"
        memberDescriptionFallback="Fallback"
        defaultRequestLabel="Request"
        defaultInviteLabel="Invite"
        noOtherRolesLabel="None"
        removeActionLabel="Remove"
        derivedRemoveTooltip="Derived"
        emptyStateLabel="Empty"
      />
    );
    expect(mocks.data.length).toBe(3);
  });

  it('covers pending-invitation defaults, user/role/date/action cells, base groups, empty and virtual states', () => {
    const withdraw = vi.fn();
    const direct = membership();
    const populated = membership({
      user: { id: 'u', first_name: 'Ada', last_name: 'L', avatar: 'a', handle: 'ada' },
      displayRoles: [{ id: 'r', name: '' }],
      created_at: 1,
      baseGroup: { id: 'b', name: 'Base' },
    });
    const view = render(
      <PendingInvitationsTable
        invitations={[direct, populated]}
        onWithdraw={withdraw}
        showBaseGroupColumn
      />
    );
    const props = mocks.data.at(-1);
    const columns = props.columns;
    const byId = (id: string) => columns.find((column: any) => column.id === id);
    expect(byId('user').accessorFn(direct)).toBe('components.memberRightsDialog.unknownUser');
    expect(byId('user').accessorFn(populated)).toBe('Ada L');
    expect(byId('createdAt').accessorFn(direct)).toBe('');
    render(
      <>
        {['user', 'role', 'baseGroup', 'createdAt', 'actions'].flatMap(id => [
          cell(byId(id), direct),
          cell(byId(id), populated),
        ])}
        {byId('actions').header()}
      </>
    );
    mocks.actions.forEach(action => action.onClick());
    expect(withdraw).toHaveBeenCalledWith('m', 'u');
    expect(props.getRowId(populated)).toBe('m');
    view.rerender(<PendingInvitationsTable invitations={[]} onWithdraw={withdraw} />);
    view.rerender(
      <PendingInvitationsTable
        invitations={[populated]}
        onWithdraw={withdraw}
        virtualSource={{ source: true } as any}
        title="Title"
        description="Desc"
        roleColumnLabel="Role"
        dateColumnLabel="Date"
        fallbackRoleLabel="Fallback"
        withdrawActionLabel="Withdraw"
      />
    );
    expect(mocks.virtual.at(-1).source).toEqual({ source: true });
  });

  it('covers pending-request defaults, user/role/date/action cells, base groups and virtual forwarding', () => {
    const approve = vi.fn(),
      reject = vi.fn(),
      preflight = vi.fn();
    const direct = membership();
    const populated = membership({
      user: { id: 'u', first_name: 'Ada', last_name: 'L', avatar: 'a', handle: 'ada' },
      displayRoles: [{ id: 'r', name: '' }],
      created_at: 1,
      baseGroup: { id: 'b', name: 'Base' },
    });
    const view = render(
      <PendingRequestsTable
        requests={[direct, populated]}
        onApprove={approve}
        onReject={reject}
        getApprovePreflightInput={preflight}
        showBaseGroupColumn
      />
    );
    const props = mocks.data.at(-1);
    const columns = props.columns;
    const byId = (id: string) => columns.find((column: any) => column.id === id);
    expect(byId('user').accessorFn(direct)).toBe('components.memberRightsDialog.unknownUser');
    expect(byId('user').accessorFn(populated)).toBe('Ada L');
    expect(byId('createdAt').accessorFn(direct)).toBe('');
    render(
      <>
        {['user', 'role', 'baseGroup', 'createdAt', 'actions'].flatMap(id => [
          cell(byId(id), direct),
          cell(byId(id), populated),
        ])}
        {byId('actions').header()}
      </>
    );
    expect(mocks.requestActions.at(-1)).toMatchObject({
      membership: populated,
      onApprove: approve,
      onReject: reject,
      getApprovePreflightInput: preflight,
    });
    view.rerender(<PendingRequestsTable requests={[]} onApprove={approve} onReject={reject} />);
    view.rerender(
      <PendingRequestsTable
        requests={[populated]}
        onApprove={approve}
        onReject={reject}
        virtualSource={{ source: true } as any}
        title="Title"
        description="Desc"
        roleColumnLabel="Role"
        dateColumnLabel="Date"
        fallbackRoleLabel="Fallback"
        primaryActionLabel="Accept"
        secondaryActionLabel="Reject"
      />
    );
    expect(mocks.virtual.at(-1).source).toEqual({ source: true });
  });
});
