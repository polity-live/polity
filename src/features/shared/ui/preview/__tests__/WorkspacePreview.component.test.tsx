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
vi.mock('../../ui/dialog', async original => {
  const actual = await original<typeof import('../../ui/dialog')>();
  return {
    ...actual,
    Dialog: ({ children, onOpenChange, ...props }: any) => (
      <actual.Dialog {...props} onOpenChange={onOpenChange}>
        {children}
        {props.open && <button onClick={() => onOpenChange(true)}>Keep preview open</button>}
      </actual.Dialog>
    ),
  };
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
const queryState = vi.hoisted(() => ({
  loading: false,
  available: true,
  row: null as Record<string, unknown> | null,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { projection?: boolean }) =>
    query.projection
      ? [undefined, { type: 'complete' }]
      : [
          queryState.available
            ? (queryState.row ?? {
                id: 'one',
                title: 'Prepare agenda',
                description: 'Keep the context',
                status: 'pending',
              })
            : undefined,
          { type: queryState.loading ? 'unknown' : 'complete' },
        ],
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    todos: { byIdWithRelations: ({ id }: { id: string }) => ({ id }) },
    amendments: { byId: ({ id }: { id: string }) => ({ id }) },
    events: { byId: ({ id }: { id: string }) => ({ id }) },
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
  queryState.row = null;
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
  it('replaces an existing preview without adding history and tolerates a non-HTML focus target', async () => {
    const router = await setup('/todos#preview=todo:first');
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('Keep preview open'));
    expect(router.state.location.hash).toBe('preview=todo:first');
    const replace = vi.spyOn(router.history, 'replace');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    document.body.appendChild(svg);
    (svg as unknown as HTMLElement).focus();
    const activeElement = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(svg);
    fireEvent.click(document.querySelector('[data-workspace-preview-button]')!);
    activeElement.mockRestore();
    await waitFor(() => expect(router.state.location.hash).toBe('preview=todo:one'));
    expect(replace).toHaveBeenCalledOnce();
    svg.remove();
    replace.mockRestore();
  });
  it.each(['amendment', 'event'])(
    'renders authorized %s details and removes them when the next record is unavailable',
    async kind => {
      queryState.row = {
        title: '',
        preamble: JSON.stringify([{ children: [{ text: 'Rich description' }, {}] }]),
        description: '[Plain text, not JSON',
        code: 'A-12',
        start_date: Date.UTC(2026, 8, 20, 10),
        end_date: Date.UTC(2026, 8, 20, 12),
        location_name: 'Town Hall',
        city: 'Berlin',
      };
      const router = await setup(`/todos#preview=${kind}:one`);
      expect((await screen.findByRole('dialog')).textContent).toContain(`common.entities.${kind}`);
      if (kind === 'amendment') expect(screen.getByText('Rich description')).toBeTruthy();
      else {
        expect(screen.getByText('[Plain text, not JSON')).toBeTruthy();
        expect(screen.getByText('Town Hall, Berlin')).toBeTruthy();
      }
      queryState.row = { title: 'Named record', reason: { text: 'Fallback reason' } };
      await act(async () => router.navigate({ hash: `preview=${kind}:second` }));
      expect(await screen.findByText('Named record')).toBeTruthy();
      if (kind === 'amendment') expect(screen.getByText('Fallback reason')).toBeTruthy();
      queryState.available = false;
      await act(async () => router.navigate({ hash: `preview=${kind}:missing` }));
      expect((await screen.findByRole('status')).textContent).toBe('common.workspace.unavailable');
      expect(screen.queryByText('Named record')).toBeNull();
    }
  );
  it('shows task owners and dates without leaking unavailable assignment details', async () => {
    queryState.row = {
      title: 'Task',
      description: JSON.stringify({ children: [{ text: 'Body' }] }),
      status: 'pending',
      assignments: [{ user: { first_name: 'Ada', last_name: 'Lovelace' } }, { user: null }],
      due_date: Date.UTC(2026, 8, 21),
      group: { name: 'Working group' },
    };
    const router = await setup('/todos#preview=todo:one');
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Working group')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    queryState.row = {
      title: 'Task without assignment',
      description: 42,
      status: 'pending',
      assignments: [],
    };
    await act(async () => router.navigate({ hash: 'preview=todo:second' }));
    expect(await screen.findByText('features.todos.assignee.unassigned')).toBeTruthy();
    expect(screen.queryByText('Working group')).toBeNull();
  });
  it('returns through history when a preview opened from the current list is dismissed', async () => {
    const router = await setup();
    const button = screen.getByRole('button', { name: 'common.workspace.preview' });
    button.focus();
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.hash).toBe(''));
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
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
