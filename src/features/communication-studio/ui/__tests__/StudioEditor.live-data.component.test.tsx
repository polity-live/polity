// @vitest-environment jsdom
import { io, show, useCanonicalDocument } from './StudioWorkspace.fixture';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { configuration, projection } from '@/test/studio-data-view.fixture';
import type { ComponentProps } from 'react';
import type { StudioLiveTools } from '../StudioLiveTools';
import type { StudioDataViewDialog } from '../StudioDataViewDialog';
import { openStudioPanel } from '../../logic/panel-events';
import { insertStudioDataView } from '../../logic/data-view-import';

// The complete editor renders hundreds of controls; instrumented CI runs need
// the same bounded interaction timeout as the other Studio editor suites.
vi.setConfig({ testTimeout: 15_000 });

const tools = vi.hoisted(() => ({
  live: null as ComponentProps<typeof StudioLiveTools> | null,
  data: null as ComponentProps<typeof StudioDataViewDialog> | null,
}));
vi.mock('../StudioLiveTools', () => ({
  StudioLiveTools: (props: ComponentProps<typeof StudioLiveTools>) => {
    tools.live = props;
    return (
      <div data-testid="live-data-controls">
        <button onClick={props.onInsertData}>Insert resolved data</button>
      </div>
    );
  },
}));

function insertResolvedData() {
  fireEvent.click(
    within(screen.getByTestId('live-data-controls')).getByRole('button', {
      name: 'Insert resolved data',
    })
  );
}
vi.mock('../StudioDataViewDialog', () => ({
  StudioDataViewDialog: (props: ComponentProps<typeof StudioDataViewDialog>) => {
    tools.data = props;
    return <div data-testid="data-dialog" />;
  },
}));

it('selects a live source node and inserts resolved data into the selected frame as one canonical transaction', async () => {
  useCanonicalDocument();
  const transact = io.editor.transactV3;
  io.editor.transactV3 = (change: Parameters<typeof transact>[0]) => {
    transact(change);
    return true;
  };
  await show({ projectId: 'project', groupId: null, open: vi.fn() });
  const frame = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'frame');
  const text = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'richText');
  act(() => tools.live!.onSelect!(text, frame.id));
  expect(io.canvasProps.selected).toEqual([text.id]);
  insertResolvedData();
  expect(screen.getByTestId('data-dialog')).toBeTruthy();
  expect(tools.data!.groupId).toBeNull();
  const before = io.editor.v3Value.nodes.length;
  act(() => tools.data!.onInsert(configuration(), projection));
  const added = io.editor.v3Value.nodes.slice(before);
  expect(added.length).toBeGreaterThan(1);
  expect(
    added.every(
      (node: { parentFrameId: string; liveBinding?: unknown }) =>
        node.parentFrameId === frame.id && !node.liveBinding
    )
  ).toBe(true);
  expect(io.canvasProps.selected).toEqual(added.map((node: { id: string }) => node.id));
});

it.each([true, false])('edits only the saved representation with group membership %s', grouped => {
  useCanonicalDocument();
  const frame = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'frame');
  let ids: string[] = [];
  act(() =>
    io.editor.transactV3((document: Parameters<typeof insertStudioDataView>[0]) => {
      ids = insertStudioDataView(document, frame.id, configuration(), projection);
      if (!grouped)
        document.nodes
          .filter(node => ids.includes(node.id))
          .forEach(node => {
            node.groupIds = [];
          });
      insertStudioDataView(document, frame.id, configuration('line'), projection);
    })
  );
  return show().then(() => {
    const transact = io.editor.transactV3;
    io.editor.transactV3 = (change: Parameters<typeof transact>[0]) => {
      transact(change);
      return true;
    };
    act(() => io.canvasProps.selectExact([ids[0]]));
    fireEvent.click(screen.getByRole('button', { name: 'Edit data view' }));
    expect(tools.data!.editingElement).toEqual(configuration());
    const otherIds = io.editor.v3Value.nodes
      .filter((node: { id: string }) => !ids.includes(node.id))
      .map((node: { id: string }) => node.id);
    act(() => tools.data!.onInsert(configuration('pie'), projection));
    expect(io.editor.v3Value.nodes.some((node: { id: string }) => node.id === ids[0])).toBe(false);
    expect(
      otherIds.every((id: string) =>
        io.editor.v3Value.nodes.some((node: { id: string }) => node.id === id)
      )
    ).toBe(true);
    expect(io.canvasProps.selected.length).toBeGreaterThan(1);
    if (!grouped)
      expect(
        ids
          .slice(1)
          .every(id => io.editor.v3Value.nodes.some((node: { id: string }) => node.id === id))
      ).toBe(true);
  });
});

