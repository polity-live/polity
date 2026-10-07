vi.mock('@rocicorp/zero/react', async () => {
  const { studioSnapshotFixture } = await import('@/test/studio-snapshot.fixture');
  return { useQuery: (q: any) => studioSnapshotFixture(q, io) };
});
vi.mock('@/zero/queries', async () => {
  const { studioQueryFixture } = await import('@/test/studio-client.fixture');
  return { queries: { studio: studioQueryFixture } };
});
// @vitest-environment jsdom
import { forwardRef, useImperativeHandle } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { StudioProjectAccess } from '../StudioProjectAccess';
const io = vi.hoisted(() => ({
  user: { id: 'reader' } as { id: string } | null,
  getSession: vi.fn(),
  fetch: vi.fn(),
  focus: vi.fn(),
  toast: vi.fn(),
  props: {} as any,
  snapshot: {} as any,
  queryStatus: undefined as any,
  t: (key: string) => key,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: io.getSession } }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ useTranslation: () => ({ t: io.t }) }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: io.toast } }));
vi.mock('../KonvaStudioCanvas', () => ({
  default: forwardRef((props, ref) => {
    io.props = props;
    useImperativeHandle(ref, () => ({ execute: io.focus }), []);
    return <div>Read canvas</div>;
  }),
}));
vi.mock('../StudioWorkspace', () => ({
  StudioWorkspace: (props: any) => <div data-testid="workspace">{props.workspaceId}</div>,
}));
vi.mock('../StudioCloneDialog', () => ({
  StudioCloneDialog: ({ onOpenChange }: any) => (
    <button onClick={() => onOpenChange(false)}>Close clone</button>
  ),
}));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({
  ProjectChatPanel: (props: any) => (
    <div data-testid="chat">{props.context.elementIds.join(',')}</div>
  ),
}));
const props = { groupId: null, projectId: 'project', open: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  io.queryStatus = undefined;
  io.user = { id: 'reader' };
  io.focus.mockResolvedValue(undefined);
  io.getSession.mockResolvedValue({ data: { session: null } });
  io.snapshot = {
    project: {
      id: 'project',
      title: 'Read project',
      groupId: null,
      ownerId: 'owner',
      visibility: 'public',
      canEdit: false,
      canManageVisibility: false,
    },
    document: legacyDocumentToV3(createDocument('carousel', 'Read project')),
    assets: [],
  };
  io.fetch.mockImplementation(
    async (_url: string) => new Response(new Blob(['media'], { type: 'image/png' }))
  );
  vi.stubGlobal('fetch', io.fetch);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:reader-media');
      static revokeObjectURL = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const loaded = () => screen.findByText('Read canvas');
it.each(['denied', 'scope', 'query-error'])('handles Zero read failure %s', async kind => {
  if (kind === 'denied') io.snapshot = null;
  if (kind === 'scope') io.snapshot.project.groupId = 'wrong';
  if (kind === 'query-error') io.queryStatus = { type: 'error', error: { message: 'Denied' } };
  render(<StudioProjectAccess {...props} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByTestId('workspace')).toBeNull();
});
it('shows pending Zero reads and updates after permission revocation', async () => {
  io.snapshot = null;
  io.queryStatus = { type: 'unknown' };
  const view = render(<StudioProjectAccess {...props} />);
  expect(screen.getByRole('status')).toBeTruthy();
  io.queryStatus = { type: 'complete' };
  view.rerender(<StudioProjectAccess {...props} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
});
it.each(['invalid', 'empty'])(
  'handles a read-only document with %s frame data without mounting an editable canvas',
  async state => {
    if (state === 'invalid') io.snapshot.document = { bad: true };
    else {
      io.snapshot.document.nodes = [];
      io.snapshot.document.deliverables = [];
    }
    render(<StudioProjectAccess {...props} />);
    if (state === 'invalid')
      expect((await screen.findByRole('alert')).textContent).toBe(
        'features.studio.projectUnavailable'
      );
    else {
      expect(await screen.findByRole('heading', { name: 'Read project' })).toBeTruthy();
      expect(screen.queryByText('Read canvas')).toBeNull();
    }
  }
);
it('passes an authorized proposal workspace to the editor rather than treating it as a reader', async () => {
  io.snapshot.project.canEdit = true;
  render(
    <StudioProjectAccess
      {...props}
      workspaceId="proposal"
      conversationId="chat"
      focusNodeId="node"
    />
  );
  expect((await screen.findByTestId('workspace')).textContent).toBe('proposal');
  expect(io.focus).not.toHaveBeenCalled();
});
it('opens and closes cloning, selects reader frames and retains exact chat selection', async () => {
  render(<StudioProjectAccess {...props} conversationId="chat" />);
  await loaded();
  const second = screen.getByRole('button', { name: '2' });
  fireEvent.click(second);
  expect(second.getAttribute('aria-pressed')).toBe('true');
  act(() => io.props.selectExact(['node']));
  expect(screen.getByTestId('chat').textContent).toBe('node');
  act(() => io.props.activateFrame('missing'));
  expect(screen.getByRole('button', { name: '1' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'features.studio.cloneProject' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close clone' }));
  expect(screen.queryByRole('button', { name: 'Close clone' })).toBeNull();
});
it('reports an unavailable reader focus target once and allows it again after the focus link resets', async () => {
  io.focus.mockRejectedValue(new Error('Missing target'));
  const view = render(<StudioProjectAccess {...props} focusNodeId="missing" />);
  await loaded();
  await waitFor(() =>
    expect(io.toast).toHaveBeenCalledWith('features.projectChat.context.focusUnavailable')
  );
  expect(io.focus).toHaveBeenCalledTimes(1);
  view.rerender(<StudioProjectAccess {...props} />);
  view.rerender(<StudioProjectAccess {...props} focusNodeId="missing" />);
  await waitFor(() => expect(io.focus).toHaveBeenCalledTimes(2));
  expect(io.props.fit).toBeUndefined();
});
it('rejects focusing a private proposal without requiring a completion callback', async () => {
  render(<StudioProjectAccess {...props} focusNodeId="node" workspaceId="private" />);
  await screen.findByRole('alert');
  await waitFor(() => expect(io.toast).toHaveBeenCalled());
  expect(io.focus).not.toHaveBeenCalled();
});
it.each(['guest', 'authenticated'])(
  'hydrates reader media for %s and revokes every allocated object URL',
  async auth => {
    if (auth === 'guest') io.user = null;
    else io.getSession.mockResolvedValue({ data: { session: { access_token: 'reader-token' } } });
    io.snapshot.assets = [
      { id: 'media', name: 'media', mime: 'image/png', url: '/api/studio/media/media' },
    ];
    const view = render(<StudioProjectAccess {...props} />);
    await loaded();
    await waitFor(() => expect(io.props.assets).toMatchObject([{ url: 'blob:reader-media' }]));
    expect(io.fetch).toHaveBeenCalledWith('/api/studio/media/media', {
      headers: auth === 'guest' ? {} : { Authorization: 'Bearer reader-token' },
    });
    view.unmount();
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url)).toEqual([
      'blob:reader-media',
    ]);
  }
);
it.each(['http', 'error-string'])(
  'reports a reader media %s failure without installing broken assets',
  async failure => {
    io.snapshot.assets = [{ id: 'media', mime: 'image/png', url: '/api/studio/media/media' }];
    io.fetch.mockImplementation(async (_url: string) =>
      failure === 'http' ? new Response('', { status: 404 }) : Promise.reject('Media offline')
    );
    render(<StudioProjectAccess {...props} />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      failure === 'http' ? 'features.studio.mediaUnavailable' : 'Media offline'
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  }
);
it.each(['blob', 'error'])(
  'does not allocate URLs or report errors when a reader media %s finishes after unmount',
  async completion => {
    let resolve!: (value: unknown) => void, reject!: (value: unknown) => void;
    const pending = new Promise((done, fail) => {
      resolve = done;
      reject = fail;
    });
    io.snapshot.assets = [{ id: 'media', mime: 'image/png', url: '/api/studio/media/media' }];
    io.fetch.mockImplementation(async (_url: string) =>
      completion === 'blob' ? { ok: true, blob: () => pending } : pending
    );
    const view = render(<StudioProjectAccess {...props} />);
    await loaded();
    await waitFor(() =>
      expect(io.fetch).toHaveBeenCalledWith('/api/studio/media/media', { headers: {} })
    );
    view.unmount();
    await act(async () =>
      completion === 'blob' ? resolve(new Blob(['late'])) : reject(new Error('Late media failure'))
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  }
);
