/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blog: undefined as any,
  users: undefined as any,
  user: undefined as any,
  canManage: true,
  props: undefined as Record<string, any> | undefined,
  blogActions: {
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
  },
  groupActions: {
    removeActionRight: vi.fn(),
    assignActionRight: vi.fn(),
    createRole: vi.fn(),
    deleteRole: vi.fn(),
  },
  wait: vi.fn(async (value: unknown) => value),
  run: vi.fn(),
  reset: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  filterByRole: vi.fn((items: unknown[]) => items),
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({ blogWithManagement: mocks.blog }),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({ useBlogActions: () => mocks.blogActions }));
vi.mock('@/zero/groups/useGroupActions', () => ({ useGroupActions: () => mocks.groupActions }));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ allUsers: mocks.users }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: () => mocks.canManage }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.wait(value),
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    runActionWithSubmission: (...args: unknown[]) => mocks.run(...args),
    reset: mocks.reset,
  }),
}));
vi.mock('@/features/shared/ui/participation', () => ({
  filterParticipationsByRole: (...args: unknown[]) =>
    (mocks.filterByRole as (...values: unknown[]) => unknown)(...args),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('../BlogBloggersManagerView', () => ({
  BlogBloggersManagerView: (props: Record<string, unknown>) => {
    mocks.props = props;
    return <div data-testid="manager-view" />;
  },
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  EntityCell: ({ title, description, leading }: Record<string, unknown>) => (
    <div data-testid="entity-cell">
      <span>{title as string}</span>
      <span>{description as string}</span>
      {leading as ReactNode}
    </div>
  ),
}));
vi.mock('@/features/groups/ui/RoleTag', () => ({
  RoleTag: ({ roleId, roleName }: Record<string, unknown>) => (
    <span data-testid="role-tag" data-role-id={roleId as string}>
      {roleName as string}
    </span>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src }: { src: string }) => <span data-testid="avatar-image">{src}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}));
vi.mock('@/features/shared/ui/ui/native-select', () => ({
  NativeSelect: (props: Record<string, any>) => <select {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: Record<string, any>) => <button {...props}>{children}</button>,
}));

import { BlogBloggersManager } from '../BlogBloggersManager';

function blogger(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blogger-1',
    user_id: 'user-1',
    status: 'member',
    created_at: 1_700_000_000_000,
    user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
    role: { id: 'writer', name: 'Writer' },
    ...overrides,
  };
}

function populatedBlog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blog-1',
    roles: [
      { id: 'writer', name: 'Writer', action_rights: [] },
      {
        id: 'editor',
        name: 'Editor',
        action_rights: [{ id: 'right-1', resource: 'blogs', action: 'update' }],
      },
      { id: '', name: 'Invalid', action_rights: [] },
    ],
    bloggers: [
      blogger({ id: 'owner', user_id: 'owner', status: 'owner', user: { id: 'owner' } }),
      blogger({ id: 'active', user_id: 'active', status: 'member' }),
      blogger({ id: 'writer', user_id: 'writer', status: 'writer' }),
      blogger({ id: 'admin', user_id: 'admin', status: 'admin' }),
      blogger({ id: 'invited', user_id: 'invited', status: 'invited' }),
      blogger({ id: 'requested', user_id: 'requested', status: 'requested', created_at: null }),
      blogger({ id: 'unknown', user_id: null, status: null, user: null, role: null }),
    ],
    ...overrides,
  };
}

function rowCell(columns: any[], id: string, original: Record<string, unknown>) {
  return columns.find(column => column.id === id).cell({ row: { original } });
}

