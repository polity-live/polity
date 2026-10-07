import { io, ydoc, notifyAll, value, setup, show, setDocument } from './StudioWorkspace.fixture';
import { focusProjectEditor } from '@/features/project-chat/hooks/editor-bridge';
/* @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
// The complete editor renders hundreds of controls. Instrumented CI runs need
// time for jsdom's accessibility queries as well as the interaction assertions.
vi.setConfig({ testTimeout: 15_000 });
import { element } from '../../logic/document';
import {
  createFrameNode,
  drawingNodeSchema,
  embedNodeSchema,
  mediaNodeSchema,
  studioDocumentV3Schema,
} from '../../logic/document-v3';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { createElementSetSnapshot } from '../../logic/element-library';
import {
  createStudioV3ClipboardPayload,
  setProjectStudioClipboard,
} from '../../logic/studio-clipboard';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../../logic/v3-adapter';
import { StudioWorkspace } from '../StudioWorkspace';
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const change = (name: string, v: string) =>
  fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value: v } });
const menuNames = new Set([
  'project',
  'frame',
  'shapes',
  'line',
  'table',
  'draw',
  'zoom 100%',
  'elementAlignment',
  'distribute',
  'order',
  'groupElements',
  'text',
  'font',
  'alignment',
]);
const panel = (name: string) => {
  if (menuNames.has(name)) {
    const trigger = screen
      .getAllByRole('button', { name })
      .find(button => button.getAttribute('aria-haspopup') === 'menu');
    if (!trigger) throw new Error(`Missing menu trigger: ${name}`);
    fireEvent.pointerDown(trigger);
  } else click(name);
  return screen.getByRole(menuNames.has(name) ? 'menu' : 'dialog');
};
const close = () => {
  const surface =
    screen.queryByRole('menu') ??
    screen.queryAllByRole('dialog').find(d => d.getAttribute('aria-label') !== 'properties');
  if (surface) fireEvent.keyDown(surface, { key: 'Escape' });
};
const selectText = () => {
  const e = value().pages[0].elements.find(e => e.type === 'text')!;
  click(`Select text ${e.id}`);
  return e;
};
function addElementsAnchor() {
  const navigation = document.createElement('nav');
  navigation.dataset.navigationType = 'secondary';
  const anchor = document.createElement('button');
  anchor.dataset.navigationItemId = 'studio-elements';
  navigation.append(anchor);
  document.body.append(navigation);
  vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue({
    x: 960,
    y: 0,
    left: 960,
    top: 0,
    right: 1024,
    bottom: 768,
    width: 64,
    height: 768,
    toJSON: () => ({}),
  });
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
    x: 968,
    y: 128,
    left: 968,
    top: 128,
    right: 1016,
    bottom: 176,
    width: 48,
    height: 48,
    toJSON: () => ({}),
  });
  return { navigation, anchor };
}
describe('Studio toolbar workflows', () => {
  it('shows compact Elements rows with accessible actions and a native drag source', async () => {
    const set = {
      id: crypto.randomUUID(),
      name: 'Test element',
      scope: 'group',
      revisionId: crypto.randomUUID(),
      version: 2,
      width: 120,
      height: 80,
      updatedAt: Date.now(),
    };
    io.request.mockImplementation(async (op: string) => (op === 'elementSets' ? [set] : []));
    await show();
    const { navigation } = addElementsAnchor();
    await act(async () =>
      window.dispatchEvent(
        new CustomEvent('studio-open-panel', {
          detail: {
            panelKey: 'elements',
            origin: 'secondary-navigation',
            navigationItemId: 'studio-elements',
          },
        })
      )
    );
    const dialog = await screen.findByRole('dialog', { name: 'elements' });
    const row = within(dialog).getByText(set.name).closest('article')!;
    expect(row.draggable).toBe(true);
    expect(row.textContent).toContain('v2');
    expect(within(dialog).queryByText('dropSelectionHere')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'publishElementChanges' })).toBeNull();
    const search = within(dialog).getByRole('searchbox', { name: 'searchElements' });
    fireEvent.change(search, { target: { value: 'missing' } });
    expect(within(dialog).queryByText(set.name)).toBeNull();
    expect(within(dialog).getByText('noElementsFound')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'TEST' } });
    expect(within(dialog).getByText(set.name)).toBeTruthy();
    const dataTransfer = { effectAllowed: '', setData: vi.fn() };
    fireEvent.dragStart(within(dialog).getByText(set.name).closest('article')!, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-polity-element-set', set.id);
    vi.spyOn(window, 'prompt').mockReturnValue('Renamed element');
    fireEvent.click(within(dialog).getByRole('button', { name: `rename: ${set.name}` }));
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('elementSetRename', {
        setId: set.id,
        name: 'Renamed element',
      })
    );
    fireEvent.click(within(dialog).getByRole('button', { name: `delete: ${set.name}` }));
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('elementSetArchive', { setId: set.id })
    );
    navigation.remove();
  });

  it('copies canvas selection onto the Elements sidebar button and preserves normal moves elsewhere', async () => {
    const commit = vi.spyOn(io.editor, 'commit');
    await show();
    const { navigation, anchor } = addElementsAnchor();
    const selected = selectText();
    expect(io.canvasProps.onNodeDragEnd(selected.id, [selected.id], 200, 200)).toBe(false);
    expect(io.canvasProps.onNodeDragEnd(value().pages[0].id, [value().pages[0].id], 990, 150)).toBe(
      false
    );
    io.canvasProps.onNodeDragMove(selected.id, [selected.id], 990, 150);
    expect(anchor.getAttribute('data-studio-drop-active')).toBe('true');
    await act(async () => {
      expect(io.canvasProps.onNodeDragEnd(selected.id, [selected.id], 990, 150)).toBe(true);
    });
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('elementSetCreate', {
        projectId: 'project',
        groupId: 'group',
        selectedIds: [selected.id],
      })
    );
    expect(commit).toHaveBeenCalled();
    expect(anchor.hasAttribute('data-studio-drop-active')).toBe(false);
    expect(await screen.findByRole('dialog', { name: 'elements' })).toBeTruthy();
    const second = value().pages[0].elements.find(element => element.id !== selected.id)!;
    await act(async () => {
      expect(io.canvasProps.onNodeDragEnd(selected.id, [selected.id, second.id], 990, 150)).toBe(
        true
      );
    });
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('elementSetCreate', {
        projectId: 'project',
        groupId: 'group',
        selectedIds: [selected.id, second.id],
      })
    );
    navigation.remove();
  });

  it('copies a canvas node dropped into the open Elements menu', async () => {
    await show();
    const { navigation } = addElementsAnchor();
    await act(async () =>
      window.dispatchEvent(
        new CustomEvent('studio-open-panel', {
          detail: {
            panelKey: 'elements',
            origin: 'secondary-navigation',
            navigationItemId: 'studio-elements',
          },
        })
      )
    );
    const dialog = await screen.findByRole('dialog', { name: 'elements' });
    const dropZone = dialog.querySelector<HTMLElement>('[data-studio-elements-drop-zone]')!;
    fireEvent.pointerDown(screen.getByTestId('canvas'));
    expect(screen.getByRole('dialog', { name: 'elements' })).toBeTruthy();
    vi.spyOn(dropZone, 'getBoundingClientRect').mockReturnValue({
      x: 600,
      y: 100,
      left: 600,
      top: 100,
      right: 900,
      bottom: 500,
      width: 300,
      height: 400,
      toJSON: () => ({}),
    });
    const selected = selectText();
    io.canvasProps.onNodeDragMove(selected.id, [selected.id], 700, 200);
    expect(dropZone.getAttribute('data-studio-drop-active')).toBe('true');
    await act(async () => {
      expect(io.canvasProps.onNodeDragEnd(selected.id, [selected.id], 700, 200)).toBe(true);
    });
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('elementSetCreate', {
        projectId: 'project',
        groupId: 'group',
        selectedIds: [selected.id],
      })
    );
    expect(dropZone.hasAttribute('data-studio-drop-active')).toBe(false);
    navigation.remove();
  });

  it('inserts a dropped library element at frame-local coordinates on a shifted canvas frame', async () => {
    setup('carousel');
    const canonical = legacyDocumentToV3(value());
    const frames = canonical.nodes.filter(node => node.type === 'frame' && !node.parentFrameId);
    const source = canonical.nodes.find(node => node.parentFrameId === frames[0].id)!;
    const target = frames[1];
    const setId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const snapshot = createElementSetSnapshot(canonical, [source.id]);
    const set = {
      id: setId,
      name: 'Reusable',
      scope: 'group',
      revisionId,
      version: 1,
      width: snapshot.width,
      height: snapshot.height,
      updatedAt: Date.now(),
    };
    io.request.mockImplementation(async (op: string) => {
      if (op === 'elementSets') return [set];
      if (op === 'elementSetInstantiate') return { setId, revisionId, snapshot, assetIds: {} };
      return [];
    });
    await show();
    const before = value().pages.find(page => page.id === target.id)!.elements.length;
    await act(async () =>
      io.canvasProps.onElementSetDrop(setId, {
        x: target.transform.x + 140,
        y: target.transform.y + 90,
        targetFrameId: target.id,
      })
    );
    await waitFor(() =>
      expect(value().pages.find(page => page.id === target.id)!.elements).toHaveLength(before + 1)
    );
    const inserted = value()
      .pages.find(page => page.id === target.id)!
      .elements.at(-1)!;
    expect(inserted.x).toBeCloseTo(140);
    expect(inserted.y).toBeCloseTo(90);
    expect(io.request).toHaveBeenCalledWith('elementSetInstantiate', {
      setId,
      projectId: 'project',
    });
  });
  it('keeps project overview and creation available', async () => {
    io.loading = true;
    const ui = await show({ open: vi.fn() });
    expect(screen.getByText('loading')).toBeTruthy();
    io.loading = false;
    await act(async () => ui.rerender(<StudioWorkspace open={vi.fn()} />));
    expect(screen.getByRole('link', { name: 'create' }).getAttribute('href')).toBe(
      '/create/studio-project'
    );
  });
  it('shows storage status and peers without a permanent sidebar', async () => {
    await show();
    expect(screen.getByRole('status').textContent).toBe('All changes saved');
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Peer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'invite' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Shared project chat' })).toBeTruthy();
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ai' })).toBeNull();
    expect(io.projectChat).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'studio', projectId: 'project' },
        context: expect.objectContaining({ surface: 'studio' }),
      })
    );
  });
  it('opens collaborator invitations only for the owner of a personal Studio project', async () => {
    io.project = { id: 'project', owner_id: 'author', group_id: null, kind: 'single' };
    const ui = await show({ projectId: 'project', open: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'invite' }));
    expect(await screen.findByRole('dialog', { name: 'inviteCollaborators' })).toBeTruthy();
    ui.unmount();

    io.project = { id: 'project', owner_id: 'other', group_id: null, kind: 'single' };
    await show({ projectId: 'project', open: vi.fn() });
    expect(screen.queryByRole('button', { name: 'invite' })).toBeNull();
  });
  it('renders one icon toolbar and a separate compact project status row', async () => {
    ydoc.pages[0].name = 'Different page name';
    await show();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    const toolbar = screen.getByRole('toolbar', { name: 'tools' });
    for (const name of [
      'selection',
      'hand',
      'text',
      'line',
      'chart',
      'table',
      'upload',
      'Undo',
      'redo',
      'guides',
    ]) {
      const control = within(toolbar).getByRole('button', { name });
      expect(control.querySelector('svg')).toBeTruthy();
      expect(control.textContent).toBe('');
    }
    expect(within(toolbar).queryByRole('button', { name: 'insert' })).toBeNull();
    const statusRow = screen.getByLabelText('projectStatus');
    expect(statusRow.className).toContain('scrollbar-hide');
    expect(within(statusRow).queryByText('Different page name')).toBeNull();
    expect(screen.queryByPlaceholderText('Find text')).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: 'more' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: 'captions' })).toBeNull();
  });
  it('dispatches canvas tools and zoom through the typed canvas handle', async () => {
    await show();
    click('hand');
    expect(io.canvasExecute).toHaveBeenLastCalledWith({
      type: 'setTool',
      tool: 'hand',
      locked: false,
    });
    const shapes = panel('shapes');
    fireEvent.click(within(shapes).getByRole('menuitem', { name: 'rectangle' }));
    expect(io.canvasExecute).toHaveBeenLastCalledWith({
      type: 'setTool',
      tool: 'rectangle',
      locked: false,
    });
    close();
    const zoom = panel('zoom 100%');
    fireEvent.click(within(zoom).getByRole('menuitem', { name: '100 %' }));
    expect(io.canvasExecute).toHaveBeenLastCalledWith({ type: 'zoom', mode: 'reset' });
  });
  it('keeps line tools in their menu and inserts charts and sized tables from toolbar buttons', async () => {
    await show();
    for (const tool of ['line', 'arrow']) {
      const lines = panel('line');
      fireEvent.click(within(lines).getByRole('menuitem', { name: tool }));
      expect(io.canvasExecute).toHaveBeenLastCalledWith({
        type: 'setTool',
        tool,
        locked: false,
      });
    }
    click('chart');
    expect(value().pages[0].elements.at(-1)?.type).toBe('chart');

    const tableMenu = panel('table');
    const picker = within(tableMenu).getByRole('button', { name: 'tableSize: 0 x 0' });
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.keyDown(picker, { key: 'ArrowRight' });
    fireEvent.keyDown(picker, { key: 'Enter' });
    const table = value().pages[0].elements.at(-1);
    expect(table?.type).toBe('table');
    expect(table?.table?.rows).toHaveLength(1);
    expect(table?.table?.widths).toHaveLength(2);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it.each(['font', 'alignment', 'bulletList', 'numberedList', 'link'])(
    'formats selected text through the %s menu',
    async action => {
      await show();
      const selected = selectText();
      const current = () => value().pages[0].elements.find(element => element.id === selected.id)!;

      if (action === 'font') {
        fireEvent.click(within(panel('font')).getByRole('menuitemradio', { name: 'Inter' }));
        expect(current().font).toBe('Inter');
      } else if (action === 'alignment') {
        fireEvent.click(within(panel('alignment')).getByRole('menuitemradio', { name: 'right' }));
        expect(current().align).toBe('right');
      } else if (action === 'bulletList' || action === 'numberedList') {
        fireEvent.click(within(panel('text')).getByRole('menuitem', { name: action }));
        expect(
          current().richText.every(
            paragraph => paragraph.list === (action === 'bulletList' ? 'bullet' : 'number')
          )
        ).toBe(true);
      } else {
        fireEvent.click(within(panel('text')).getByRole('menuitem', { name: 'link' }));
        const url = screen.getByRole('textbox', { name: 'link' });
        fireEvent.change(url, { target: { value: 'https://example.org' } });
        fireEvent.keyDown(url, { key: 'Enter' });
        expect(
          current().richText.some(paragraph =>
            paragraph.children.some(run => run.url === 'https://example.org')
          )
        ).toBe(true);
      }
    }
  );
  it('opens automation-targeted menus and returns focus on Escape', async () => {
    await show();
    selectText();
    for (const key of ['project', 'table', 'text']) {
      const trigger = screen
        .getAllByRole('button', { name: key })
        .find(button => button.getAttribute('aria-haspopup') === 'menu')!;
      trigger.focus();
      await act(async () => {
        window.dispatchEvent(new CustomEvent('studio-open-panel', { detail: key }));
      });
      const menu = await screen.findByRole('menu');
      if (key === 'table') {
        expect(within(menu).getByRole('button', { name: 'tableSize: 0 x 0' })).toBeTruthy();
      } else {
        expect(menu.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
      }
      fireEvent.keyDown(menu, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(trigger);
    }
    const alignTrigger = screen.getByRole('button', { name: 'elementAlignment' });
    alignTrigger.focus();
    await act(async () => {
      window.dispatchEvent(new CustomEvent('studio-open-panel', { detail: 'arrange' }));
    });
    const alignMenu = await screen.findByRole('menu');
    expect(within(alignMenu).getByRole('menuitem', { name: 'center' })).toBeTruthy();
    fireEvent.keyDown(alignMenu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(alignTrigger);
  });
  it('anchors secondary-navigation panels to the right sidebar and keeps only one open', async () => {
    await show();
    const navigation = document.createElement('nav');
    navigation.dataset.navigationType = 'secondary';
    const layersAnchor = document.createElement('button');
    layersAnchor.dataset.navigationItemId = 'studio-frames';
    const themeAnchor = document.createElement('button');
    themeAnchor.dataset.navigationItemId = 'studio-assets';
    navigation.append(layersAnchor, themeAnchor);
    document.body.append(navigation);
    Object.defineProperty(navigation, 'getBoundingClientRect', {
      value: () => ({
        width: 64,
        height: 768,
        left: 960,
        right: 1024,
        top: 0,
        bottom: 768,
        x: 960,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    for (const [index, anchor] of [layersAnchor, themeAnchor].entries())
      Object.defineProperty(anchor, 'getBoundingClientRect', {
        value: () => ({
          width: 48,
          height: 48,
          left: 968,
          right: 1016,
          top: 16 + index * 56,
          bottom: 64 + index * 56,
          x: 968,
          y: 16 + index * 56,
          toJSON: () => ({}),
        }),
      });

    layersAnchor.focus();
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('studio-open-panel', {
          detail: {
            panelKey: 'pages',
            origin: 'secondary-navigation',
            navigationItemId: 'studio-frames',
          },
        })
      );
    });
    const layers = await screen.findByRole('dialog', { name: 'layers' });
    expect(layers.getAttribute('data-side')).toBe('left');

    themeAnchor.focus();
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('studio-open-panel', {
          detail: {
            panelKey: 'theme',
            origin: 'secondary-navigation',
            navigationItemId: 'studio-assets',
          },
        })
      );
    });
    expect(screen.queryByRole('dialog', { name: 'layers' })).toBeNull();
    const theme = await screen.findByRole('dialog', { name: 'theme' });
    expect(theme.getAttribute('data-side')).toBe('left');
    fireEvent.keyDown(theme, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'theme' })).toBeNull());
    expect(document.activeElement).toBe(themeAnchor);
    navigation.remove();
  });
  it('formats selected text in the inline inspector without a second properties menu', async () => {
    await show();
    const e = selectText();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'properties' })).getByRole('button', {
        name: 'bold',
      })
    );
    expect(value().pages[0].elements.find(x => x.id === e.id)?.bold).toBe(!e.bold);
    const props = screen.getByRole('region', { name: 'properties' });
    fireEvent.change(within(props).getByLabelText('width'), { target: { value: '-1' } });
    expect(value().pages[0].elements.find(x => x.id === e.id)?.width).toBe(e.width);
    expect(screen.getByRole('region', { name: 'properties' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'properties' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'properties' })).toBeNull();
  });
  it.each([
    'rect',
    'arrow',
    'text',
    'image',
    'table',
    'chart',
    'frame',
    'audio',
    'file',
    'drawing',
    'embed',
  ])('opens and edits properties for the canonical %s element', async kind => {
    let canonical = legacyDocumentToV3(ydoc);
    const root = canonical.nodes.find(node => node.type === 'frame' && !node.parentFrameId)!;
    const base = createFrameNode('custom', {
      id: crypto.randomUUID(),
      name: 'Nested frame',
      parentFrameId: root.id,
      transform: { x: 30, y: 30, width: 300, height: 200, rotation: 0 },
      zIndex: 50,
    });
    const semantic = [
      element('rect'),
      element('arrow'),
      element('text'),
      element('image', { assetId: crypto.randomUUID() }),
      element('table'),
      element('chart'),
    ].map((item, index) => createStudioNodeFromElement(item, root.id, 10 + index));
    const extra = [
      base,
      mediaNodeSchema.parse({
        ...base,
        id: crypto.randomUUID(),
        name: 'Audio',
        type: 'media',
        mediaType: 'audio',
        assetId: crypto.randomUUID(),
      }),
      mediaNodeSchema.parse({
        ...base,
        id: crypto.randomUUID(),
        name: 'File',
        type: 'media',
        mediaType: 'file',
        assetId: crypto.randomUUID(),
      }),
      drawingNodeSchema.parse({
        ...base,
        id: crypto.randomUUID(),
        name: 'Drawing',
        type: 'drawing',
        points: [
          [0, 0],
          [10, 10],
        ],
      }),
      embedNodeSchema.parse({
        ...base,
        id: crypto.randomUUID(),
        name: 'Embed',
        type: 'embed',
        provider: 'code',
        value: 'example',
      }),
    ];
    canonical = studioDocumentV3Schema.parse({
      ...canonical,
      nodes: [...canonical.nodes, ...semantic, ...extra],
    });
    Object.defineProperty(io.editor, 'v3Value', {
      configurable: true,
      get: () => structuredClone(canonical),
    });
    Object.defineProperty(io.editor, 'value', {
      configurable: true,
      get: () => v3DocumentToLegacy(canonical),
    });
    io.editor.transactV3 = (change: (document: typeof canonical) => void) => {
      change(canonical);
      canonical = studioDocumentV3Schema.parse(canonical);
      notifyAll();
    };
    await show();
    const node = [...semantic, ...extra][
      [
        'rect',
        'arrow',
        'text',
        'image',
        'table',
        'chart',
        'frame',
        'audio',
        'file',
        'drawing',
        'embed',
      ].indexOf(kind)
    ];
    act(() => io.canvasProps.selectExact([node.id]));
    expect(io.canvasProps.inspector, node.type).toBeTruthy();
    const inspector = screen.getByRole('region', { name: 'properties' });
    if (node.type === 'shape' && node.shape === 'arrow') {
      fireEvent.change(within(inspector).getByLabelText('endArrowhead'), {
        target: { value: 'bar' },
      });
      expect(canonical.nodes.find(candidate => candidate.id === node.id)).toMatchObject({
        endArrowhead: 'bar',
      });
    }
    if (node.type === 'frame') {
      fireEvent.change(within(inspector).getByLabelText('width'), { target: { value: '420' } });
      expect(canonical.nodes.find(candidate => candidate.id === node.id)?.transform.width).toBe(
        420
      );
    }
    if (node.type === 'media' && node.mediaType === 'audio') {
      fireEvent.change(within(inspector).getByLabelText('text'), {
        target: { value: 'Interview' },
      });
      expect(canonical.nodes.find(candidate => candidate.id === node.id)).toMatchObject({
        alt: 'Interview',
      });
    }
    if (kind === 'embed') {
      fireEvent.change(within(inspector).getByLabelText('name'), {
        target: { value: 'Updated embed' },
      });
      expect(canonical.nodes.find(candidate => candidate.id === node.id)?.name).toBe(
        'Updated embed'
      );
    }
  });
  it('aligns through selection tools using the chosen reference', async () => {
    await show();
    selectText();
    const alignmentMenu = panel('elementAlignment');
    fireEvent.click(within(alignmentMenu).getByRole('menuitemradio', { name: 'view' }));
    expect(
      within(panel('elementAlignment'))
        .getByRole('menuitemradio', { name: 'view' })
        .getAttribute('aria-checked')
    ).toBe('true');
    close();
    panel('elementAlignment');
    fireEvent.click(screen.getByRole('menuitem', { name: 'center' }));
    const e = value().pages[0].elements.find(e => e.type === 'text')!;
    expect(e.x).toBe((100 + 900 - e.width) / 2);
  });
  it('duplicates and deletes through selection tools', async () => {
    await show();
    selectText();
    const count = value().pages[0].elements.length;
    click('duplicate');
    expect(value().pages[0].elements.length).toBe(count + 1);
    click('remove');
    expect(value().pages[0].elements.length).toBe(count);
  });
  it('embeds shared references in alignment and distribution menus and disables unavailable choices', async () => {
    await show();
    const toolbar = screen.getByRole('toolbar', { name: 'tools' });
    expect(within(toolbar).queryByRole('button', { name: 'arrange' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: 'reference' })).toBeNull();

    const alignmentMenu = panel('elementAlignment');
    expect(within(alignmentMenu).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(
      within(alignmentMenu)
        .getByRole('menuitemradio', { name: 'view' })
        .getAttribute('data-disabled')
    ).not.toBeNull();
    expect(
      within(alignmentMenu)
        .getByRole('menuitemradio', { name: 'frame' })
        .getAttribute('data-disabled')
    ).not.toBeNull();
    expect(within(alignmentMenu).getAllByRole('menuitem')).toHaveLength(6);
    expect(
      within(alignmentMenu).getByRole('menuitem', { name: 'left' }).getAttribute('data-disabled')
    ).not.toBeNull();
    close();

    const distributeMenu = panel('distribute');
    expect(within(distributeMenu).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(within(distributeMenu).getAllByRole('menuitem')).toHaveLength(2);
    expect(
      within(distributeMenu)
        .getByRole('menuitem', { name: 'distribute horizontal' })
        .getAttribute('data-disabled')
    ).not.toBeNull();
    close();

    const orderMenu = panel('order');
    expect(within(orderMenu).getAllByRole('menuitem')).toHaveLength(4);
    expect(
      within(orderMenu).getByRole('menuitem', { name: 'front' }).getAttribute('data-disabled')
    ).not.toBeNull();
    close();

    const groupMenu = panel('groupElements');
    expect(within(groupMenu).getAllByRole('menuitem')).toHaveLength(2);
    expect(
      within(groupMenu)
        .getByRole('menuitem', { name: 'groupElements' })
        .getAttribute('data-disabled')
    ).not.toBeNull();
    expect(within(groupMenu).queryByRole('menuitem', { name: 'lock' })).toBeNull();
    expect(within(groupMenu).queryByRole('menuitem', { name: 'unlock' })).toBeNull();
    expect(within(toolbar).getByRole('button', { name: 'lock' })).toBeTruthy();
  });
  it.each(['view', 'frame'])(
    'shares the %s reference from alignment to distribution',
    async reference => {
      await show();
      selectText();
      fireEvent.click(
        within(panel('elementAlignment')).getByRole('menuitemradio', { name: reference })
      );
      const distributeMenu = panel('distribute');
      expect(
        within(distributeMenu)
          .getByRole('menuitemradio', { name: reference })
          .getAttribute('aria-checked')
      ).toBe('true');
    }
  );
  it('shares the distribution reference with alignment and resets it on deselection', async () => {
    await show();
    selectText();
    const distributeMenu = panel('distribute');
    fireEvent.click(within(distributeMenu).getByRole('menuitemradio', { name: 'frame' }));
    expect(
      within(panel('elementAlignment'))
        .getByRole('menuitemradio', { name: 'frame' })
        .getAttribute('aria-checked')
    ).toBe('true');
    close();
    act(() => io.canvasProps.selectExact([]));
    expect(
      within(panel('distribute'))
        .getByRole('menuitemradio', { name: 'selection' })
        .getAttribute('aria-checked')
    ).toBe('true');
  });
  it('searches and operates the canonical frame tree through the Layers popover', async () => {
    setup('carousel');
    ydoc.pages[1].elements[0].text = 'Unique layer needle';
    await show();
    const canonical = legacyDocumentToV3(value());
    const frames = canonical.nodes.filter(node => node.type === 'frame' && !node.parentFrameId);
    const targetFrame = frames[1];
    const target = canonical.nodes.find(
      node => node.parentFrameId === targetFrame.id && node.name === 'Unique layer needle'
    )!;
    const p = panel('layers');

    const frameRow = within(p)
      .getAllByRole('treeitem')
      .find(row => row.getAttribute('data-studio-layer-id') === targetFrame.id)!;
    const targetRow = within(p)
      .getAllByRole('treeitem')
      .find(row => row.getAttribute('data-studio-layer-id') === target.id)!;
    expect(frameRow.getAttribute('aria-level')).toBe('1');
    expect(targetRow.getAttribute('aria-level')).toBe('2');

    fireEvent.click(within(targetRow).getByRole('button', { name: target.name }));
    expect(screen.getByTestId('canvas').getAttribute('data-page-id')).toBe(targetFrame.id);

    fireEvent.click(within(targetRow).getByRole('button', { name: `hide: ${target.name}` }));
    expect(legacyDocumentToV3(value()).nodes.find(node => node.id === target.id)?.visible).toBe(
      false
    );

    const updatedRow = within(p)
      .getAllByRole('treeitem')
      .find(row => row.getAttribute('data-studio-layer-id') === target.id)!;
    fireEvent.click(within(updatedRow).getByRole('button', { name: `lock: ${target.name}` }));
    expect(legacyDocumentToV3(value()).nodes.find(node => node.id === target.id)?.locked).toBe(
      true
    );
    const toolbar = screen.getByRole('toolbar', { name: 'tools' });
    const topbarUnlock = within(toolbar).getByRole('button', { name: 'unlock' });
    expect(topbarUnlock.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(topbarUnlock);
    expect(legacyDocumentToV3(value()).nodes.find(node => node.id === target.id)?.locked).toBe(
      false
    );
    expect(
      within(
        within(p)
          .getAllByRole('treeitem')
          .find(row => row.getAttribute('data-studio-layer-id') === target.id)!
      ).getByRole('button', { name: `lock: ${target.name}` })
    ).toBeTruthy();

    fireEvent.change(within(p).getByRole('searchbox', { name: 'searchLayers' }), {
      target: { value: target.name },
    });
    expect(
      within(p)
        .getAllByRole('treeitem')
        .map(row => row.getAttribute('data-studio-layer-id'))
    ).toEqual([targetFrame.id, target.id]);
    expect(within(p).queryByLabelText('name')).toBeNull();
    expect(within(p).queryByRole('button', { name: 'addPage' })).toBeNull();
  });
  it.each(['frame', 'richText'] as const)(
    'renames a %s through Layers without modifying its content or geometry',
    async type => {
      setup('carousel');
      let canonical = legacyDocumentToV3(value());
      Object.defineProperty(io.editor, 'v3Value', { get: () => canonical });
      io.editor.transactV3 = vi.fn((change: (document: typeof canonical) => void) => {
        const next = structuredClone(canonical);
        change(next);
        canonical = studioDocumentV3Schema.parse(next);
        setDocument(v3DocumentToLegacy(canonical));
        notifyAll();
      });
      const before = structuredClone(canonical);
      const target = before.nodes.find(node => node.type === type)!;
      await show();
      const p = panel('layers');
      const row = within(p)
        .getAllByRole('treeitem')
        .find(row => row.getAttribute('data-studio-layer-id') === target.id)!;
      fireEvent.click(within(row).getByRole('button', { name: `rename: ${target.name}` }));
      const input = within(row).getByRole('textbox');
      fireEvent.change(input, { target: { value: '  Campaign layer  ' } });
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'Delete' });
      expect(canonical).toEqual(before);
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
      expect(canonical).toEqual({
        ...before,
        nodes: before.nodes.map(node =>
          node.id === target.id ? { ...node, name: 'Campaign layer' } : node
        ),
      });
      expect(io.editor.transactV3).toHaveBeenCalledTimes(1);
      const renamedRow = within(p)
        .getAllByRole('treeitem')
        .find(row => row.getAttribute('data-studio-layer-id') === target.id)!;
      expect(renamedRow.getAttribute('aria-selected')).toBe('true');
      fireEvent.change(within(p).getByRole('searchbox'), { target: { value: 'Campaign layer' } });
      expect(within(p).getByRole('button', { name: 'Campaign layer' })).toBeTruthy();
      expect(within(p).getByRole('button', { name: 'hide: Campaign layer' })).toBeTruthy();
      expect(within(p).getByRole('button', { name: 'lock: Campaign layer' })).toBeTruthy();
    }
  );
  it('moves layers into frames and reorders root frames with drag and drop', async () => {
    setup('carousel');
    await show();
    const canonical = legacyDocumentToV3(value());
    const frames = canonical.nodes.filter(node => node.type === 'frame' && !node.parentFrameId);
    const source = canonical.nodes.find(node => node.parentFrameId === frames[0].id)!;
    const p = panel('layers');
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => source.id),
    };
    const row = (id: string) =>
      within(p)
        .getAllByRole('treeitem')
        .find(item => item.getAttribute('data-studio-layer-id') === id)!;

    fireEvent.dragStart(row(source.id), { dataTransfer });
    const destinationFrame = row(frames[1].id);
    vi.spyOn(destinationFrame, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      bottom: 400,
      left: 0,
      right: 320,
      width: 320,
      height: 600,
      x: 0,
      y: -200,
      toJSON: () => ({}),
    });
    fireEvent.dragOver(destinationFrame, { clientY: 116, dataTransfer });
    const destinationDrop = row(frames[1].id);
    vi.spyOn(destinationDrop, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      bottom: 400,
      left: 0,
      right: 320,
      width: 320,
      height: 600,
      x: 0,
      y: -200,
      toJSON: () => ({}),
    });
    fireEvent.drop(destinationDrop, { clientY: 116, dataTransfer });
    expect(
      legacyDocumentToV3(value()).nodes.find(node => node.id === source.id)?.parentFrameId
    ).toBe(frames[1].id);

    const movedFrame = row(frames[0].id);
    const firstFrame = row(frames[1].id);
    vi.spyOn(firstFrame, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 232,
      left: 0,
      right: 320,
      width: 320,
      height: 32,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    fireEvent.dragStart(movedFrame, { dataTransfer });
    fireEvent.dragOver(firstFrame, { clientY: 201, dataTransfer });
    const firstFrameDrop = row(frames[1].id);
    vi.spyOn(firstFrameDrop, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 232,
      left: 0,
      right: 320,
      width: 320,
      height: 32,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    fireEvent.drop(firstFrameDrop, { clientY: 201, dataTransfer });
    const reordered = legacyDocumentToV3(value());
    expect(reordered.nodes.find(node => node.id === frames[1].id)?.zIndex).toBeLessThan(
      reordered.nodes.find(node => node.id === frames[0].id)!.zIndex
    );
  });
  it('uploads media from its toolbar button and keeps a failed image edit open', async () => {
    const asset = crypto.randomUUID();
    io.editor.assets = [{ id: asset, url: 'http://localhost:3000/image.png' }];
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    await show();
    const fileInput = document.querySelector(
      'input[type="file"][aria-label="upload"]'
    ) as HTMLInputElement;
    const openFileDialog = vi.spyOn(fileInput, 'click');
    click('upload');
    expect(openFileDialog).toHaveBeenCalledOnce();
    fireEvent.change(fileInput, {
      target: { files: [new File(['image'], 'image.png')] },
    });
    await waitFor(() => expect(io.upload).toHaveBeenCalled());
    const image = value().pages[0].elements.find(element => element.type === 'image');
    expect(image).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: `Select image ${image!.id}` }));
    const properties = screen.getByRole('region', { name: 'properties' });
    fireEvent.click(within(properties).getByRole('button', { name: 'editImage' }));
    io.upload.mockRejectedValueOnce(new Error('Upload rejected'));
    click('Save image');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Upload rejected'));
    expect(screen.getByRole('button', { name: 'Save image' })).toBeTruthy();
  });
  it('exports a confirmed JSON revision and lists export status', async () => {
    io.editor.commit = vi.fn().mockResolvedValue(7);
    io.exports = [
      { id: 'job', format: 'png', status: 'completed', progress: 100, file_name: 'Frames.zip' },
    ];
    await show();
    panel('exports');
    click('export');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('export', {
        projectId: 'project',
        format: 'png',
        pageIds: [ydoc.pages[0].id],
        revision: 7,
      })
    );
    expect(screen.getByRole('button', { name: 'download' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'usePost' })).toBeNull();
  });
  it('searches frames, marks the selected frame, and exports only checked frames', async () => {
    setup('single');
    ydoc.pages.push({
      ...structuredClone(ydoc.pages[0]),
      id: crypto.randomUUID(),
      order: 1,
      elements: ydoc.pages[0].elements.map(item => ({
        ...structuredClone(item),
        id: crypto.randomUUID(),
      })),
    });
    ydoc.pages.forEach((page, index) => {
      page.name = `Export frame ${index + 1}`;
    });
    await show();
    panel('exports');
    expect(screen.getByRole('option', { name: 'ALL' }).getAttribute('value')).toBe('zip');
    const list = screen.getByRole('group', { name: 'exportFrames' });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(ydoc.pages.length);
    expect(
      within(list)
        .getAllByRole('checkbox')
        .every(box => (box as HTMLInputElement).checked)
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'markSelectedFrame' }) as HTMLButtonElement).disabled
    ).toBe(true);
    change('searchExportFrames', 'Export frame 2');
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(within(list).getByRole('checkbox'));
    change('searchExportFrames', '');
    expect((within(list).getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(false);
    click('markAllFrames');
    expect(
      within(list)
        .getAllByRole('checkbox')
        .every(box => (box as HTMLInputElement).checked)
    ).toBe(true);
    for (const box of within(list).getAllByRole('checkbox')) fireEvent.click(box);
    expect((screen.getByRole('button', { name: 'export' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    act(() => io.canvasProps.selectExact([ydoc.pages[1].id]));
    click('markSelectedFrame');
    expect((within(list).getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(true);
    click('export');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'export',
        expect.objectContaining({ pageIds: [ydoc.pages[1].id] })
      )
    );
  });
  it('shows preparation immediately and then animates queued and running progress', async () => {
    let confirm!: (revision: number) => void;
    io.editor.commit = vi.fn().mockImplementation(
      () =>
        new Promise<number>(resolve => {
          confirm = resolve;
        })
    );
    let statusCalls = 0;
    io.request.mockImplementation(async (op: string) => {
      if (op === 'export') return { id: 'new-job' };
      if (op === 'exportStatus') {
        statusCalls++;
        return statusCalls === 1
          ? { id: 'new-job', format: 'png', status: 'queued', progress: 0, error: null }
          : { id: 'new-job', format: 'png', status: 'running', progress: 45, error: null };
      }
      return [];
    });
    await show();
    panel('exports');
    click('export');
    expect(
      screen.getAllByRole('status').some(status => status.textContent?.includes('preparingExport'))
    ).toBe(true);
    await act(async () => confirm(7));
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy());
    await waitFor(
      () => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('45'),
      { timeout: 4000 }
    );
    expect(screen.getByText(/PNG · running · 45%/)).toBeTruthy();
  });
  it('downloads a newly completed export once and keeps manual download available', async () => {
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    io.request.mockImplementation(async (op: string) => {
      if (op === 'export') return { id: 'new-job' };
      if (op === 'exportStatus')
        return {
          id: 'new-job',
          format: 'png',
          status: 'completed',
          progress: 100,
          error: null,
          fileName: 'Selected-frames.zip',
        };
      return [];
    });
    await show();
    panel('exports');
    click('export');
    await waitFor(() => expect(clicked).toHaveBeenCalledTimes(1));
    expect((clicked.mock.instances[0] as HTMLAnchorElement).getAttribute('href')).toBe(
      '/api/studio/exports/new-job'
    );
    expect((clicked.mock.instances[0] as HTMLAnchorElement).download).toBe('Selected-frames.zip');
    click('download');
    expect(clicked).toHaveBeenCalledTimes(2);
    expect((clicked.mock.instances[1] as HTMLAnchorElement).download).toBe('Selected-frames.zip');
  });
  it('shows the API reason in the export dropdown when queueing fails', async () => {
    io.request.mockImplementation(async (op: string) => {
      if (op === 'export') throw new Error('Studio export cannot start: missing media');
      return [];
    });
    await show();
    panel('exports');
    click('export');
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some(alert => alert.textContent?.includes('missing media'))
      ).toBe(true)
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('confirms drafts before copying a project', async () => {
    const commit = vi.fn().mockResolvedValue(7);
    io.editor.commit = commit;
    io.editor.collaboration = { commit };
    await show({ projectId: 'project', open: vi.fn() });
    panel('project');
    fireEvent.click(screen.getByRole('menuitem', { name: 'duplicateProject' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirmClone' }));
    await waitFor(() => expect(commit).toHaveBeenCalled());
  });
  it('shows a conflict with base, local and remote values', async () => {
    io.editor.conflicts = [{ path: ['title'], base: 'old', local: 'mine', remote: 'theirs' }];
    io.editor.resolveConflicts = vi.fn().mockResolvedValue(undefined);
    await show();
    expect(screen.getByRole('alert').textContent).toContain('theirs');
    click('keepRemote');
    expect(io.editor.resolveConflicts).toHaveBeenCalledWith(false);
  });
  it('formats text from the main toolbar while preserving selection and unrelated objects', async () => {
    await show();
    const selected = selectText();
    // The legacy fixture acquires canonical paragraph IDs on its first V3 write.
    const unrelated = () =>
      value()
        .pages[0].elements.filter(item => item.id !== selected.id)
        .map(({ richText: _richText, ...item }) => item);
    const untouched = unrelated();
    const fontSize = document.querySelector<HTMLInputElement>(
      '[data-action-id="communication-studio.studio-editor.activate.input-f9d64640a1"]'
    )!;
    const color = document.querySelector<HTMLInputElement>(
      '[data-action-id="communication-studio.studio-editor.activate.input-6b4651ec8d"]'
    )!;
    expect(fontSize.value).toBe(String(selected.fontSize));
    expect(color.value).toBe(selected.fill.toLowerCase());
    fontSize.focus();
    expect(document.activeElement).toBe(fontSize);
    fireEvent.change(fontSize, { target: { value: '40' } });
    color.focus();
    expect(document.activeElement).toBe(color);
    fireEvent.change(color, { target: { value: '#123456' } });
    const changed = value().pages[0].elements.find(item => item.id === selected.id)!;
    expect(changed.fontSize).toBe(40);
    expect(changed.richText[0].children[0]).toMatchObject({ color: '#123456' });
    fireEvent.change(fontSize, { target: { value: '7' } });
    expect(value().pages[0].elements.find(item => item.id === selected.id)?.fontSize).toBe(40);
    expect(unrelated()).toEqual(untouched);
    expect(io.canvasProps.selected).toEqual([selected.id]);
  });
  it('dispatches history, inserts a chart and toggles guides from the main toolbar', async () => {
    await show();
    const nodes = value().pages[0].elements;
    click('Undo');
    click('redo');
    expect(io.editor.undo).toHaveBeenCalledOnce();
    expect(io.editor.redo).toHaveBeenCalledOnce();
    click('chart');
    const inserted = value().pages[0].elements.filter(
      item => !nodes.some(old => old.id === item.id)
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0].type).toBe('chart');
    const guides = screen.getByRole('button', { name: 'guides' });
    expect(guides.getAttribute('aria-pressed')).toBe('true');
    click('guides');
    expect(guides.getAttribute('aria-pressed')).toBe('false');
    click('guides');
    expect(guides.getAttribute('aria-pressed')).toBe('true');
  });
  it('disables writes in read-only mode but keeps menus accessible', async () => {
    io.editor.canEdit = false;
    await show();
    expect(screen.getByText('readOnly')).toBeTruthy();
    selectText();
    for (const name of ['chart', 'table', 'upload', 'Undo', 'redo']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true');
    }
    for (const id of ['input-f9d64640a1', 'input-6b4651ec8d']) {
      const input = document.querySelector<HTMLInputElement>(
        `[data-action-id="communication-studio.studio-editor.activate.${id}"]`
      )!;
      expect(input.disabled).toBe(true);
    }
    panel('exports');
    expect((screen.getByRole('button', { name: 'export' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
  it.each(['group', null])(
    'renders the phase explanation and shared procedure tools for %s projects',
    async groupId => {
      io.editor.canEdit = false;
      io.procedureReason = 'suggestionPhaseReadOnly';
      await show({ projectId: 'project', groupId, open: vi.fn() });
      expect(screen.getByText('suggestionPhaseReadOnly')).toBeTruthy();
      expect(screen.queryByText('readOnly')).toBeNull();
      panel('collaboration');
      expect(screen.getByRole('region', { name: 'Shared procedure tools' })).toBeTruthy();
    }
  );
  it('routes keyboard copy, paste and cut through the canvas exactly once', async () => {
    await show();
    const e = selectText();
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(value().pages[0].elements.find(x => x.id === e.id)?.x).toBe(e.x + 10);
    io.canvasExecute.mockClear();
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    expect(io.canvasExecute.mock.calls).toEqual([
      [{ type: 'clipboard', action: 'copy' }],
      [{ type: 'clipboard', action: 'paste' }],
      [{ type: 'clipboard', action: 'cut' }],
    ]);
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    expect(io.canvasExecute).toHaveBeenCalledTimes(3);
    input.remove();
    click('Undo');
    expect(io.editor.undo).toHaveBeenCalled();
    click('preview');
    expect(screen.getByRole('dialog', { name: 'previewTitle' })).toBeTruthy();
    click('closePreview');
    expect(screen.queryByRole('dialog', { name: 'previewTitle' })).toBeNull();
  });
  it('persists frame geometry and fill in one V3 transaction', async () => {
    let persisted: ReturnType<typeof legacyDocumentToV3> | null = null;
    const transactV3 = io.editor.transactV3;
    io.editor.transactV3 = vi.fn(
      (change: (document: ReturnType<typeof legacyDocumentToV3>) => void) =>
        transactV3((document: ReturnType<typeof legacyDocumentToV3>) => {
          change(document);
          persisted = structuredClone(document);
        })
    );
    await show();
    const frame = io.editor.v3Value.nodes.find((node: any) => node.type === 'frame');
    act(() =>
      io.canvasProps.applyCanvasChanges([
        {
          nodeId: frame.id,
          transform: {
            dx: 12,
            dy: 18,
            width: frame.transform.width + 40,
            height: frame.transform.height + 30,
            rotation: 7,
            flipX: false,
            flipY: false,
          },
          style: { fill: '#e03131' },
        },
      ])
    );
    expect(io.editor.transactV3).toHaveBeenCalledTimes(1);
    const changed = (persisted as unknown as ReturnType<typeof legacyDocumentToV3>).nodes.find(
      node => node.id === frame.id
    );
    expect(changed).toMatchObject({
      transform: {
        x: frame.transform.x + 12,
        y: frame.transform.y + 18,
        width: frame.transform.width + 40,
        height: frame.transform.height + 30,
        rotation: 7,
      },
      style: { fill: '#e03131', fillBinding: null },
      overrides: expect.arrayContaining(['style.fill']),
    });
  });
  it('restores the only cut frame and its deliverable from the project clipboard', async () => {
    await show();
    const before = io.editor.v3Value;
    const frame = before.nodes.find((node: any) => node.type === 'frame');
    const deliverable = before.deliverables.find((item: any) => item.frameIds.includes(frame.id));
    const payload = createStudioV3ClipboardPayload({
      projectId: 'project',
      selectedNodeIds: [frame.id],
      document: before,
    });
    if (!payload) throw new Error('Missing sole-frame clipboard fixture');
    setProjectStudioClipboard(payload);
    act(() => io.canvasProps.onDeleteNodes([frame.id]));
    expect(screen.getByRole('status').textContent).toBe('The canvas is empty.');

    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(io.editor.v3Value.nodes.length).toBe(payload.nodes.length));
    const restored = io.editor.v3Value;
    const restoredFrame = restored.nodes.find((node: any) => node.type === 'frame');
    expect(restoredFrame.id).not.toBe(frame.id);
    expect(restored.deliverables).toContainEqual({
      ...deliverable,
      frameIds: [restoredFrame.id],
    });
  });
});

it.each([
  ['X', 'x', 20],
  ['Y', 'y', 30],
  ['width', 'width', 500],
  ['height', 'height', 240],
  ['rotation', 'rotation', 12],
  ['opacity', 'opacity', 0.5],
  ['order', 'order', 4],
  ['fontSize', 'fontSize', 40],
  ['strokeWidth', 'strokeWidth', 2],
  ['lineHeight', 'lineHeight', 1.5],
  ['font', 'font', 'Inter'],
  ['alignment', 'align', 'right'],
  ['verticalAlign', 'verticalAlign', 'bottom'],
  ['text', 'text', 'Updated'],
] as const)('changes the %s property without moving other objects', async (label, key, n) => {
  await show();
  const e = selectText();
  const geometry = () =>
    value()
      .pages[0].elements.filter(x => x.id !== e.id)
      .map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation }));
  const others = geometry();
  const props = screen.getByRole('region', { name: 'properties' });
  fireEvent.change(within(props).getByLabelText(label), { target: { value: String(n) } });
  expect(value().pages[0].elements.find(x => x.id === e.id)?.[key]).toBe(n);
  expect(geometry()).toEqual(others);
});

it('offers crop for one unlocked image or video and commits geometry in one transaction', async () => {
  const imageId = crypto.randomUUID();
  const videoId = crypto.randomUUID();
  ydoc.pages[0].elements.push(
    element('image', { id: imageId, assetId: crypto.randomUUID() }),
    element('video', { id: videoId, assetId: crypto.randomUUID() })
  );
  const transact = io.editor.transactV3;
  io.editor.transactV3 = vi.fn(transact);
  await show();
  click(`Select image ${imageId}`);
  expect(screen.getByRole('button', { name: 'cropMedia' })).toBeTruthy();
  click('cropMedia');
  expect(io.canvasExecute).toHaveBeenCalledWith({ type: 'crop', action: 'start' });
  const source = io.editor.v3Value.nodes.find((node: any) => node.id === imageId);
  const frame = {
    ...source.transform,
    x: source.transform.x + 20,
    width: source.transform.width - 20,
  };
  act(() =>
    io.canvasProps.onCropCommit(imageId, {
      frame,
      fit: 'cover',
      focus: { x: 0.5, y: 0.5 },
      crop: { x: 20, y: 0, width: 80, height: 100, naturalWidth: 100, naturalHeight: 100 },
    })
  );
  expect(io.editor.transactV3).toHaveBeenCalledTimes(1);
  expect(io.editor.v3Value.nodes.find((node: any) => node.id === imageId)).toMatchObject({
    transform: frame,
    crop: { x: 20, width: 80 },
  });
  click(`Select video ${videoId}`);
  expect(screen.getByRole('button', { name: 'cropMedia' })).toBeTruthy();
  ydoc.pages[0].elements.find(item => item.id === videoId)!.locked = true;
  act(notifyAll);
  expect(screen.queryByRole('button', { name: 'cropMedia' })).toBeNull();
});

it('exposes contextual text and image actions through the canvas toolbar', async () => {
  const textId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const assetId = crypto.randomUUID();
  ydoc.pages[0].elements.push(
    element('text', { id: textId, text: 'Write here' }),
    element('image', { id: imageId, assetId })
  );
  io.editor.assets = [{ id: assetId, url: 'http://localhost:3000/image.png' }];
  await show();
  click(`Select text ${textId}`);
  const textToolbar = render(<div>{io.canvasProps.contextToolbar}</div>);
  expect(within(textToolbar.container).getAllByRole('button')).toHaveLength(3);
  fireEvent.click(within(textToolbar.container).getByRole('button', { name: 'bold' }));
  expect(value().pages[0].elements.find(item => item.id === textId)?.bold).toBe(true);
  textToolbar.unmount();
  click(`Select image ${imageId}`);
  const imageToolbar = render(<div>{io.canvasProps.contextToolbar}</div>);
  fireEvent.click(within(imageToolbar.container).getByRole('button', { name: 'resizeImage' }));
  expect(io.canvasExecute).toHaveBeenCalledWith({ type: 'crop', action: 'start' });
  fireEvent.click(within(imageToolbar.container).getByRole('button', { name: 'editImage' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('uses contextual group alignment and distribution with the shared reference', async () => {
  const group = crypto.randomUUID();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  ydoc.pages[0].elements.push(
    ...ids.map((id, index) =>
      element('rect', { id, group, x: [50, 180, 500][index], y: 200, width: 50, height: 50 })
    )
  );
  await show();
  act(() => io.canvasProps.selectExact(ids));
  const toolbar = render(<div>{io.canvasProps.contextToolbar}</div>);
  const actions = within(toolbar.container);
  expect(actions.getAllByRole('button')).toHaveLength(12);
  expect(
    actions.getByRole<HTMLButtonElement>('button', { name: 'distributeHorizontal' }).disabled
  ).toBe(false);
  fireEvent.click(actions.getByRole('button', { name: 'distributeHorizontal' }));
  const spread = ids.map(id => value().pages[0].elements.find(item => item.id === id)!.x);
  expect(spread[0]).toBe(50);
  expect(spread[1]).toBeGreaterThan(180);
  expect(spread[2]).toBe(500);
  fireEvent.click(actions.getByRole('button', { name: 'left' }));
  expect(
    new Set(ids.map(id => value().pages[0].elements.find(item => item.id === id)!.x)).size
  ).toBe(1);
});

const focusScope = { kind: 'studio' as const, projectId: 'project' };
it('focuses repeatedly through the bridge and waits for a loaded workspace without remounting chat', async () => {
  await show();
  const nodeId = io.canvasProps.document.nodes.find((node: any) => node.type === 'richText').id;
  let focus!: Promise<boolean>;
  await act(async () => {
    focus = focusProjectEditor(focusScope, { nodeId, workspaceId: null });
  });
  await focus;
  expect(io.canvasExecute).toHaveBeenLastCalledWith({ type: 'focus', nodeId });
  await act(async () => {
    focus = focusProjectEditor(focusScope, { nodeId, workspaceId: null });
  });
  await focus;
  expect(io.canvasExecute.mock.calls.filter(([cmd]) => cmd.type === 'focus')).toHaveLength(2);
  const chat = screen.getByText('Shared project chat');
  const commit = vi.fn().mockResolvedValue(1);
  io.editor.collaboration.commit = commit;
  await act(async () => {
    focus = focusProjectEditor(focusScope, { nodeId, workspaceId: 'draft' });
  });
  await act(async () => {
    await focus;
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Shared project chat')).toBe(chat);
  expect(io.projectChat.mock.lastCall?.[0].context.proposalId).toBe('draft');
  await act(async () => {
    focus = focusProjectEditor(focusScope, { nodeId, workspaceId: null });
  });
  await act(async () => {
    await focus;
  });
  expect(commit).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Shared project chat')).toBe(chat);
});
it('keeps the current workspace and draft when saving before navigation fails', async () => {
  await show();
  const chat = screen.getByText('Shared project chat');
  io.editor.collaboration.commit = vi.fn().mockRejectedValue(new Error('Save failed'));
  await act(async () => {
    await expect(
      focusProjectEditor(focusScope, { nodeId: 'title', workspaceId: 'draft' })
    ).rejects.toThrow('Save failed');
  });
  expect(io.canvasExecute).not.toHaveBeenCalledWith({ type: 'focus', nodeId: 'title' });
  expect(io.projectChat.mock.lastCall?.[0].context.proposalId).toBeNull();
  expect(screen.getByText('Shared project chat')).toBe(chat);
});
it('consumes route focus only after canvas availability and reports a missing target', async () => {
  const handled = vi.fn();
  io.canvasExecute.mockRejectedValueOnce(new Error('Target missing'));
  await show({
    projectId: 'project',
    groupId: 'group',
    open: vi.fn(),
    focusNodeId: 'deleted',
    onFocusHandled: handled,
  });
  await waitFor(() => expect(handled).toHaveBeenCalledWith(undefined));
  expect(io.canvasExecute).toHaveBeenCalledWith({ type: 'focus', nodeId: 'deleted' });
});
