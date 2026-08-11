/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlogBloggersManager } from '../BlogBloggersManager';

const mocks = vi.hoisted(() => ({
  blogActions: {
    createEntry: vi.fn(),
    deleteEntry: vi.fn(),
    updateEntry: vi.fn(),
  },
  capturedProps: {} as Record<string, any>,
  groupActions: {
    assignActionRight: vi.fn(),
    createRole: vi.fn(),
    deleteRole: vi.fn(),
    removeActionRight: vi.fn(),
  },
  waitForClientApply: vi.fn(async () => undefined),
  canManage: true,
}));

vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => mocks.blogActions,
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => mocks.groupActions,
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({
    blogWithManagement: {
      bloggers: [
        {
          id: 'invited-1',
          role: { id: 'writer', name: 'Writer' },
          status: 'invited',
          user: { id: 'user-invited', first_name: 'Invited', last_name: 'Writer' },
          user_id: 'user-invited',
        },
        {
          id: 'active-1',
          role: { id: 'writer', name: 'Writer' },
          status: 'member',
          user: { id: 'user-active', first_name: 'Active', last_name: 'Writer' },
          user_id: 'user-active',
        },
        {
          id: 'requested-1',
          role: { id: 'writer', name: 'Writer' },
          status: 'requested',
          user: { id: 'user-requested', first_name: 'Requested', last_name: 'Writer' },
          user_id: 'user-requested',
        },
      ],
      id: 'blog-1',
      roles: [
        { action_rights: [], id: 'writer', name: 'Writer' },
        { action_rights: [], id: 'editor', name: 'Editor' },
      ],
      title: 'Covered blog',
    },
  }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ allUsers: [] }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ can: () => mocks.canManage }),
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    error: null,
    isActive: false,
    progressSteps: [],
    reset: vi.fn(),
    retry: vi.fn(),
    runActionWithSubmission: vi.fn(),
    status: 'idle',
  }),
}));

vi.mock('@/features/shared/ui/participation', () => ({
  filterParticipationsByRole: (participations: unknown[]) => participations,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('../BlogBloggersManagerView', () => ({
  BlogBloggersManagerView: (props: Record<string, unknown>) => {
    Object.assign(mocks.capturedProps, props);
    return <div data-testid="manager-view" />;
  },
}));

vi.mock('@/features/groups/ui/RoleTag', () => ({
  RoleTag: ({ roleName }: { roleName: string }) => <span>{roleName}</span>,
}));

vi.mock('@/features/shared/ui/data-table', () => ({
  EntityCell: ({ title }: { title: string }) => <span>{title}</span>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.canManage = true;
});

function renderCell(columns: any[], id: string, original: Record<string, unknown>): ReactNode {
  const column = columns.find(columnDefinition => columnDefinition.id === id);
  return column.cell({ row: { original } });
}

describe('BlogBloggersManager controller actions', () => {
  it('cancels invitations and updates or removes active bloggers through row-specific actions', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);

    const invited = mocks.capturedProps.invitedBloggers[0];
    const invitedAction = renderCell(mocks.capturedProps.invitedColumns, 'actions', invited);
    const invitedView = render(<>{invitedAction}</>);
    const cancel = screen.getByRole('button', { name: 'generated.inline.0065_cancel_77dfd213' });
    expect(cancel.getAttribute('data-action-id')).toBe('blogs.bloggers.invitation.cancel');
    fireEvent.click(cancel);
    await waitFor(() => expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('invited-1'));
    invitedView.unmount();

    const active = mocks.capturedProps.activeBloggers[0];
    const activeRole = renderCell(mocks.capturedProps.activeColumns, 'role', active);
    const activeAction = renderCell(mocks.capturedProps.activeColumns, 'actions', active);
    const activeView = render(
      <>
        {activeRole}
        {activeAction}
      </>
    );

    const roleSelect = screen.getByRole('combobox');
    expect(roleSelect.getAttribute('data-action-id')).toBe('blogs.bloggers.active.update-role');
    fireEvent.change(roleSelect, { target: { value: 'editor' } });
    await waitFor(() =>
      expect(mocks.blogActions.updateEntry).toHaveBeenCalledWith({
        id: 'active-1',
        role_id: 'editor',
      })
    );

    const remove = screen.getByRole('button', { name: 'generated.inline.0096_remove_e963907d' });
    expect(remove.getAttribute('data-action-id')).toBe('blogs.bloggers.active.remove');
    fireEvent.click(remove);
    await waitFor(() => expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('active-1'));
    activeView.unmount();
  });

  it('accepts or declines a blogger request with explicit row actions', async () => {
    render(<BlogBloggersManager blogId="blog-1" />);
    const requested = mocks.capturedProps.requestedBloggers[0];
    render(<>{renderCell(mocks.capturedProps.requestedColumns, 'actions', requested)}</>);

    const accept = screen.getByRole('button', { name: 'generated.inline.0121_accept_bb54db51' });
    const decline = screen.getByRole('button', {
      name: 'generated.inline.0122_decline_b59cf9ed',
    });
    expect(accept.getAttribute('data-action-id')).toBe('blogs.bloggers.request.accept');
    expect(decline.getAttribute('data-action-id')).toBe('blogs.bloggers.request.decline');

    fireEvent.click(accept);
    await waitFor(() =>
      expect(mocks.blogActions.updateEntry).toHaveBeenCalledWith({
        id: 'requested-1',
        status: 'member',
      })
    );
    fireEvent.click(decline);
    await waitFor(() => expect(mocks.blogActions.deleteEntry).toHaveBeenCalledWith('requested-1'));
  });

  it('hides row mutations without management rights and for the current user', () => {
    mocks.canManage = false;
    render(<BlogBloggersManager blogId="blog-1" />);
    const invited = mocks.capturedProps.invitedBloggers[0];
    expect(renderCell(mocks.capturedProps.invitedColumns, 'actions', invited)).toBeNull();

    cleanup();
    mocks.canManage = true;
    render(<BlogBloggersManager blogId="blog-1" />);
    const active = {
      ...mocks.capturedProps.activeBloggers[0],
      user: { id: 'owner-1' },
    };
    expect(renderCell(mocks.capturedProps.activeColumns, 'actions', active)).toBeNull();
  });
});
