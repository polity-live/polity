/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BlogBloggersManagerView,
  type BlogBloggersManagerViewProps,
} from '../BlogBloggersManagerView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/ui/tabs', async () => {
  const { createContext, useContext } = await import('react');
  const TabsContext = createContext<(value: string) => void>(() => undefined);
  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => <TabsContext.Provider value={onValueChange}>{children}</TabsContext.Provider>,
    TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
      'data-action-id'?: string;
    }) => {
      const onValueChange = useContext(TabsContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/features/shared/ui/ui/dialog', async () => {
  const { cloneElement, createContext, isValidElement, useContext } = await import('react');
  const DialogContext = createContext<(open: boolean) => void>(() => undefined);
  return {
    Dialog: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => <DialogContext.Provider value={onOpenChange}>{children}</DialogContext.Provider>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
    DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogTrigger: ({ children }: { children: ReactNode }) => {
      const onOpenChange = useContext(DialogContext);
      return isValidElement(children)
        ? cloneElement(children, { onClick: () => onOpenChange(true) } as never)
        : children;
    },
  };
});

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: (props: { value: string; placeholder?: string }) => <input {...props} />,
  CommandItem: ({
    children,
    onSelect,
    ...props
  }: {
    children: ReactNode;
    onSelect: () => void;
    'data-action-id'?: string;
  }) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: () => <div data-testid="data-table" />,
  MatrixCheckbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange: () => void;
    'data-action-id'?: string;
    'aria-label'?: string;
  }) => <input type="checkbox" checked={checked} onChange={() => onCheckedChange()} {...props} />,
  MatrixTable: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  MatrixTableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  MatrixTableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  MatrixTableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  MatrixTableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  MatrixTableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/form', () => ({
  SearchField: (props: { value: string; placeholder?: string }) => <input {...props} />,
  ValidatedField: ({ label, value }: { label: string; value: string }) => (
    <label>
      {label}
      <input value={value} readOnly />
    </label>
  ),
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: () => null,
}));

vi.mock('@/features/shared/ui/participation', () => ({
  ParticipationRoleFilterBar: () => <div data-testid="role-filter" />,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
  SectionSkeleton: () => <div data-testid="section-skeleton" />,
}));

vi.mock('@/features/groups/ui/RoleTag', () => ({
  RoleTag: ({ roleName }: { roleName: string }) => <span>{roleName}</span>,
}));

afterEach(cleanup);

function managerProps(
  overrides: Partial<BlogBloggersManagerViewProps> = {}
): BlogBloggersManagerViewProps {
  const role = { id: 'writer', name: 'Writer', description: '', action_rights: [] };
  return {
    actionSubmission: {
      error: null,
      isActive: false,
      progressSteps: [],
      reset: vi.fn(),
      retry: vi.fn(),
      runActionWithSubmission: vi.fn(),
      status: 'idle',
    } as unknown as BlogBloggersManagerViewProps['actionSubmission'],
    activeBloggers: [],
    activeColumns: [],
    activeTab: 'bloggers',
    addRoleDialogOpen: false,
    allUsers: [{ id: 'user-2', first_name: 'Ada', last_name: 'Lovelace' }],
    blog: { id: 'blog-1', title: 'Covered blog' },
    blogActions: {},
    blogId: 'blog-1',
    blogWithManagement: {},
    bloggers: [],
    can: vi.fn(),
    canManageBloggers: true,
    currentUserId: 'owner-1',
    error: null,
    existingBloggerIds: [],
    filteredBloggers: [],
    filteredUsers: [{ id: 'user-2', first_name: 'Ada', last_name: 'Lovelace' }],
    getCreatedAt: vi.fn(),
    groupActions: {},
    handleCreateRole: vi.fn(),
    handleDeleteRole: vi.fn(),
    handleInviteBloggers: vi.fn(),
    handleRemoveBlogger: vi.fn(),
    handleToggleActionRight: vi.fn(),
    handleUpdateRole: vi.fn(),
    invitedBloggers: [],
    invitedColumns: [],
    inviteDialogOpen: false,
    inviteSearchQuery: '',
    isInviting: false,
    isLoading: false,
    isLoadingUsers: false,
    newRoleDescription: '',
    newRoleName: 'Editor',
    requestedBloggers: [],
    requestedColumns: [],
    rolesData: { roles: [role] },
    searchQuery: '',
    selectedRoleIds: [],
    selectedUsers: [],
    setActiveTab: vi.fn(),
    setAddRoleDialogOpen: vi.fn(),
    setInviteDialogOpen: vi.fn(),
    setInviteSearchQuery: vi.fn(),
    setIsInviting: vi.fn(),
    setNewRoleDescription: vi.fn(),
    setNewRoleName: vi.fn(),
    setSearchQuery: vi.fn(),
    setSelectedRoleIds: vi.fn(),
    setSelectedUsers: vi.fn(),
    toggleUserSelection: vi.fn(),
    user: { id: 'owner-1' },
    usersData: [],
    ...overrides,
  };
}