beforeEach(() => {
  mocks.blog = populatedBlog();
  mocks.users = [];
  mocks.user = { id: 'owner' };
  mocks.canManage = true;
  mocks.props = undefined;
  vi.clearAllMocks();
  mocks.wait.mockImplementation(async value => value);
  mocks.run.mockImplementation(async (action: () => Promise<void>, options: any) => {
    await action();
    options.onSuccess();
  });
  Object.values(mocks.blogActions).forEach(fn => fn.mockReturnValue(Promise.resolve()));
  Object.values(mocks.groupActions).forEach(fn => fn.mockReturnValue(Promise.resolve()));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BlogBloggersManager branch contract', () => {
  it('exposes loading fallbacks for absent blog, users, roles, auth, and management', () => {
    mocks.blog = undefined;
    mocks.users = undefined;
    mocks.user = undefined;
    mocks.canManage = false;
    render(<BlogBloggersManager blogId="blog-1" />);

    expect(mocks.props).toMatchObject({
      blog: undefined,
      bloggers: [],
      rolesData: { roles: [] },
      isLoading: true,
      isLoadingUsers: true,
      currentUserId: undefined,
      canManageBloggers: false,
      filteredUsers: undefined,
    });
  });

  it('filters invite candidates through every identity field and existing membership', () => {
    mocks.users = [
      null,
      {},
      { id: 'active', first_name: 'Existing' },
      { id: 'first', first_name: 'Needle' },
      { id: 'last', last_name: 'Needle' },
      { id: 'handle', handle: 'needle' },
      { id: 'email', email: 'needle@example.test' },
      { id: 'miss', first_name: 'Other' },
    ];
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    act(() => mocks.props?.setInviteSearchQuery('needle'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);

    expect(mocks.props?.filteredUsers.map((user: any) => user.id)).toEqual([
      'first',
      'last',
      'handle',
      'email',
    ]);
    expect(mocks.props?.existingBloggerIds).not.toContain(null);
  });

  it('toggles invite selections and filters invalid selected role ids', () => {
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    act(() => mocks.props?.toggleUserSelection('new-user'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(mocks.props?.selectedUsers).toEqual(['new-user']);
    act(() => mocks.props?.toggleUserSelection('new-user'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(mocks.props?.selectedUsers).toEqual([]);

    act(() => mocks.props?.setSelectedRoleIds(['writer', 'missing']));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(mocks.props?.selectedRoleIds).toEqual(['writer']);
  });

  it('skips empty invitations and completes selected multi-user invitations', async () => {
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleInviteBloggers());
    expect(mocks.run).not.toHaveBeenCalled();

    act(() => {
      mocks.props?.setSelectedUsers(['one', 'two']);
      mocks.props?.setInviteSearchQuery('query');
      mocks.props?.setInviteDialogOpen(true);
    });
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleInviteBloggers());
    await waitFor(() => expect(mocks.blogActions.createEntry).toHaveBeenCalledTimes(2));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(mocks.props).toMatchObject({
      selectedUsers: [],
      inviteSearchQuery: '',
      inviteDialogOpen: false,
      isInviting: false,
    });
    expect(mocks.reset).toHaveBeenCalled();
  });

  it('reports missing writer roles and submission failures', async () => {
    mocks.blog = populatedBlog({ roles: [] });
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    act(() => mocks.props?.setSelectedUsers(['one']));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleInviteBloggers());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());

    mocks.blog = populatedBlog();
    mocks.run.mockRejectedValueOnce(new Error('submission failed'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    act(() => mocks.props?.setSelectedUsers(['two']));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleInviteBloggers());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(2));
  });

  it('updates and removes bloggers with success and error handling', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleUpdateRole('blogger', 'editor'));
    await act(async () => mocks.props?.handleRemoveBlogger('blogger'));
    expect(mocks.blogActions.updateEntry).toHaveBeenCalledWith({
      id: 'blogger',
      role_id: 'editor',
    });
    expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('blogger');

    mocks.wait
      .mockRejectedValueOnce(new Error('update'))
      .mockRejectedValueOnce(new Error('delete'));
    await act(async () => mocks.props?.handleUpdateRole('blogger', 'writer'));
    await act(async () => mocks.props?.handleRemoveBlogger('blogger'));
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('adds, removes, skips, and reports failing role permissions', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleToggleActionRight('editor', 'blogs', 'update', true));
    expect(mocks.groupActions.removeActionRight).toHaveBeenCalledWith({ id: 'right-1' });

    await act(async () => mocks.props?.handleToggleActionRight('missing', 'blogs', 'update', true));
    await act(async () => mocks.props?.handleToggleActionRight('editor', 'blogs', 'delete', true));
    expect(mocks.groupActions.removeActionRight).toHaveBeenCalledTimes(1);

    await act(async () => mocks.props?.handleToggleActionRight('writer', 'blogs', 'create', false));
    expect(mocks.groupActions.assignActionRight).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'writer', blog_id: 'blog-1' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(4);

    mocks.wait.mockRejectedValueOnce(new Error('permission'));
    await act(async () => mocks.props?.handleToggleActionRight('writer', 'blogs', 'create', false));
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('validates, creates, and reports failing custom roles', async () => {
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleCreateRole());
    expect(mocks.toastError).toHaveBeenCalled();

    act(() => {
      mocks.props?.setNewRoleName(' Editor ');
      mocks.props?.setNewRoleDescription('Can edit');
      mocks.props?.setAddRoleDialogOpen(true);
    });
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleCreateRole());
    expect(mocks.groupActions.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ name: ' Editor ', description: 'Can edit' })
    );
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(mocks.props).toMatchObject({
      newRoleName: '',
      newRoleDescription: '',
      addRoleDialogOpen: false,
    });

    act(() => mocks.props?.setNewRoleName('Fail'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    mocks.wait.mockRejectedValueOnce(new Error('create'));
    await act(async () => mocks.props?.handleCreateRole());
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('deletes roles with success and failure notifications', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);
    await act(async () => mocks.props?.handleDeleteRole('editor'));
    expect(mocks.toastSuccess).toHaveBeenCalled();
    mocks.wait.mockRejectedValueOnce(new Error('delete-role'));
    await act(async () => mocks.props?.handleDeleteRole('editor'));
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('filters bloggers through names, handles, emails, roles, and statuses', () => {
    mocks.blog = populatedBlog({
      bloggers: [
        blogger({ id: 'first', status: 'owner', user: { id: '1', first_name: 'Needle' } }),
        blogger({ id: 'handle', status: 'admin', user: { id: '2', handle: 'needle' } }),
        blogger({ id: 'email', status: 'writer', user: { id: '3', email: 'needle@test' } }),
        blogger({ id: 'miss', status: 'other', user: null }),
        blogger({ id: 'invited', status: 'invited', user: { id: '4', last_name: 'Needle' } }),
        blogger({ id: 'requested', status: 'requested', user: { id: '5', first_name: 'Needle' } }),
      ],
    });
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    act(() => mocks.props?.setSearchQuery('needle'));
    view.rerender(<BlogBloggersManager blogId="blog-1" />);

    expect(mocks.props?.filteredBloggers.map((item: any) => item.id)).toEqual([
      'first',
      'handle',
      'email',
      'invited',
      'requested',
    ]);
    expect(mocks.props?.activeBloggers.map((item: any) => item.id)).toEqual([
      'first',
      'handle',
      'email',
    ]);
  });

  it('renders all column fallbacks and invokes row actions', async () => {
    const view = render(<BlogBloggersManager blogId="blog-1" />);
    const props = mocks.props!;
    const cases = [
      blogger({ user: null, role: null, created_at: null }),
      blogger({ user: { id: 'first', first_name: 'Ada', avatar: 'ada.png', handle: 'ada' } }),
      blogger({ user: { id: 'last', last_name: 'Lovelace', email: 'last@test' } }),
      blogger({ user: { id: 'unknown' }, role: { id: null, name: null } }),
    ];

    for (const original of cases) {
      const rendered = render(
        <>
          {rowCell(props.invitedColumns, 'user', original)}
          {rowCell(props.invitedColumns, 'role', original)}
          {rowCell(props.invitedColumns, 'invited', original)}
          {rowCell(props.requestedColumns, 'user', original)}
          {rowCell(props.requestedColumns, 'role', original)}
          {rowCell(props.requestedColumns, 'requested', original)}
          {rowCell(props.activeColumns, 'user', original)}
          {rowCell(props.activeColumns, 'joined', original)}
        </>
      );
      expect(rendered.container.textContent).toBeTruthy();
      rendered.unmount();
    }

    const activeWithoutRole = blogger({
      id: 'select-row',
      user: { id: 'other', first_name: 'Select' },
      role: null,
    });
    const activeView = render(
      <>
        {rowCell(props.activeColumns, 'role', activeWithoutRole)}
        {rowCell(props.activeColumns, 'actions', activeWithoutRole)}
      </>
    );
    expect(
      screen.getByRole('option', { name: 'generated.inline.0255_select_role_04fa02bb' })
    ).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'editor' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mocks.blogActions.updateEntry).toHaveBeenCalled());
    activeView.unmount();

    const invitedAction = render(
      <>{rowCell(props.invitedColumns, 'actions', blogger({ id: 'invited-action' }))}</>
    );
    fireEvent.click(invitedAction.getByRole('button'));
    await waitFor(() =>
      expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('invited-action')
    );
    invitedAction.unmount();

    const activeWithRole = render(
      <>
        {rowCell(
          props.activeColumns,
          'role',
          blogger({ user: { id: 'other' }, role: { id: 'writer', name: 'Writer' } })
        )}
      </>
    );
    expect(
      activeWithRole.queryByRole('option', { name: 'generated.inline.0255_select_role_04fa02bb' })
    ).toBeNull();
    activeWithRole.unmount();

    const self = blogger({ user: { id: 'owner' } });
    expect(rowCell(props.activeColumns, 'actions', self)).toBeNull();
    const selfRole = render(<>{rowCell(props.activeColumns, 'role', self)}</>);
    expect(selfRole.getByTestId('role-tag')).toBeTruthy();
    selfRole.unmount();

    mocks.canManage = false;
    view.rerender(<BlogBloggersManager blogId="blog-1" />);
    expect(rowCell(mocks.props!.invitedColumns, 'actions', blogger())).toBeNull();
    expect(rowCell(mocks.props!.requestedColumns, 'actions', blogger())).toBeNull();
    const unmanagedRole = render(
      <>
        {rowCell(
          mocks.props!.activeColumns,
          'role',
          blogger({ user: { id: 'other' }, role: { id: null, name: null } })
        )}
      </>
    );
    expect(unmanagedRole.getByTestId('role-tag')).toBeTruthy();
    expect(unmanagedRole.getByText('generated.inline.0034_no_role_2e54b8e7')).toBeTruthy();
  });

  it('accepts and declines requested rows when management is allowed', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);
    render(<>{rowCell(mocks.props!.requestedColumns, 'actions', blogger({ id: 'request' }))}</>);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);
    await waitFor(() => {
      expect(mocks.blogActions.updateEntry).toHaveBeenCalledWith({
        id: 'request',
        status: 'member',
      });
      expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('request');
    });
  });
});
