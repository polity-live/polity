/* @vitest-environment jsdom */
import { io, show, useCanonicalDocument, notifyAll } from './StudioWorkspace.fixture';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStudioController } from '../../hooks/useStudioController';
import { StudioEditor } from '../StudioEditor';
import { openStudioPanel } from '../../logic/panel-events';

vi.setConfig({ testTimeout: 15000 });
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
afterEach(() => vi.unstubAllGlobals());

function Harness({ projectId = 'project' }: { projectId?: string }) {
  const controller = useStudioController('group', 'project', vi.fn());
  return <StudioEditor c={controller} projectId={projectId} groupId="group" open={vi.fn()} />;
}

it('reports an empty project clipboard when the browser exposes no clipboard API', async () => {
  useCanonicalDocument();
  io.editor.transactV3((document: { nodes: unknown[]; deliverables: unknown[] }) => {
    document.nodes = [];
    document.deliverables = [];
  });
  render(<Harness projectId={crypto.randomUUID()} />);
  fireEvent.keyDown(document.body, { key: 'v', ctrlKey: true });
  await screen.findByText('The Studio clipboard is empty.');
  expect(io.editor.v3Value.nodes).toEqual([]);
});

it('shows Canva export guidance and the server error for a failed full archive', async () => {
  useCanonicalDocument();
  io.exports = [
    {
      id: 'failed-archive',
      format: 'zip',
      status: 'failed',
      progress: 30,
      error: 'Archive interrupted',
    },
  ];
  await show();
  await screen.findByTestId('canvas');
  fireEvent.click(screen.getByRole('button', { name: 'exports' }));
  fireEvent.change(await screen.findByRole('combobox', { name: /^format$/i }), {
    target: { value: 'canva' },
  });
  expect(await screen.findByText('canvaHint')).toBeTruthy();
  expect(screen.getByText('Archive interrupted').getAttribute('role')).toBe('alert');
  expect(screen.getByText('ALL · failed · 30%')).toBeTruthy();
});

it.each([null, 'group'] as const)(
  'hands a completed image export to the statement composer for group %s',
  async groupId => {
    useCanonicalDocument();
    const assignment = vi.fn();
    const browser = window;
    const location = new Proxy(
      {},
      {
        get(_target, key) {
          return key === 'assign'
            ? assignment
            : Reflect.get(browser.location, key, browser.location);
        },
      }
    );
    // Navigation is the only replaced browser I/O; the controller, document and UI remain real.
    vi.stubGlobal(
      'window',
      new Proxy(browser, {
        get(target, key) {
          return key === 'location' ? location : Reflect.get(target, key, target);
        },
      })
    );
    io.exports = [
      {
        id: 'ready-image',
        format: 'png',
        status: 'completed',
        progress: 100,
        file_name: 'Image.png',
      },
    ];
    io.request.mockResolvedValue({
      mediaUrl: '/api/studio/published-media/ready-image',
      mediaType: 'image',
    });
    await show({ projectId: 'project', groupId, open: vi.fn() });
    act(() => openStudioPanel('exports'));
    fireEvent.click(await screen.findByRole('button', { name: 'usePost' }));
    await waitFor(() => expect(io.request).toHaveBeenCalledWith('handoff', { id: 'ready-image' }));
    expect(io.notifyError.mock.calls).toEqual([]);
    await waitFor(() =>
      expect(assignment).toHaveBeenCalledWith(
        '/create/statement' + (groupId ? '?groupId=group' : '')
      )
    );
    expect(io.request).toHaveBeenCalledWith('handoff', { id: 'ready-image' });
    expect(JSON.parse(sessionStorage.getItem('studio:post')!)).toMatchObject({
      groupId,
      projectId: 'project',
      title: 'Editable campaign',
      mediaType: 'image',
    });
  }
);

it.each(['queued', 'running'] as const)(
  'cancels a %s export through the actual controller',
  async status => {
    useCanonicalDocument();
    io.exports = [{ id: 'pending-export', format: 'png', status, progress: 12 }];
    await show();
    act(() => openStudioPanel('exports'));
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('cancel', { id: 'pending-export' })
    );
  }
);

it('leaves the public editor empty when the document hook has no cached value', async () => {
  Object.defineProperty(io.editor, 'value', { get: () => null });
  Object.defineProperty(io.editor, 'v3Value', { get: () => null });
  render(<Harness />);
  expect(screen.queryByTestId('studio-editor')).toBeNull();
  expect(screen.queryByTestId('canvas')).toBeNull();
});

it('handles empty-canvas undo and redo while respecting editable inputs and revoked editing access', async () => {
  useCanonicalDocument();
  io.editor.transactV3((document: { nodes: unknown[]; deliverables: unknown[] }) => {
    document.nodes = [];
    document.deliverables = [];
  });
  render(<Harness />);
  expect(screen.getByRole('status').textContent).toBe('The canvas is empty.');
  fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
  fireEvent.keyDown(document.body, { key: 'Z', metaKey: true, shiftKey: true });
  expect(io.editor.undo).toHaveBeenCalledTimes(1);
  expect(io.editor.redo).toHaveBeenCalledTimes(1);
  const input = document.createElement('textarea');
  document.body.appendChild(input);
  fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
  input.remove();
  act(() => {
    io.editor.canEdit = false;
    notifyAll();
  });
  fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
  fireEvent.keyDown(document.body, { key: 'v', ctrlKey: true });
  expect(io.editor.undo).toHaveBeenCalledTimes(1);
  expect(io.editor.redo).toHaveBeenCalledTimes(1);
});

it('responds to preview lifecycle events emitted outside the editor toolbar', async () => {
  useCanonicalDocument();
  await show();
  act(() => window.dispatchEvent(new CustomEvent('studio-preview')));
  expect(screen.getByRole('dialog', { name: 'previewTitle' })).toBeTruthy();
  act(() => window.dispatchEvent(new CustomEvent('studio-preview', { detail: { open: false } })));
  expect(screen.queryByRole('dialog', { name: 'previewTitle' })).toBeNull();
});

it('clears selection and its context state when an existing editor receives a new project identity', async () => {
  useCanonicalDocument();
  const view = render(<Harness projectId="first-project" />);
  await screen.findByTestId('canvas');
  const text = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'richText');
  act(() => io.canvasProps.selectExact([text.id]));
  await waitFor(() => expect(io.canvasProps.selected).toEqual([text.id]));
  view.rerender(<Harness projectId="second-project" />);
  await waitFor(() => expect(io.canvasProps.selected).toEqual([]));
});

it.each(['saving', 'loading'] as const)(
  'shows the %s document status while keeping the cached canvas available',
  async status => {
    useCanonicalDocument();
    io.editor.status = status;
    await show();
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.getAllByText('features.editor.header.saving').length).toBeGreaterThan(0);
  }
);

it('includes remote cursor presence and fallback peer identities without selecting them as canvas nodes', async () => {
  useCanonicalDocument();
  io.editor.peers = [
    { userId: 'author', user: { id: 'author', name: 'Self' } },
    {
      user: { id: 'remote', name: '', avatar: null },
      cursor: { pageId: io.editor.v3Value.nodes[0].id, x: 20, y: 30 },
    },
    { user: {} },
  ];
  await show();
  expect(io.canvasProps.selected).toEqual([]);
  expect(
    io.canvasProps.peers.some((peer: { user?: { name: string } }) => peer.user?.name === '')
  ).toBe(true);
  act(() => {
    io.editor.peers = [];
    notifyAll();
  });
  await waitFor(() => expect(io.canvasProps.peers).toEqual([]));
});
