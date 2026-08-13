/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentEdit: vi.fn(),
  amendmentState: {} as Record<string, any>,
  authUser: null as null | { id: string },
  collaboration: {} as Record<string, any>,
  navigate: vi.fn(),
  search: { tab: undefined as string | undefined },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: 'amendment-1' }),
    useSearch: () => mocks.search,
  }),
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div>loading</div>,
}));
vi.mock('@/features/shared/ui/ui/not-found', () => ({
  NotFound: () => <div>not-found</div>,
}));
vi.mock('@/features/amendments/hooks/useAmendmentCollaboration', () => ({
  useAmendmentCollaboration: () => mocks.collaboration,
}));
vi.mock('@/features/amendments/ui/AmendmentEditContent', () => ({
  AmendmentEditContent: (props: Record<string, any>) => {
    mocks.amendmentEdit(props);
    return <button onClick={() => props.onTabChange('workflow')}>amendment-edit</button>;
  },
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.amendmentState,
}));

import { Route } from '../_authed/amendment/$id/settings';

const Component = (Route as unknown as { component: React.ComponentType }).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendmentState = {
    amendment: { id: 'amendment-1' },
    amendmentProcess: undefined,
    isLoading: false,
  };
  mocks.authUser = { id: 'user-1' };
  mocks.collaboration = { isAdmin: false, isCollaborator: true, isLoading: false };
  mocks.navigate.mockResolvedValue(undefined);
  mocks.search = { tab: undefined };
});

afterEach(() => cleanup());

describe('amendment settings route', () => {
  it('renders loading, denied and not-found states', () => {
    mocks.collaboration = { isAdmin: false, isCollaborator: false, isLoading: true };
    render(<Component />);
    expect(screen.getByText('loading')).toBeTruthy();
    cleanup();

    mocks.collaboration = { isAdmin: false, isCollaborator: false, isLoading: false };
    mocks.authUser = null;
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.authUser = { id: 'user-1' };
    render(<Component />);
    expect(screen.getByText('access-denied')).toBeTruthy();
    cleanup();

    mocks.collaboration = { isAdmin: true, isCollaborator: false, isLoading: false };
    mocks.amendmentState = { amendment: undefined, amendmentProcess: undefined, isLoading: false };
    render(<Component />);
    expect(screen.getByText('not-found')).toBeTruthy();
  });

  it('renders collaborator and administrator edit states with tab navigation', () => {
    render(<Component />);
    expect(mocks.amendmentEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        amendmentId: 'amendment-1',
        currentUserId: 'user-1',
        agendaItemId: undefined,
        activeTab: 'general',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'amendment-edit' }));
    const updater = mocks.navigate.mock.calls.at(-1)?.[0].search;
    expect(updater({ keep: true })).toEqual({ keep: true, tab: 'workflow' });
    cleanup();

    mocks.collaboration = { isAdmin: true, isCollaborator: false, isLoading: false };
    mocks.amendmentState = {
      amendment: { id: 'amendment-1' },
      amendmentProcess: { agenda_items: [{ id: 'agenda-1' }] },
      isLoading: true,
    };
    mocks.search = { tab: 'location' };
    render(<Component />);
    expect(mocks.amendmentEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isLoading: true,
        agendaItemId: 'agenda-1',
        activeTab: 'location',
      })
    );
  });
});