it('rejects data insertion after edit rights are withdrawn', async () => {
  useCanonicalDocument();
  io.editor.canEdit = false;
  await show();
  insertResolvedData();
  const before = structuredClone(io.editor.v3Value);
  expect(() => tools.data!.onInsert(configuration(), projection)).toThrow('readOnly');
  expect(io.editor.v3Value).toEqual(before);
});

it('reports failed canonical transactions without changing the current selection', async () => {
  useCanonicalDocument();
  io.editor.transactV3 = vi.fn(() => false);
  await show();
  insertResolvedData();
  const before = [...io.canvasProps.selected];
  expect(() => tools.data!.onInsert(configuration(), projection)).toThrow('invalid');
  expect(io.canvasProps.selected).toEqual(before);
});

it('edits portrait geometry independently of the wide layout, including nodes without a portrait override', async () => {
  useCanonicalDocument();
  const text = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'richText');
  const wide = structuredClone(text.transform);
  await show();
  act(() => tools.live!.setPortrait(true));
  const change = {
    nodeId: text.id,
    transform: { dx: 12, dy: -5, width: 600, height: 300, rotation: 0, flipX: false, flipY: false },
  };
  act(() => io.canvasProps.applyCanvasChanges([change]));
  let edited = io.editor.v3Value.nodes.find((node: { id: string }) => node.id === text.id);
  expect(edited.transform).toEqual(wide);
  expect(edited.portrait.transform).toEqual({
    x: wide.x + 12,
    y: wide.y - 5,
    width: 600,
    height: 300,
  });
  act(() =>
    io.canvasProps.applyCanvasChanges([
      { ...change, transform: { ...change.transform, dx: 1, dy: 2 } },
    ])
  );
  edited = io.editor.v3Value.nodes.find((node: { id: string }) => node.id === text.id);
  expect(edited.portrait.transform.x).toBe(wide.x + 13);
  expect(edited.portrait.transform.y).toBe(wide.y - 3);
});

it('protects live-bound text from direct canvas edits', async () => {
  useCanonicalDocument();
  const text = io.editor.v3Value.nodes.find((node: { type: string }) => node.type === 'richText');
  text.liveBinding = {
    sourceType: 'event',
    sourceId: crypto.randomUUID(),
    field: 'title',
    format: 'text',
  };
  const before = structuredClone(text.content);
  await show();
  act(() =>
    io.canvasProps.onTextChange(text.id, [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text: 'Manual change' }],
      },
    ])
  );
  expect(
    io.editor.v3Value.nodes.find((node: { id: string }) => node.id === text.id).content
  ).toEqual(before);
});

it('uses the persisted project group for resolved data when no route group is supplied', async () => {
  useCanonicalDocument();
  io.project = { id: 'project', group_id: 'persisted-group' };
  await show({ projectId: 'project', groupId: null, open: vi.fn() });
  insertResolvedData();
  expect(tools.data!.groupId).toBe('persisted-group');
});

it('requests a portrait export from the visible portrait preview', async () => {
  useCanonicalDocument();
  await show();
  act(() => tools.live!.setPortrait(true));
  act(() => openStudioPanel('exports'));
  const exports = within(await screen.findByRole('dialog', { name: 'exports' }));
  fireEvent.click(exports.getByRole('button', { name: /^export$/i }));
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith(
      'export',
      expect.objectContaining({
        projectId: 'project',
        snapshot: { portrait: true },
      })
    )
  );
});