describe('BlogBloggersManagerView actions', () => {
  it('navigates tabs and drives invite and role actions through stable controls', () => {
    const props = managerProps();
    const { container } = render(<BlogBloggersManagerView {...props} />);

    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.tab.roles"]')!);
    expect(props.setActiveTab).toHaveBeenCalledWith('roles');

    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.invite.open"]')!);
    expect(props.setInviteDialogOpen).toHaveBeenCalledWith(true);
    fireEvent.click(
      container.querySelector('[data-action-id="blogs.bloggers.invite.select-user"]')!
    );
    expect(props.toggleUserSelection).toHaveBeenCalledWith('user-2');
    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.invite.cancel"]')!);
    expect(props.setInviteDialogOpen).toHaveBeenCalledWith(false);

    const invite = container.querySelector(
      '[data-action-id="blogs.bloggers.invite.submit"]'
    ) as HTMLButtonElement;
    expect(invite.disabled).toBe(true);

    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.role.open-create"]')!);
    expect(props.setAddRoleDialogOpen).toHaveBeenCalledWith(true);
    fireEvent.click(
      container.querySelector('[data-action-id="blogs.bloggers.role.cancel-create"]')!
    );
    expect(props.setAddRoleDialogOpen).toHaveBeenCalledWith(false);
    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.role.create"]')!);
    expect(props.handleCreateRole).toHaveBeenCalledOnce();

    fireEvent.click(container.querySelector('[data-action-id="blogs.bloggers.role.delete"]')!);
    expect(props.handleDeleteRole).toHaveBeenCalledWith('writer');

    const permission = container.querySelector(
      '[data-action-id="blogs.bloggers.permission.toggle"]'
    )!;
    fireEvent.click(permission);
    expect(props.handleToggleActionRight).toHaveBeenCalled();
  });

  it('invites a selected user and exposes a semantic back action for missing blogs', () => {
    const handleInviteBloggers = vi.fn();
    const selected = render(
      <BlogBloggersManagerView
        {...managerProps({ handleInviteBloggers, selectedUsers: ['user-2'] })}
      />
    );
    const invite = selected.container.querySelector(
      '[data-action-id="blogs.bloggers.invite.submit"]'
    ) as HTMLButtonElement;
    expect(invite.disabled).toBe(false);
    fireEvent.click(invite);
    expect(handleInviteBloggers).toHaveBeenCalledOnce();

    selected.unmount();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(
      <BlogBloggersManagerView {...managerProps({ blog: null, error: new Error('missing') })} />
    );
    const backButton = screen.getByRole('button', {
      name: 'generated.inline.0240_go_back_f03e2d07',
    });
    expect(backButton.getAttribute('data-action-id')).toBe('blogs.bloggers.back');
    fireEvent.click(backButton);
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it('uses a stable fallback label for unnamed roles', () => {
    const props = managerProps({
      rolesData: {
        roles: [{ id: 'unnamed', name: '', description: '', action_rights: [] }],
      },
    });
    const { container } = render(<BlogBloggersManagerView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'features.blogs.bloggers.deleteRole' }));
    expect(props.handleDeleteRole).toHaveBeenCalledWith('unnamed');

    const permission = container.querySelector(
      '[data-action-id="blogs.bloggers.permission.toggle"]'
    ) as HTMLInputElement;
    expect(permission.getAttribute('aria-label')).toContain('Role');
    fireEvent.click(permission);
    expect(props.handleToggleActionRight).toHaveBeenCalledWith(
      'unnamed',
      expect.any(String),
      expect.any(String),
      false
    );
  });
});
