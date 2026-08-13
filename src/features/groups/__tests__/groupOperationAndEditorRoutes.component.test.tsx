/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');

  return {
    ...actual,
    useLocation: () => ({ hash: '' }),
  };
});

const usePermissionsMock = vi.fn();
const useAuthMock = vi.fn();
const useUserStateMock = vi.fn();
const useGroupOperationPageMock = vi.fn();

vi.mock('@/zero/rbac', () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
}));

vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => useUserStateMock(),
}));

vi.mock('@/features/groups/hooks/useGroupOperationPage', () => ({
  useGroupOperationPage: (...args: unknown[]) => useGroupOperationPageMock(...args),
}));

vi.mock('@/features/documents/ui/GroupDocumentsList', () => ({
  GroupDocumentsList: ({ canManageDocuments }: { canManageDocuments: boolean }) => (
    <div
      data-testid="group-documents-list"
      data-can-manage-documents={String(canManageDocuments)}
    />
  ),
}));

vi.mock('@/features/editor/ui/EditorView', () => ({
  EditorView: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="editor-view" data-read-only={String(Boolean(readOnly))} />
  ),
}));

vi.mock('@/features/network/ui/LinksSection', () => ({
  LinksSection: ({ addLinkButton }: { addLinkButton: ReactNode }) => (
    <div data-testid="links-section" data-has-add-link={String(Boolean(addLinkButton))} />
  ),
}));

vi.mock('@/features/groups/ui/PaymentsSection', () => ({
  PaymentsSection: ({ canManagePayments }: { canManagePayments?: boolean }) => (
    <div
      data-testid="payments-section"
      data-can-manage-payments={String(Boolean(canManagePayments))}
    />
  ),
}));

vi.mock('@/features/groups/ui/TodosSection', () => ({
  TodosSection: ({ canManageTodos }: { canManageTodos?: boolean }) => (
    <div data-testid="todos-section" data-can-manage-todos={String(Boolean(canManageTodos))} />
  ),
}));

vi.mock('@/features/network/ui/AddLinkDialog', () => ({
  AddLinkDialog: () => <div data-testid="add-link-dialog" />,
}));

vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied" />,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

import { Route as EditorLayoutRoute } from '../../../routes/_authed/group/$id/editor';
import { Route as EditorIndexRoute } from '../../../routes/_authed/group/$id/editor/index';
import { Route as EditorDocRoute } from '../../../routes/_authed/group/$id/editor/$docId';
import { Route as OperationRoute } from '../../../routes/_authed/group/$id/operation';

function missingRouteComponent(routeName: string) {
  return () => {
    throw new Error(`${routeName} route component is missing.`);
  };
}

const GroupEditorLayout =
  EditorLayoutRoute.options.component ?? missingRouteComponent('Group editor layout');
const GroupEditorIndexPage =
  EditorIndexRoute.options.component ?? missingRouteComponent('Group editor index');
const GroupEditorDocPage =
  EditorDocRoute.options.component ?? missingRouteComponent('Group editor document');
const GroupOperationPage =
  OperationRoute.options.component ?? missingRouteComponent('Group operation');

function createPermissions(options?: {
  views?: Partial<
    Record<'groupDocuments' | 'groupLinks' | 'groupPayments' | 'groups' | 'groupTodos', boolean>
  >;
  manages?: Partial<
    Record<'groupDocuments' | 'groupLinks' | 'groupPayments' | 'groupTodos', boolean>
  >;
  isMember?: boolean;
  isLoading?: boolean;
}) {
  return {
    canView: (resource: string) =>
      options?.views?.[resource as keyof NonNullable<typeof options.views>] ?? false,
    canManage: (resource: string) =>
      options?.manages?.[resource as keyof NonNullable<typeof options.manages>] ?? false,
    isMember: () => options?.isMember ?? true,
    isLoading: options?.isLoading ?? false,
  };
}

