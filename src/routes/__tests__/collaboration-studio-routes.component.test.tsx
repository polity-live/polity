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
vi.mock('@/server/studio/api', () => ({ handleStudio: io.studio }));
vi.mock('@/server/studio/published-media', () => ({ publishedStudioMedia: io.media }));
vi.mock('@/server/studio/private-media', () => ({ privateCanvasMedia: io.privateMedia }));
import { Route as PersonalRoot } from '../_authed/studio';
import { Route as Personal } from '../_authed/studio/index';
import { Route as PersonalProject } from '../_authed/studio/$projectId';
import { Route as GroupRoot } from '../_authed/group/$id/studio';
import { Route as Group } from '../_authed/group/$id/studio/index';
import { Route as GroupProject } from '../_authed/group/$id/studio/$projectId';
import { Route as WhiteboardRoot } from '../_authed/whiteboards';
import { Route as Whiteboard } from '../_authed/whiteboards/index';
import { Route as WhiteboardProject } from '../_authed/whiteboards/$projectId';
import { Route as GroupWhiteboardRoot } from '../_authed/group/$id/whiteboards';
import { Route as GroupWhiteboard } from '../_authed/group/$id/whiteboards/index';
import { Route as GroupWhiteboardProject } from '../_authed/group/$id/whiteboards/$projectId';
import { Route as CollaborationAPI } from '../api/collaboration';
import { Route as StudioAPI } from '../api/studio';
import { Route as MediaAPI } from '../api/studio/published-media/$id';
import { Route as PrivateAssetAPI } from '../api/studio/media/$id';
import { Route as PrivateExportAPI } from '../api/studio/exports/$id';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each([
  [Personal, 'personal', { to: '/studio/$projectId', params: { projectId: 'next' } }],
  [
    Group,
    'group',
    { to: '/group/$id/studio/$projectId', params: { id: 'group', projectId: 'next' } },
  ],
  [Whiteboard, 'personal', { to: '/whiteboards/$projectId', params: { projectId: 'next' } }],
  [
    GroupWhiteboard,
    'group',
    { to: '/group/$id/whiteboards/$projectId', params: { id: 'group', projectId: 'next' } },
  ],
] as const)(
  'opens the selected project without losing its workspace route',
  (route, scope, expected) => {
    const Page = route.options.component as any;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: `${scope}:` }));
    expect(io.navigate).toHaveBeenCalledWith(expected);
  }
);

it.each([
  [PersonalProject, 'personal'],
  [GroupProject, 'group'],
  [WhiteboardProject, 'personal'],
  [GroupWhiteboardProject, 'group'],
] as const)('renders a project on its dedicated full-screen route', (route, scope) => {
  const Page = route.options.component as any;
  render(<Page />);
  expect(screen.getByRole('button', { name: `${scope}:project` })).toBeTruthy();
});

it.each([PersonalRoot, GroupRoot, WhiteboardRoot, GroupWhiteboardRoot])(
  'renders nested Studio routes through an outlet',
  route => {
    const Page = route.options.component as any;
    render(<Page />);
    expect(screen.getByTestId('outlet')).toBeTruthy();
  }
);
it('passes original requests to authorization handlers, including the published asset identity', async () => {
  const request = new Request('http://localhost:3000/api/collaboration', {
    method: 'POST',
    body: '{}',
  });
  const denied = new Response('denied', { status: 403 });
  io.collaboration.mockResolvedValue(denied);
  io.studio.mockResolvedValue(denied);
  io.media.mockResolvedValue(denied);
  io.privateMedia.mockResolvedValue(denied);
  expect((await (CollaborationAPI.options as any).server.handlers.POST({ request })).status).toBe(
    410
  );
  expect(await (StudioAPI.options as any).server.handlers.POST({ request })).toBe(denied);
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

  expect(io.studio).toHaveBeenCalledWith(request);
  expect(io.media).toHaveBeenCalledWith(request, 'asset');
  expect(io.privateMedia).toHaveBeenCalledWith(request, 'private-asset');
  expect(io.privateMedia).toHaveBeenCalledWith(request, 'private-export', 'export');
});
