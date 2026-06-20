/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useAmendmentStateMock = vi.fn();
const useCollaboratorsPageControllerMock = vi.fn();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (...args: unknown[]) => useAmendmentStateMock(...args),
}));

vi.mock('@/features/amendments/collaborators/hooks/useCollaboratorsPageController', () => ({
  useCollaboratorsPageController: (...args: unknown[]) =>
    useCollaboratorsPageControllerMock(...args),
}));

vi.mock('@/features/amendments/collaborators/ui/CollaboratorsView', () => ({
  CollaboratorsView: ({
    amendmentId,
    amendmentTitle,
  }: {
    amendmentId: string;
    amendmentTitle: string;
  }) => (
    <div data-testid="collaborators-view" data-amendment-id={amendmentId}>
      {amendmentTitle}
    </div>
  ),
}));

vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied" />,
}));

vi.mock('@/features/shared/ui/ui/global-loading-animation', () => ({
  GlobalLoadingAnimation: () => <div data-testid="global-loading-animation" />,
}));

import {
  AmendmentCollaboratorsPage,
  Route,
} from '../../../../routes/_authed/amendment/$id/collaborators';

function mockRouteState({
  userId = 'user-1',
  authorId = 'author-user',
  canManageCollaborators = false,
  isLoading = false,
}: {
  userId?: string;
  authorId?: string;
  canManageCollaborators?: boolean;
  isLoading?: boolean;
} = {}) {
  vi.spyOn(Route, 'useParams').mockReturnValue({ id: 'amendment-1' } as never);
  useAuthMock.mockReturnValue({ user: { id: userId } });
  useAmendmentStateMock.mockReturnValue({
    amendment: {
      id: 'amendment-1',
      title: 'Safer Streets',
      created_by_id: authorId,
    },
    isLoading,
  });
  useCollaboratorsPageControllerMock.mockReturnValue({
    canManageCollaborators,
    isLoading,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockRouteState();
});

describe('AmendmentCollaboratorsPage', () => {
  it.each(['invited collaborator', 'requested collaborator', 'active non-manager collaborator'])(
    'shows AccessDenied for %s without amendment manage rights',
    () => {
      render(<AmendmentCollaboratorsPage />);

      expect(screen.queryByTestId('access-denied')).not.toBeNull();
      expect(screen.queryByTestId('collaborators-view')).toBeNull();
    }
  );

  it('renders the management view for active managers', () => {
    mockRouteState({ canManageCollaborators: true });

    render(<AmendmentCollaboratorsPage />);

    expect(screen.queryByTestId('access-denied')).toBeNull();
    expect(screen.getByTestId('collaborators-view')).toBeTruthy();
  });

  it('renders the management view for authors', () => {
    mockRouteState({ userId: 'author-user', authorId: 'author-user' });

    render(<AmendmentCollaboratorsPage />);

    expect(screen.queryByTestId('access-denied')).toBeNull();
    expect(screen.getByTestId('collaborators-view')).toBeTruthy();
  });

  it('shows loading while amendment or collaborator permissions are loading', () => {
    mockRouteState({ isLoading: true });

    render(<AmendmentCollaboratorsPage />);

    expect(screen.queryByTestId('global-loading-animation')).not.toBeNull();
    expect(screen.queryByTestId('access-denied')).toBeNull();
  });
});
