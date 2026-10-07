/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  navigate: vi.fn(),
  collaboration: vi.fn(),
  studio: vi.fn(),
  media: vi.fn(),
  privateMedia: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="outlet" />,
  createFileRoute: (path: string) => (options: unknown) => ({
    options,
    path,
    useSearch: () => ({}),
    useParams: () => ({ id: 'group', projectId: 'project' }),
    useNavigate: () => io.navigate,
  }),
}));
vi.mock('@/features/communication-studio/ui/StudioWorkspace', () => ({
  StudioWorkspace: ({ groupId, projectId, open }: any) => (
    <button onClick={() => open('next')}>
      {groupId ?? 'personal'}:{projectId}
    </button>
  ),
}));
vi.mock('@/features/communication-studio/ui/StudioProjectAccess', () => ({
  StudioProjectAccess: ({ groupId, projectId, open, onFocusHandled }: any) => (
    <>
      <button>
        {groupId ?? 'personal'}:{projectId}
      </button>
      <button onClick={() => open('next')}>Open another project</button>
      <button onClick={() => onFocusHandled('next-workspace')}>Complete canvas focus</button>
    </>
  ),
}));
vi.mock('@/features/communication-studio/ui/StudioProjectOverview', () => ({
  StudioProjectOverview: ({ groupId, projectHref }: any) => (
    <a href={projectHref('next')}>{groupId}:</a>
  ),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], isLoading: false }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/server/studio/published-media', () => ({ publishedStudioMedia: io.media }));
vi.mock('@/server/studio/private-media', () => ({ privateCanvasMedia: io.privateMedia }));
import { Route as PersonalRoot } from '../_authed/studio';
import { Route as Personal } from '../_authed/studio/index';
import { Route as PersonalProject } from '../_authed/studio/$projectId';
import { Route as GroupRoot } from '../_authed/group/$id/studio';
import { Route as Group } from '../_authed/group/$id/studio/index';
import { Route as GroupProject } from '../_authed/group/$id/studio/$projectId';
import { Route as CollaborationAPI } from '../api/collaboration';
import { Route as MediaAPI } from '../api/studio/published-media/$id';
import { Route as PrivateAssetAPI } from '../api/studio/media/$id';
import { Route as PrivateExportAPI } from '../api/studio/exports/$id';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('opens the selected project without losing its workspace route', () => {
  const Page = Personal.options.component as any;
  render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'personal:' }));
  expect(io.navigate).toHaveBeenCalledWith({
    to: '/studio/$projectId',
    params: { projectId: 'next' },
  });
});
it('links group projects to their group Studio route', () => {
  const Page = Group.options.component as any;
  render(<Page />);
  expect(screen.getByRole('link', { name: 'group:' }).getAttribute('href')).toBe(
    '/group/group/studio/next'
  );
});

it.each([
  [PersonalProject, 'personal'],
  [GroupProject, 'group'],
] as const)('renders a project on its dedicated full-screen route', (route, scope) => {
  const Page = route.options.component as any;
  render(<Page />);
  expect(screen.getByRole('button', { name: `${scope}:project` })).toBeTruthy();
});

it.each([
  [PersonalProject, null],
  [GroupProject, 'group'],
] as const)(
  'preserves project scope when opening another project or completing canvas focus',
  (route, groupId) => {
    const Page = route.options.component as any;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete canvas focus' }));
    expect(io.navigate).toHaveBeenCalledWith({
      search: { conversationId: undefined, workspaceId: 'next-workspace' },
      replace: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open another project' }));
    expect(io.navigate).toHaveBeenCalledWith({
      to: groupId ? '/group/$id/studio/$projectId' : '/studio/$projectId',
      params: groupId ? { id: groupId, projectId: 'next' } : { projectId: 'next' },
    });
  }
);

it.each([PersonalRoot, GroupRoot])('renders nested Studio routes through an outlet', route => {
  const Page = route.options.component as any;
  render(<Page />);
  expect(screen.getByTestId('outlet')).toBeTruthy();
});
it('passes original requests to authorization handlers, including the published asset identity', async () => {
  const request = new Request('http://localhost:3000/api/collaboration', {
    method: 'POST',
    body: '{}',
  });
  const denied = new Response('denied', { status: 403 });
  io.collaboration.mockResolvedValue(denied);
  io.media.mockResolvedValue(denied);
  io.privateMedia.mockResolvedValue(denied);
  expect((await (CollaborationAPI.options as any).server.handlers.POST({ request })).status).toBe(
    410
  );
  expect(
    await (MediaAPI.options as any).server.handlers.GET({ request, params: { id: 'asset' } })
  ).toBe(denied);
  expect(
    await (PrivateAssetAPI.options as any).server.handlers.GET({
      request,
      params: { id: 'private-asset' },
    })
  ).toBe(denied);
  expect(
    await (PrivateExportAPI.options as any).server.handlers.GET({
      request,
      params: { id: 'private-export' },
    })
  ).toBe(denied);

  expect(io.media).toHaveBeenCalledWith(request, 'asset');
  expect(io.privateMedia).toHaveBeenCalledWith(request, 'private-asset');
  expect(io.privateMedia).toHaveBeenCalledWith(request, 'private-export', 'export');
});
