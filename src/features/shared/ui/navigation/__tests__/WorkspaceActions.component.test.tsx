/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../FavoriteButton';
import { WorkspaceHeader } from '../../layout/WorkspaceHeader';
import { SaveSearchViewButton } from '@/features/search/ui/SaveSearchViewButton';
import { CompactSearchRow, searchTypeDotClasses } from '@/features/search/ui/CompactSearchRow';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  error: vi.fn(),
  user: { id: 'me' } as { id: string } | null,
  preference: { workspace_preferences: { favorites: [] as unknown[], display: {} } },
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ preference: mocks.preference, isLoading: false }),
}));
vi.mock('@/zero/mutators', () => ({
  mutators: { preferences: { setWorkspaceFavorite: (args: unknown) => args } },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({ search: { q: 'assembly' }, searchStr: '?q=assembly&view=compact' }),
}));
vi.mock('../SmartLink', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../../preview/WorkspacePreview', () => ({
  PreviewButton: ({ href }: { href: string }) => <button data-href={href}>Preview</button>,
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'me' };
  mocks.preference.workspace_preferences.favorites = [];
});

describe('workspace actions and saved views', () => {
  it('saves the exact filtered view once, waits for confirmation and reports rejection', async () => {
    let reject!: (error: Error) => void;
    mocks.mutate.mockReturnValue({
      server: new Promise((_, fail) => {
        reject = fail;
      }),
    });
    render(
      <WorkspaceHeader title="Search" context="Workspace" actions={<SaveSearchViewButton />}>
        <input aria-label="Filter" defaultValue="assembly" />
      </WorkspaceHeader>
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Search');
    const button = screen.getByRole('button', { name: 'common.workspace.favorite' });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        favorite: {
          kind: 'view',
          href: '/search?q=assembly&view=compact',
          title: 'features.search.title · assembly',
        },
      })
    );
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await act(async () => reject(new Error('Offline')));
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('false'));
    expect(mocks.error).toHaveBeenCalledWith('common.workspace.saveFailed');
    expect((screen.getByLabelText('Filter') as HTMLInputElement).value).toBe('assembly');
    expect(document.activeElement).toBe(button);
  });

  it('removes a saved favorite and hides personal controls when signed out', async () => {
    const favorite = { kind: 'group' as const, href: '/group/local', title: 'Local' };
    mocks.preference.workspace_preferences.favorites = [favorite];
    mocks.mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
    const { rerender } = render(<FavoriteButton favorite={favorite} />);
    const button = screen.getByRole('button', { name: 'common.workspace.unfavorite' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ favorite, active: false }));
    mocks.user = null;
    rerender(<FavoriteButton favorite={favorite} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps a direct detail link and an explicit preview in compact search results', () => {
    render(
      <CompactSearchRow
        document={
          {
            entity_type: 'amendment',
            entity_id: 'proposal',
            title: 'Better participation',
            summary: 'A short summary',
          } as any
        }
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/amendment/proposal');
    expect(screen.getByRole('button', { name: 'Preview' }).getAttribute('data-href')).toBe(
      '/amendment/proposal'
    );
    expect(screen.getByText('A short summary')).toBeTruthy();
    const dot = document.querySelector('[data-search-type-dot="amendment"]');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.className).toContain('--entity-amendment-base');
    expect(dot?.nextElementSibling?.textContent).toBe('common.entities.amendment');
    expect(new Set(Object.values(searchTypeDotClasses)).size).toBe(
      Object.keys(searchTypeDotClasses).length
    );
  });
});
