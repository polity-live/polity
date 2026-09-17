/* @vitest-environment jsdom */
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewButton, WorkspacePreviewProvider } from '../WorkspacePreview';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
const queryState = vi.hoisted(() => ({ loading: false, available: true }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { projection?: boolean }) =>
    query.projection
      ? [undefined, { type: 'complete' }]
      : [
          queryState.available
            ? {
                id: 'one',
                title: 'Prepare agenda',
                description: 'Keep the context',
                status: 'pending',
              }
            : undefined,
          { type: queryState.loading ? 'unknown' : 'complete' },
        ],
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    todos: { byIdWithRelations: ({ id }: { id: string }) => ({ id }) },
    search: { searchDocumentById: () => ({ projection: true }) },
  },
}));
vi.mock('../../navigation/SmartLink', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  queryState.loading = false;
  queryState.available = true;
});

function List() {
  const [filter, setFilter] = useState('Open');
  return (
    <div>
      <input aria-label="Filter" value={filter} onChange={event => setFilter(event.target.value)} />
      <div data-testid="scroll" style={{ height: 200, overflow: 'auto' }}>
        <div style={{ height: 800 }}>
          <PreviewButton href="/todos/one" />
        </div>
      </div>
    </div>
  );
}

async function setup(initialEntry = '/todos?status=pending') {
  const root = createRootRoute({
    component: () => (
      <WorkspacePreviewProvider>
        <Outlet />
      </WorkspacePreviewProvider>
    ),
  });
  const route = createRoute({ getParentRoute: () => root, path: '/todos', component: List });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByLabelText('Filter');
  return router;
}

describe('workspace preview history and focus', () => {
  it('keeps list state and scroll, restores trigger focus on Back, and supports Forward', async () => {
    const router = await setup();
    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'My open tasks' } });
    const scroll = screen.getByTestId('scroll');
    scroll.scrollTop = 120;
    const trigger = screen.getByRole('button', { name: 'common.workspace.preview' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    expect(router.state.location.searchStr).toBe('?status=pending');
    expect(
      screen.getByRole('link', { name: 'common.workspace.openPage' }).getAttribute('href')
    ).toBe('/todos/one');
    await act(async () => {
      router.history.back();
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByLabelText('Filter') as HTMLInputElement).value).toBe('My open tasks');
    expect(scroll.scrollTop).toBe(120);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await act(async () => {
      router.history.forward();
    });
    await screen.findByRole('dialog');
  });

  it('keeps the source available while loading and hides details for unavailable records', async () => {
    queryState.loading = true;
    queryState.available = false;
    const router = await setup('/todos?status=pending#preview=todo:one');
    expect((await screen.findByRole('status')).textContent).toBe('common.workspace.loading');
    expect(screen.queryByRole('link', { name: 'common.workspace.openPage' })).toBeNull();
    queryState.loading = false;
    await act(async () => router.navigate({ hash: 'preview=todo:missing', search: true }));
    expect((await screen.findByRole('status')).textContent).toBe('common.workspace.unavailable');
    expect(screen.queryByRole('link', { name: 'common.workspace.openPage' })).toBeNull();
    expect(router.state.location.searchStr).toBe('?status=pending');
  });

  it('closes a directly linked preview without leaving the source page', async () => {
    const router = await setup('/todos?status=pending#preview=todo:one');
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(router.state.location.pathname).toBe('/todos');
    expect(router.state.location.searchStr).toBe('?status=pending');
  });
});
