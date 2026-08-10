/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentState: vi.fn(),
  can: vi.fn(),
  isAuthor: vi.fn(),
  isCollaborator: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ id: 'amendment-1' }),
  }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (input: unknown) => mocks.amendmentState(input),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: (input: unknown) => mocks.permissions(input),
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/notifications/ui/EntityNotifications.tsx', () => ({
  EntityNotifications: (props: Record<string, unknown>) => (
    <div data-testid="notifications" data-props={JSON.stringify(props)} />
  ),
}));

import { Route } from '../_authed/amendment/$id/notifications';

const Component = (Route as unknown as { component: React.ComponentType }).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.isAuthor.mockReturnValue(true);
  mocks.isCollaborator.mockReturnValue(false);
  mocks.permissions.mockReturnValue({
    can: mocks.can,
    isAuthor: mocks.isAuthor,
    isCollaborator: mocks.isCollaborator,
    isLoading: false,
  });
  mocks.amendmentState.mockReturnValue({
    amendment: { id: 'amendment-1', title: 'Climate plan' },
    collaborators: [],
    roles: [],
    isLoading: false,
  });
});

afterEach(() => cleanup());

describe('amendment notification route', () => {
  it.each<Record<string, any>>([
    [{ amendment: undefined, collaborators: undefined, roles: undefined, isLoading: true }],
    [
      {
        amendment: { id: 'amendment-1' },
        collaborators: [],
        roles: [],
        isLoading: false,
        permissionLoading: true,
      },
    ],
  ])('renders its loading state', state => {
    mocks.amendmentState.mockReturnValue(state);
    if (state.permissionLoading) {
      mocks.permissions.mockReturnValue({
        can: mocks.can,
        isAuthor: mocks.isAuthor,
        isCollaborator: mocks.isCollaborator,
        isLoading: true,
      });
    }
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('maps complete and defaulted RBAC data', () => {
    mocks.amendmentState.mockReturnValue({
      amendment: {
        id: 'amendment-1',
        title: 'Climate plan',
        created_by: { id: 'author-1' },
        group: { id: 'group-1' },
      },
      roles: [
        {
          id: 'role-1',
          name: null,
          description: null,
          scope: null,
          action_rights: [
            {
              id: 10,
              resource: null,
              action: null,
              group_id: 'group-1',
              event_id: 'event-1',
              amendment_id: 'amendment-1',
              blog_id: 'blog-1',
            },
            { id: 11, resource: 'notifications', action: 'view' },
          ],
        },
        {
          id: 'role-2',
          name: 'Manager',
          description: 'Manages notifications',
          scope: 'group',
          action_rights: null,
        },
      ],
      collaborators: [
        { id: 'collab-1', user: { id: 'user-1' }, role_id: 'role-1' },
        { id: 'collab-2', user: null, role_id: 'missing-role' },
      ],
      isLoading: false,
    });

    render(<Component />);
    expect(mocks.permissions).toHaveBeenCalledWith({
      amendmentId: 'amendment-1',
      amendment: expect.objectContaining({
        id: 'amendment-1',
        user: { id: 'author-1' },
        group: { id: 'group-1' },
        roles: [
          expect.objectContaining({
            name: '',
            description: undefined,
            scope: 'amendment',
            actionRights: [
              expect.objectContaining({
                id: '10',
                resource: '',
                action: '',
                group: { id: 'group-1' },
                event: { id: 'event-1' },
                amendment: { id: 'amendment-1' },
                blog: { id: 'blog-1' },
              }),
              expect.objectContaining({
                group: undefined,
                event: undefined,
                amendment: undefined,
                blog: undefined,
              }),
            ],
          }),
          expect.objectContaining({
            name: 'Manager',
            description: 'Manages notifications',
            scope: 'group',
            actionRights: [],
          }),
        ],
        amendmentRoleCollaborators: [
          expect.objectContaining({
            user: { id: 'user-1' },
            role: expect.objectContaining({ id: 'role-1' }),
          }),
          expect.objectContaining({ user: undefined, role: undefined }),
        ],
      }),
    });
  });

  it('maps absent ownership, group, roles and collaborators', () => {
    mocks.amendmentState.mockReturnValue({
      amendment: { id: 'amendment-1', title: null, created_by: null, group: null },
      collaborators: null,
      roles: null,
      isLoading: false,
    });
    render(<Component />);
    expect(mocks.permissions).toHaveBeenCalledWith({
      amendmentId: 'amendment-1',
      amendment: expect.objectContaining({
        user: undefined,
        group: undefined,
        roles: [],
        amendmentRoleCollaborators: [],
      }),
    });
    expect(JSON.parse(screen.getByTestId('notifications').dataset.props ?? '{}')).toEqual({
      entityId: 'amendment-1',
      entityType: 'amendment',
      entityName: '',
    });
  });

  it('checks collaborator, author and notification rights', () => {
    mocks.isCollaborator.mockReturnValue(false);
    mocks.isAuthor.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    expect(mocks.can).not.toHaveBeenCalled();
    cleanup();
    mocks.isAuthor.mockClear();
    mocks.can.mockClear();

    mocks.isCollaborator.mockReturnValue(true);
    mocks.can.mockReturnValue(false);
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    expect(mocks.isAuthor).not.toHaveBeenCalled();
    cleanup();

    mocks.can.mockReturnValue(true);
    render(<Component />);
    expect(screen.getByTestId('notifications')).toBeTruthy();
    expect(mocks.can).toHaveBeenCalledWith('viewNotifications', 'notifications');
  });
});
