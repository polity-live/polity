/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captures = vi.hoisted(() => ({ dataRows: [] as string[] }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/rbac/constants', () => ({
  BLOG_ACTION_RIGHTS: [{ resource: 'blogs', action: 'manage', label: 'Manage blogs' }],
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: ({ data, getRowId, emptyTitle }: any) => (
    <div data-empty-title={emptyTitle}>
      {(data ?? []).map((row: any) => {
        const id = getRowId(row);
        captures.dataRows.push(id);
        return <span key={id}>{id}</span>;
      })}
    </div>
  ),
  MatrixCheckbox: ({ onCheckedChange, ...props }: any) => (
    <input type="checkbox" onChange={() => onCheckedChange()} {...props} />
  ),
  MatrixTable: ({ children }: any) => <table>{children}</table>,
  MatrixTableBody: ({ children }: any) => <tbody>{children}</tbody>,
  MatrixTableCell: ({ children }: any) => <td>{children}</td>,
  MatrixTableHead: ({ children }: any) => <th>{children}</th>,
  MatrixTableHeader: ({ children }: any) => <thead>{children}</thead>,
  MatrixTableRow: ({ children }: any) => <tr>{children}</tr>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: any) => (
    <div>
      <button type="button" onClick={() => onValueChange('roles')}>
        change-tab
      </button>
      {children}
    </div>
  ),
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  SearchField: ({ onValueChange, value, ...props }: any) => (
    <input value={value} onChange={event => onValueChange(event.target.value)} {...props} />
  ),
  ValidatedField: ({ onValueChange, value, label }: any) => (
    <label>
      {label}
      <input value={value} onChange={event => onValueChange(event.target.value)} />
    </label>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <span>{src}</span>,
}));
vi.mock('@/features/groups/ui/RoleTag', () => ({
  RoleTag: ({ roleName }: any) => <span>{roleName}</span>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" onClick={() => onOpenChange(true)}>
        open-dialog
      </button>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => children,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: ({ onBack, onRetry, target, preview }: any) => (
    <div>
      <span>{preview.title}</span>
      {preview.people.map((person: any) => (
        <span key={person.id}>{person.name}</span>
      ))}
      <button type="button" onClick={onBack}>
        submission-back
      </button>
      <button type="button" onClick={onRetry}>
        submission-retry
      </button>
      <button type="button" onClick={target.onClick}>
        submission-target
      </button>
    </div>
  ),
}));
vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: ({ onSelectedRoleIdsChange }: any) => (
    <button type="button" onClick={() => onSelectedRoleIdsChange(['writer'])}>
      role-filter
    </button>
  ),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ onValueChange, value, ...props }: any) => (
    <input value={value} onChange={event => onValueChange(event.target.value)} {...props} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));

import {
  BlogBloggersManagerView,
  type BlogBloggersManagerViewProps,
} from '../BlogBloggersManagerView';

function props(
  overrides: Partial<BlogBloggersManagerViewProps> = {}
): BlogBloggersManagerViewProps {
  const fn = () => vi.fn();
  return {
    blogId: 'blog',
    blogActions: {},
    groupActions: {},
    blogWithManagement: {},
    allUsers: [],
    actionSubmission: {
      isActive: false,
      status: 'idle',
      progressSteps: [],
      error: null,
      reset: fn(),
      retry: fn(),
    } as any,
    usersData: [],
    searchQuery: '',
    setSearchQuery: fn(),
    selectedRoleIds: [],
    setSelectedRoleIds: fn(),
    inviteSearchQuery: '',
    setInviteSearchQuery: fn(),
    selectedUsers: [],
    setSelectedUsers: fn(),
    inviteDialogOpen: false,
    setInviteDialogOpen: fn(),
    isInviting: false,
    setIsInviting: fn(),
    activeTab: 'bloggers',
    setActiveTab: fn(),
    newRoleName: '',
    setNewRoleName: fn(),
    newRoleDescription: '',
    setNewRoleDescription: fn(),
    addRoleDialogOpen: false,
    setAddRoleDialogOpen: fn(),
    blog: { id: 'blog', title: 'Blog' },
    bloggers: [],
    rolesData: { roles: [] },
    isLoading: false,
    isLoadingUsers: false,
    error: null,
    user: { id: 'owner' },
    currentUserId: 'owner',
    can: fn(),
    canManageBloggers: false,
    existingBloggerIds: [],
    filteredUsers: [],
    toggleUserSelection: fn(),
    handleInviteBloggers: fn(),
    handleUpdateRole: fn(),
    handleRemoveBlogger: fn(),
    handleToggleActionRight: fn(),
    handleCreateRole: fn(),
    handleDeleteRole: fn(),
    filteredBloggers: [],
    activeBloggers: [],
    invitedBloggers: [],
    requestedBloggers: [],
    getCreatedAt: fn(),
    invitedColumns: [],
    activeColumns: [],
    requestedColumns: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  captures.dataRows = [];
});

afterEach(cleanup);

