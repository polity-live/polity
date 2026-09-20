/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  navigate: vi.fn(),
  collaboration: vi.fn(),
  studio: vi.fn(),
  media: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: unknown) => ({
    options,
    path,
    useSearch: () => ({ project: 'project' }),
    useParams: () => ({ id: 'group' }),
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
vi.mock('@/server/collaboration/api', () => ({ handleCollaboration: io.collaboration }));
vi.mock('@/server/studio/api', () => ({ handleStudio: io.studio }));
vi.mock('@/server/studio/published-media', () => ({ publishedStudioMedia: io.media }));
import { Route as Personal } from '../_authed/studio';
import { Route as Group } from '../_authed/group/$id/studio';
import { Route as CollaborationAPI } from '../api/collaboration';
import { Route as StudioAPI } from '../api/studio';
import { Route as MediaAPI } from '../api/studio/published-media/$id';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each([
  [Personal, 'personal'],
  [Group, 'group'],
] as const)('opens the selected project without losing its workspace route', (route, scope) => {
  const Page = route.options.component as any;
  render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: `${scope}:project` }));
  expect(io.navigate).toHaveBeenCalledWith({ search: { project: 'next' } });
});
it('passes original requests to authorization handlers, including the published asset identity', async () => {
  const request = new Request('http://localhost:3000/api/collaboration', {
    method: 'POST',
    body: '{}',
  });
  const denied = new Response('denied', { status: 403 });
  io.collaboration.mockResolvedValue(denied);
  io.studio.mockResolvedValue(denied);
  io.media.mockResolvedValue(denied);
  expect(await (CollaborationAPI.options as any).server.handlers.POST({ request })).toBe(denied);
  expect(await (StudioAPI.options as any).server.handlers.POST({ request })).toBe(denied);
  expect(
    await (MediaAPI.options as any).server.handlers.GET({ request, params: { id: 'asset' } })
  ).toBe(denied);
  expect(io.collaboration).toHaveBeenCalledWith(request);
  expect(io.studio).toHaveBeenCalledWith(request);
  expect(io.media).toHaveBeenCalledWith(request, 'asset');
});
