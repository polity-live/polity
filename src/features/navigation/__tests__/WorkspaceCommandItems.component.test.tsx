/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceCommandItems } from '../WorkspaceCommandItems';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  favorite: vi.fn(),
  location: { pathname: '/group/local', searchStr: '', search: {} },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: () => mocks.location,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: (_: string, resource: string) => resource !== 'events' }),
}));
vi.mock('@/zero/preferences/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({
    isLoading: false,
    favorites: [{ kind: 'view', title: 'My saved search', href: '/search?view=compact' }],
    setFavorite: mocks.favorite,
  }),
}));
vi.mock('@/zero/preloads', () => ({ usePreloadCoordinator: () => null }));
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
describe('contextual workspace commands', () => {
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