describe('BlogBloggersManagerView exhaustive branch campaign A10', () => {
  it('renders loading and both missing-blog guards and drives the back handler', () => {
    const view = render(<BlogBloggersManagerView {...props({ isLoading: true })} />);
    expect(screen.getByTestId('page-skeleton')).toBeTruthy();
    view.rerender(<BlogBloggersManagerView {...props({ blog: null })} />);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'generated.inline.0240_go_back_f03e2d07' }));
    expect(back).toHaveBeenCalled();
    view.rerender(<BlogBloggersManagerView {...props({ error: new Error('failed') })} />);
    expect(screen.getByText('generated.inline.0239_blog_not_found_70b91de2')).toBeTruthy();
    back.mockRestore();
  });

  it('covers active submission, nullable users, title fallback, role filter absence and no management', () => {
    const actionSubmission = {
      isActive: true,
      status: 'loading',
      progressSteps: [],
      error: null,
      reset: vi.fn(),
      retry: vi.fn(),
    } as any;
    const manager = props({
      actionSubmission,
      activeTab: 'roles',
      allUsers: null,
      blog: { id: 'blog', title: '' },
      rolesData: { roles: [] },
      canManageBloggers: true,
    });
    const view = render(<BlogBloggersManagerView {...manager} />);
    expect(screen.queryByText('role-filter')).toBeNull();
    fireEvent.click(screen.getByText('submission-back'));
    fireEvent.click(screen.getByText('submission-retry'));
    fireEvent.click(screen.getByText('submission-target'));
    expect(actionSubmission.reset).toHaveBeenCalledTimes(2);
    expect(actionSubmission.retry).toHaveBeenCalled();
    expect(
      screen.getByText(
        'generated.inline.0134_no_roles_created_yet_click_add_role_to_create_5594310d'
      )
    ).toBeTruthy();
    view.rerender(<BlogBloggersManagerView {...props({ ...manager, canManageBloggers: false })} />);
    expect(document.querySelector('[data-action-id="blogs.bloggers.invite.open"]')).toBeNull();
  });

  it('covers selectable identity fallbacks, loading users, sections, empty labels and invite actions', () => {
    const manager = props({
      allUsers: [
        { id: 'first', first_name: 'First', last_name: null, avatar: null },
        { id: 'last', first_name: null, last_name: 'Last', avatar: null },
        { id: 'unknown', first_name: null, last_name: null, avatar: null },
      ],
      selectedUsers: ['first', 'last', 'unknown'],
      filteredUsers: [
        { id: 'first', first_name: 'First', last_name: null, avatar: null, handle: 'handle' },
        { id: 'last', first_name: null, last_name: 'Last', avatar: '', email: 'mail@example.com' },
        { id: 'unknown', first_name: null, last_name: null, avatar: null },
        { id: 'unselected', first_name: 'Not', last_name: 'Selected', avatar: null },
      ],
      canManageBloggers: true,
      rolesData: { roles: [{ id: 'writer', name: 'Writer', description: '', action_rights: [] }] },
      invitedBloggers: [{ id: 'invited' }],
      activeBloggers: [{ id: 'active' }],
      requestedBloggers: [{ id: 'requested' }],
      isLoadingUsers: false,
    });
    const view = render(<BlogBloggersManagerView {...manager} />);
    expect(screen.getAllByText('common.unknown').length).toBeGreaterThan(0);
    expect(captures.dataRows).toEqual(expect.arrayContaining(['invited', 'active', 'requested']));
    fireEvent.click(screen.getByText('role-filter'));
    expect(manager.setSelectedRoleIds).toHaveBeenCalledWith(['writer']);
    fireEvent.click(
      document.querySelector('[data-action-id="blogs.bloggers.invite.select-user"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="blogs.bloggers.invite.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="blogs.bloggers.invite.submit"]')!);
    expect(manager.toggleUserSelection).toHaveBeenCalled();
    expect(manager.handleInviteBloggers).toHaveBeenCalled();

    view.rerender(<BlogBloggersManagerView {...props({ ...manager, isLoadingUsers: true })} />);
    expect(screen.getByTestId('section-skeleton')).toBeTruthy();
  });

  it('covers role descriptions, owner/deletable roles, permission membership alternatives and handlers', () => {
    const manager = props({
      activeTab: 'roles',
      canManageBloggers: true,
      bloggers: [{ id: 'filtered-out' }],
      rolesData: {
        roles: [
          { id: 'owner', name: 'Owner', description: 'Protected', action_rights: undefined },
          {
            id: 'writer',
            name: '',
            description: '',
            action_rights: [
              { resource: 'other', action: 'manage' },
              { resource: 'blogs', action: 'manage' },
            ],
          },
        ],
      },
    });
    const { container } = render(<BlogBloggersManagerView {...manager} />);
    expect(screen.getByText('Protected')).toBeTruthy();
    const deletes = container.querySelectorAll('[data-action-id="blogs.bloggers.role.delete"]');
    expect(deletes).toHaveLength(1);
    fireEvent.click(deletes[0]);
    fireEvent.click(
      container.querySelector('[data-action-id="blogs.bloggers.role.cancel-create"]')!
    );
    expect(manager.handleDeleteRole).toHaveBeenCalledWith('writer');
    const permissions = container.querySelectorAll(
      '[data-action-id="blogs.bloggers.permission.toggle"]'
    );
    permissions.forEach(permission => fireEvent.click(permission));
    expect(manager.handleToggleActionRight).toHaveBeenCalledWith(
      'owner',
      'blogs',
      'manage',
      undefined
    );
    expect(manager.handleToggleActionRight).toHaveBeenCalledWith('writer', 'blogs', 'manage', true);
  });
});
