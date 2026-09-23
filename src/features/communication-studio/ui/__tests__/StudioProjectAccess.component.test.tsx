/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  user: null as { id: string } | null,
  getSession: vi.fn(),
  fetch: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: io.getSession } }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: io.translate }),
}));
vi.mock('../../logic/document-v3', () => ({
  studioDocumentV3Schema: { safeParse: () => ({ success: true, data: { nodes: [] } }) },
}));
vi.mock('../../logic/frame-order', () => ({
  getStudioRootFramesInLayerOrder: () => [{ id: 'frame' }],
}));
vi.mock('../KonvaStudioCanvas', () => ({ default: () => <div>Read-only canvas</div> }));
vi.mock('../StudioWorkspace', () => ({ StudioWorkspace: () => <div>Editable workspace</div> }));
vi.mock('../StudioCloneDialog', () => ({ StudioCloneDialog: () => <div>Clone dialog</div> }));

import { StudioProjectAccess } from '../StudioProjectAccess';

const projectId = 'f9220000-0000-4000-a000-000000000001';
beforeEach(() => {
  io.user = null;
  io.getSession.mockResolvedValue({ data: { session: null } });
  io.fetch.mockResolvedValue(
    Response.json({
      project: {
        id: projectId,
        title: 'Open project',
        groupId: null,
        ownerId: 'owner',
        visibility: 'public',
        canEdit: false,
        canManageVisibility: false,
      },
      document: {},
      assets: [],
    })
  );
  vi.stubGlobal('fetch', io.fetch);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it('shows a public project to guests as a read-only canvas without cloning', async () => {
  render(<StudioProjectAccess groupId={null} projectId={projectId} open={vi.fn()} />);
  expect(await screen.findByText('Read-only canvas')).toBeTruthy();
  expect(screen.getByText('Open project')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'features.studio.cloneProject' })).toBeNull();
  expect(io.fetch).toHaveBeenCalledWith(`/api/studio/read/${projectId}`, { headers: {} });
});

it('offers cloning to signed-in readers without loading the editor', async () => {
  io.user = { id: 'reader' };
  io.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  render(<StudioProjectAccess groupId={null} projectId={projectId} open={vi.fn()} />);
  expect(await screen.findByText('Read-only canvas')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'features.studio.cloneProject' })).toBeTruthy();
  expect(screen.queryByText('Editable workspace')).toBeNull();
  expect(io.fetch).toHaveBeenCalledWith(`/api/studio/read/${projectId}`, {
    headers: { Authorization: 'Bearer token' },
  });
});
