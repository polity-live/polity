vi.mock('@rocicorp/zero/react', async () => {
  const { studioSnapshotFixture } = await import('@/test/studio-snapshot.fixture');
  return { useQuery: (q: any) => studioSnapshotFixture(q, io) };
});
vi.mock('@/zero/queries', async () => {
  const { studioQueryFixture } = await import('@/test/studio-client.fixture');
  return { queries: { studio: studioQueryFixture } };
});
import { forwardRef, useImperativeHandle } from 'react';
/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  snapshot: {} as any,
  user: null as { id: string } | null,
  getSession: vi.fn(),
  fetch: vi.fn(),
  focus: vi.fn().mockResolvedValue(undefined),
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
vi.mock('../KonvaStudioCanvas', () => ({
  default: forwardRef((_props, ref) => {
    useImperativeHandle(ref, () => ({ execute: io.focus }), []);
    return <div>Read-only canvas</div>;
  }),
}));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({
  ProjectChatPanel: () => <div>Project chat</div>,
}));
vi.mock('../StudioWorkspace', () => ({ StudioWorkspace: () => <div>Editable workspace</div> }));
vi.mock('../StudioCloneDialog', () => ({ StudioCloneDialog: () => <div>Clone dialog</div> }));

import { StudioProjectAccess } from '../StudioProjectAccess';

const projectId = 'f9220000-0000-4000-a000-000000000001';
beforeEach(() => {
  io.user = null;
  io.getSession.mockResolvedValue({ data: { session: null } });
  io.snapshot = {
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
  };
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
  expect(io.fetch).not.toHaveBeenCalled();
});

it('offers cloning to signed-in readers without loading the editor', async () => {
  io.user = { id: 'reader' };
  io.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  render(<StudioProjectAccess groupId={null} projectId={projectId} open={vi.fn()} />);
  expect(await screen.findByText('Read-only canvas')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'features.studio.cloneProject' })).toBeTruthy();
  expect(screen.queryByText('Editable workspace')).toBeNull();
  expect(io.fetch).not.toHaveBeenCalled();
});

it('honors an element deep link in the read-only original and consumes it after focus', async () => {
  const handled = vi.fn();
  io.focus.mockResolvedValue(undefined);
  render(
    <StudioProjectAccess
      groupId={null}
      projectId={projectId}
      open={vi.fn()}
      focusNodeId="heading"
      onFocusHandled={handled}
    />
  );
  await waitFor(() => expect(io.focus).toHaveBeenCalledWith({ type: 'focus', nodeId: 'heading' }));
  await waitFor(() => expect(handled).toHaveBeenCalledOnce());
});
it('rejects an inaccessible workspace instead of focusing a canonical element with the same ID', async () => {
  const handled = vi.fn();
  const workspaceId = '00000000-0000-4000-a000-000000000001';
  render(
    <StudioProjectAccess
      groupId={null}
      projectId={projectId}
      open={vi.fn()}
      workspaceId={workspaceId}
      focusNodeId="heading"
      onFocusHandled={handled}
    />
  );
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(io.focus).not.toHaveBeenCalled();
  await waitFor(() => expect(handled).toHaveBeenCalledWith(workspaceId));
});

it('keeps an editable snapshot read-only while the actor identity is temporarily absent', async () => {
  io.user = { id: undefined } as never;
  io.snapshot.project.canEdit = true;
  io.snapshot.project.groupId = 'group';
  render(<StudioProjectAccess groupId="group" projectId={projectId} open={vi.fn()} />);
  expect(await screen.findByText('Read-only canvas')).toBeTruthy();
  expect(screen.queryByText('Editable workspace')).toBeNull();
});