function createOperationPageState() {
  return {
    userId: 'user-1',
    groupName: 'Group One',
    links: [],
    linkDialogOpen: false,
    setLinkDialogOpen: vi.fn(),
    handleAddLink: vi.fn(),
    payments: [],
    summary: { income: 0, expenditure: 0, balance: 0 },
    incomeData: [],
    expenditureData: [],
    todos: [],
    todoViewMode: 'kanban',
    setTodoViewMode: vi.fn(),
    toggleTodoComplete: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('group editor and operation routes', () => {
  it('blocks the editor layout when document view rights are missing', () => {
    vi.spyOn(EditorLayoutRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(createPermissions());

    render(<GroupEditorLayout />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
  });

  it('blocks the editor layout for non-members even when document view rights exist', () => {
    vi.spyOn(EditorLayoutRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: { groupDocuments: true },
        isMember: false,
      })
    );

    render(<GroupEditorLayout />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
  });

  it('passes canManageDocuments to the editor index page', () => {
    vi.spyOn(EditorIndexRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: { groupDocuments: true },
        manages: { groupDocuments: false },
      })
    );

    render(<GroupEditorIndexPage />);

    expect(
      screen.getByTestId('group-documents-list').getAttribute('data-can-manage-documents')
    ).toBe('false');
  });

  it('renders the group document editor in read-only mode for view-only users', () => {
    vi.spyOn(EditorDocRoute, 'useParams').mockReturnValue({
      id: 'group-1',
      docId: 'doc-1',
    } as never);
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'user@example.com' } });
    useUserStateMock.mockReturnValue({
      currentUser: {
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        handle: 'ada',
        avatar: null,
      },
    });
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: { groupDocuments: true },
        manages: { groupDocuments: false },
      })
    );

    render(<GroupEditorDocPage />);

    expect(screen.getByTestId('editor-view').getAttribute('data-read-only')).toBe('true');
  });

  it('keeps the operation page accessible when at least one operation section is viewable', () => {
    vi.spyOn(OperationRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: {
          groupDocuments: true,
          groupLinks: false,
          groupPayments: false,
          groups: false,
          groupTodos: false,
        },
      })
    );
    useGroupOperationPageMock.mockReturnValue(createOperationPageState());

    render(<GroupOperationPage />);

    expect(screen.queryByTestId('access-denied')).toBeNull();
    expect(screen.getByTestId('group-documents-list')).toBeTruthy();
  });

  it('blocks the operation page for non-members even when a section right is present', () => {
    vi.spyOn(OperationRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: {
          groupDocuments: true,
          groupLinks: false,
          groupPayments: false,
          groups: false,
          groupTodos: false,
        },
        isMember: false,
      })
    );
    useGroupOperationPageMock.mockReturnValue(createOperationPageState());

    render(<GroupOperationPage />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
  });

  it('blocks the operation page when no operation section is viewable', () => {
    vi.spyOn(OperationRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: {
          groupDocuments: false,
          groupLinks: false,
          groupPayments: false,
          groups: true,
          groupTodos: false,
        },
      })
    );
    useGroupOperationPageMock.mockReturnValue(createOperationPageState());

    render(<GroupOperationPage />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
  });

  it('renders operation sections in read-only mode when only view rights are present', () => {
    vi.spyOn(OperationRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    usePermissionsMock.mockReturnValue(
      createPermissions({
        views: {
          groupDocuments: true,
          groupLinks: true,
          groupPayments: true,
          groups: true,
          groupTodos: true,
        },
        manages: {
          groupDocuments: false,
          groupLinks: false,
          groupPayments: false,
          groupTodos: false,
        },
      })
    );
    useGroupOperationPageMock.mockReturnValue(createOperationPageState());

    render(<GroupOperationPage />);

    expect(screen.getByTestId('links-section').getAttribute('data-has-add-link')).toBe('false');
    expect(screen.getByTestId('payments-section').getAttribute('data-can-manage-payments')).toBe(
      'false'
    );
    expect(screen.getByTestId('todos-section').getAttribute('data-can-manage-todos')).toBe('false');
    expect(
      screen.getByTestId('group-documents-list').getAttribute('data-can-manage-documents')
    ).toBe('false');
  });
});
