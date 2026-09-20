/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceCommandItems } from '../WorkspaceCommandItems';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  favorite: vi.fn(),
  location: { pathname: '/group/local', searchStr: '', search: {} as Record<string, unknown> },
  user: { id: 'me' } as { id: string } | null,
  loading: false,
  favorites: [{ kind: 'view', title: 'My saved search', href: '/search?view=compact' }],
  preload: null as null | {
    beginIntent: ReturnType<typeof vi.fn>;
    cancelIntent: ReturnType<typeof vi.fn>;
  },
  error: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: any) => select({ location: mocks.location }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: (_: string, resource: string) => resource !== 'events' }),
}));
vi.mock('@/zero/preferences/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({
    isLoading: mocks.loading,
    favorites: mocks.favorites,
    setFavorite: mocks.favorite,
  }),
}));
vi.mock('@/zero/preloads', () => ({ usePreloadCoordinator: () => mocks.preload }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandSeparator: () => <hr />,
  CommandShortcut: ({ children }: any) => <span>{children}</span>,
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'me' };
  mocks.loading = false;
  mocks.preload = null;
  mocks.favorites = [{ kind: 'view', title: 'My saved search', href: '/search?view=compact' }];
  mocks.location = { pathname: '/group/local', searchStr: '', search: {} };
  mocks.favorite.mockResolvedValue(undefined);
});
describe('contextual workspace commands', () => {
  it.each([
    ['/group/local', 'group', 'common.entities.group'],
    ['/event/local', 'event', 'common.entities.event'],
    ['/amendment/local', 'amendment', 'common.entities.amendment'],
    ['/search', 'view', 'features.search.title'],
  ])('saves the visible context at %s after confirmation', async (pathname, kind, title) => {
    mocks.location.pathname = pathname;
    const close = vi.fn();
    render(
      <WorkspaceCommandItems
        groups={[{ id: 'local', name: '' }]}
        events={[{ id: 'local', key: 'local', start_date: 0, title: '' }]}
        amendments={[{ id: 'local', title: '' }]}
        onComplete={close}
      />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: kind === 'view' ? /common.workspace.saveView/ : /common.workspace.favorite/,
      })
    );
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mocks.favorite).toHaveBeenCalledWith({ kind, href: pathname, title }, true);
    if (kind === 'event') {
      fireEvent.click(screen.getByRole('button', { name: /common.workspace.create.agendaItem/ }));
      expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/create/agenda-item?eventId=local' });
    }
  });
  it('saves search query text, prevents repeated saves and preserves the menu on rejection', async () => {
    mocks.location = { pathname: '/search', searchStr: '?q=trees', search: { q: 'trees' } };
    mocks.favorites = [{ kind: 'view', title: 'Trees', href: '/search?q=trees' }];
    let reject!: (reason: Error) => void;
    mocks.favorite.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const close = vi.fn();
    render(<WorkspaceCommandItems groups={[]} events={[]} amendments={[]} onComplete={close} />);
    const button = screen.getByRole('button', { name: /common.workspace.unfavorite/ });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(mocks.favorite).toHaveBeenCalledOnce();
    expect(mocks.favorite).toHaveBeenCalledWith(
      { kind: 'view', title: 'features.search.title · trees', href: '/search?q=trees' },
      false
    );
    await act(async () => reject(new Error('Network')));
    expect(close).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('common.workspace.saveFailed');
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
  it('preloads only navigable commands and hides context writes until preferences load', () => {
    mocks.location.pathname = '/event/local';
    mocks.preload = { beginIntent: vi.fn(), cancelIntent: vi.fn() };
    const props = {
      groups: [],
      events: [{ id: 'local', key: 'local', start_date: 0, title: 'Meeting' }],
      amendments: [],
      onComplete: vi.fn(),
    };
    const view = render(<WorkspaceCommandItems {...props} />);
    for (const button of screen.getAllByRole('button')) {
      fireEvent.mouseEnter(button);
      fireEvent.focus(button);
      fireEvent.blur(button);
      fireEvent.mouseLeave(button);
    }
    expect(mocks.preload.beginIntent).toHaveBeenCalledWith('/create/agenda-item?eventId=local');
    expect(mocks.preload.cancelIntent).toHaveBeenCalledWith('/search?view=compact');
    mocks.preload = null;
    for (const button of screen.getAllByRole('button')) {
      fireEvent.mouseEnter(button);
      fireEvent.focus(button);
      fireEvent.blur(button);
      fireEvent.mouseLeave(button);
    }
    mocks.loading = true;
    view.rerender(<WorkspaceCommandItems {...props} />);
    expect(screen.queryByText('common.workspace.favorite')).toBeNull();
    mocks.location.pathname = '/dashboard';
    mocks.favorites = [];
    view.rerender(<WorkspaceCommandItems {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /common.workspace.create.todo/ }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/create/todo' });
    mocks.user = null;
    view.rerender(<WorkspaceCommandItems {...props} />);
    expect(screen.queryAllByRole('button')).toEqual([]);
  });
  it('uses the existing group context and permissions while exposing saved views', () => {
    const close = vi.fn();
    render(
      <WorkspaceCommandItems
        groups={[{ id: 'local', name: 'Local group' }]}
        events={[]}
        amendments={[]}
        onComplete={close}
      />
    );
    expect(screen.queryByText(/common.workspace.create.event/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /common.workspace.create.todo/ }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/create/todo?groupId=local&returnSection=todos',
    });
    expect(close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /My saved search/ }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/search?view=compact' });
  });
});
