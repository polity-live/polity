/* @vitest-environment jsdom */
import { forwardRef, useEffect, useImperativeHandle, useReducer } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioDocument } from '../../logic/document';
import { createDocument } from '../../logic/templates';
import { studioDocumentV3Schema } from '../../logic/document-v3';
import {
  createStudioV3ClipboardPayload,
  setProjectStudioClipboard,
} from '../../logic/studio-clipboard';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../../logic/v3-adapter';
import * as shared from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  canvasExecute: vi.fn().mockResolvedValue(undefined),
  canvasProps: null as any,
  editor: {} as any,
  projects: [] as any[],
  exports: [] as any[],
  loading: false,
  projectChat: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
  useZero: () => ({
    mutate: () => ({ client: Promise.resolve(), server: Promise.resolve({ type: 'success' }) }),
  }),
}));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({
  ProjectChatPanel: (props: any) => {
    io.projectChat(props);
    return <button data-project-chat-dock>Shared project chat</button>;
  },
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'author', email: 'author@polity.test' } }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    currentUser: {
      id: 'author',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      avatar: null,
    },
  }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: io.projects, exports: io.exports, isLoading: io.loading }),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ useStudioApi: () => io }));
vi.mock('@/features/collaboration/ui/CollaborationStatus', () => ({
  CollaborationStatus: () => <span>Shared connection status</span>,
}));
vi.mock('../../hooks/useStudioDocument', () => ({
  useStudioDocument: () => {
    const [, notify] = useReducer(n => n + 1, 0);
    useEffect(() => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    }, []);
    return { ...io.editor };
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'features.studio.format') return 'Format';
      if (key === 'features.editor.header.allSaved') return 'All changes saved';
      if (key === 'common.actions.share') return 'Share';
      return key.replace('features.studio.', '');
    },
  }),
}));
vi.mock('../ExcalidrawCanvas', () => ({
  default: forwardRef((p: any, ref) => {
    io.canvasProps = p;
    useImperativeHandle(ref, () => ({ execute: io.canvasExecute }));
    useEffect(
      () => p.onGeometry?.({ left: 100, top: 150, right: 350, bottom: 450, interacting: false }),
      []
    );
    return (
      <div data-testid="canvas" data-page-id={p.page.id}>
        {p.inspector && (
          <section aria-label="properties" className="polity-inspector-extension">
            {p.inspector}
          </section>
        )}
        <button onClick={() => p.cursor(12, 24)}>Move cursor</button>
        <button onClick={() => p.select(p.page.elements.map((e: any) => e.id))}>Select all</button>
        {p.page.elements.map((e: any) => (
          <button key={e.id} onClick={() => p.select([e.id])}>{`Select ${e.type} ${e.id}`}</button>
        ))}
      </div>
    );
  }),
}));
vi.mock('../StudioPreviewDialog', () => ({
  StudioPreviewDialog: (props: any) =>
    props.open ? (
      <div role="dialog" aria-label="previewTitle">
        <button onClick={() => props.onOpenChange(false)}>closePreview</button>
      </div>
    ) : null,
}));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({
  ImageEditorDialog: (p: any) =>
    p.open ? (
      <div role="dialog">
        <button onClick={() => p.onOpenChange(true)}>Keep image open</button>
        <button onClick={() => p.onSave(new File(['edit'], 'edited.png', { type: 'image/png' }))}>
          Save image
        </button>
        <button onClick={() => p.onOpenChange(false)}>Close image</button>
      </div>
    ) : null,
}));
vi.mock('@/features/shared/hooks/useFixedToolbarController', () => ({
  useFixedToolbarController: () => ({ className: 'fixed' }),
}));
import { StudioWorkspace } from '../StudioWorkspace';
vi.mock('../CanvasGovernancePanel', () => ({
  CanvasGovernancePanel: () => <section aria-label="Procedure" />,
}));
let ydoc: StudioDocument;
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach(f => f());
function value() {
  return structuredClone(ydoc);
}
function setup(kind: Parameters<typeof createDocument>[0] = 'single') {
  ydoc = createDocument(kind, 'Editable campaign', undefined, 1);
  io.editor = {
    get value() {
      return value();
    },
    get v3Value() {
      try {
        return legacyDocumentToV3(ydoc);
      } catch {
        // The legacy mock permits intermediate edits that the real document hook validates.
        return null;
      }
    },
    canEdit: true,
    status: 'saved',
    error: '',
    peers: [
      {
        userId: 'peer',
        user: { id: 'peer', name: 'Peer', firstName: 'Peer', color: '#123456' },
      },
    ],
    assets: [],
    sources: [],
    transact: (fn: (d: StudioDocument) => void) =>
      (() => {
        fn(ydoc);
        notifyAll();
      })(),
    transactV3: (fn: (d: ReturnType<typeof legacyDocumentToV3>) => void) =>
      (() => {
        const document = legacyDocumentToV3(ydoc);
        fn(document);
        ydoc = v3DocumentToLegacy(studioDocumentV3Schema.parse(document));
        notifyAll();
      })(),
    patchElement: (p: string, id: string, change: any) => {
      shared.patchElement(ydoc, p, id, change, 'local');
      notifyAll();
    },
    patchPage: (id: string, p: any) => {
      shared.patchPage(ydoc, id, p);
      notifyAll();
    },
    patchPost: (id: string, p: any) => {
      shared.patchPost(ydoc, id, p);
      notifyAll();
    },
    insertElement: (p: string, e: any) => {
      shared.insertElement(ydoc, p, e);
      notifyAll();
    },
    removeElement: (p: string, id: string) => {
      shared.removeElement(ydoc, p, id);
      notifyAll();
    },
    meta: (k: string, v: any) =>
      (() => {
        Object.assign(ydoc, { [k]: v });
        notifyAll();
      })(),
    commit: async () => 0,
    collaboration: { commit: async () => 0 },
    conflicts: [],
    retry: vi.fn(),
    refreshAssets: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn(),
    redo: vi.fn(),
    cursor: vi.fn(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  io.projects = [];
  io.exports = [];
  io.loading = false;
  io.canvasProps = null;
  io.request.mockImplementation(async (op: string) => (op === 'create' ? { id: 'saved' } : []));
  setup();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const change = (name: string, v: string) =>
  fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value: v } });
async function show(props: any = { projectId: 'project', groupId: 'group', open: vi.fn() }) {
  let ui: any;
  await act(async () => {
    ui = render(<StudioWorkspace {...props} />);
  });
  return ui;
}
const menuNames = new Set([
  'project',
  'frame',
  'shapes',
  'line',
  'draw',
  'zoom 100%',
  'insert',
  'arrange',
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
describe('Studio toolbar workflows', () => {
  it('keeps project overview and creation available', async () => {
    io.loading = true;
    const ui = await show({ open: vi.fn() });
    expect(screen.getByText('loading')).toBeTruthy();
    io.loading = false;
    await act(async () => ui.rerender(<StudioWorkspace open={vi.fn()} />));
    expect(screen.getByRole('button', { name: 'create' })).toBeTruthy();
    change('name', 'Campaign draft');
    change('templateName', 'campaign');
    change('weeks', '8');
    change('core', '2');
    change('stories', '1');
    io.request.mockRejectedValueOnce(new Error('Temporary failure'));
    click('create');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Temporary failure')
    );
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Campaign draft');
    click('create');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'create',
        expect.objectContaining({
          title: 'Campaign draft',
          kind: 'campaign',
          themeId: '00000000-0000-4000-8000-000000000001',
          themeMode: 'light',
          template: { kind: 'builtin', id: 'announcement' },
          campaign: { weeks: 8, core: 2, stories: 1 },
        })
      )
    );
  });
  it('shows storage status and peers without a permanent sidebar', async () => {
    await show();
    expect(screen.getByRole('status').textContent).toBe('All changes saved');
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Peer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'invite' }).getAttribute('href')).toBe(
      '/group/group/memberships?tab=membershipsByUser'
    );
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
  it('renders one icon toolbar and a separate compact project status row', async () => {
    ydoc.pages[0].name = 'Different page name';
    await show();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    const toolbar = screen.getByRole('toolbar', { name: 'tools' });
    for (const name of ['selection', 'hand', 'text', 'undo', 'redo', 'guides']) {
      const control = within(toolbar).getByRole('button', { name });
      expect(control.querySelector('svg')).toBeTruthy();
      expect(control.textContent).toBe('');
    }
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
  it('inserts direct element types from the insert menu', async () => {
    await show();
    for (const type of ['text', 'rect', 'ellipse', 'line', 'arrow', 'chart']) {
      const insert = panel('insert');
      fireEvent.click(within(insert).getByRole('menuitem', { name: type }));
      expect(value().pages[0].elements.at(-1)?.type).toBe(type);
    }
  });
  it('formats text through compact font, alignment, list and link menus', async () => {
    await show();
    const selected = selectText();
    const current = () => value().pages[0].elements.find(element => element.id === selected.id)!;

    fireEvent.click(within(panel('font')).getByRole('menuitemradio', { name: 'Inter' }));
    expect(current().font).toBe('Inter');
    fireEvent.click(within(panel('alignment')).getByRole('menuitemradio', { name: 'right' }));
    expect(current().align).toBe('right');

    fireEvent.click(within(panel('text')).getByRole('menuitem', { name: 'bulletList' }));
    expect(current().richText.every(paragraph => paragraph.list === 'bullet')).toBe(true);
    fireEvent.click(within(panel('text')).getByRole('menuitem', { name: 'numberedList' }));
    expect(current().richText.every(paragraph => paragraph.list === 'number')).toBe(true);

    fireEvent.click(within(panel('text')).getByRole('menuitem', { name: 'link' }));
    const url = screen.getByRole('textbox', { name: 'link' });
    fireEvent.change(url, { target: { value: 'https://example.org' } });
    fireEvent.keyDown(url, { key: 'Enter' });
    expect(
      current().richText.some(paragraph =>
        paragraph.children.some(run => run.url === 'https://example.org')
      )
    ).toBe(true);
  });
  it('opens automation-targeted menus and returns focus on Escape', async () => {
    await show();
    selectText();
    for (const key of ['project', 'insert', 'arrange', 'text']) {
      const trigger = screen
        .getAllByRole('button', { name: key })
        .find(button => button.getAttribute('aria-haspopup') === 'menu')!;
      trigger.focus();
      await act(async () => {
        window.dispatchEvent(new CustomEvent('studio-open-panel', { detail: key }));
      });
      const menu = await screen.findByRole('menu');
      expect(menu.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
      fireEvent.keyDown(menu, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(trigger);
    }
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
  it('aligns, duplicates and deletes through selection tools', async () => {
    await show();
    selectText();
    panel('arrange');
    fireEvent.click(screen.getByRole('menuitem', { name: 'center' }));
    const e = value().pages[0].elements.find(e => e.type === 'text')!;
    expect(e.x).toBe((1080 - e.width) / 2);
    const count = value().pages[0].elements.length;
    click('duplicate');
    expect(value().pages[0].elements.length).toBe(count + 1);
    click('remove');
    expect(value().pages[0].elements.length).toBe(count);
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
  it('uploads media from the insert panel and keeps a failed image edit open', async () => {
    const asset = crypto.randomUUID();
    io.editor.assets = [{ id: asset, url: 'http://localhost:3000/image.png' }];
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    await show();
    panel('insert');
    fireEvent.change(document.querySelector('input[type="file"][aria-label="upload"]')!, {
      target: { files: [new File(['image'], 'image.png')] },
    });
    await waitFor(() => expect(io.upload).toHaveBeenCalled());
    close();
    const image = value().pages[0].elements.find(element => element.type === 'image');
    expect(image).toBeTruthy();
    click(`Select image ${image!.id}`);
    const properties = screen.getByRole('region', { name: 'properties' });
    fireEvent.click(within(properties).getByRole('button', { name: 'editImage' }));
    io.upload.mockRejectedValueOnce(new Error('Upload rejected'));
    click('Save image');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Upload rejected'));
    expect(screen.getByRole('button', { name: 'Save image' })).toBeTruthy();
  });
  it('exports a confirmed JSON revision and lists export status', async () => {
    io.editor.commit = vi.fn().mockResolvedValue(7);
    io.exports = [{ id: 'job', format: 'png', status: 'completed', progress: 100 }];
    await show();
    panel('exports');
    change('scope', 'all');
    click('export');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('export', {
        projectId: 'project',
        format: 'png',
        pageIds: [],
        revision: 7,
      })
    );
    expect(screen.getByRole('button', { name: 'download' })).toBeTruthy();
  });
  it('confirms drafts before copying a project', async () => {
    const commit = vi.fn().mockResolvedValue(7);
    io.editor.commit = commit;
    io.editor.collaboration = { commit };
    io.request.mockResolvedValue({ id: 'copy' });
    const open = vi.fn();
    await show({ projectId: 'project', open });
    panel('project');
    fireEvent.click(screen.getByRole('menuitem', { name: 'duplicateProject' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('copy'));
    expect(commit).toHaveBeenCalled();
  });
  it('shows a conflict with base, local and remote values', async () => {
    io.editor.conflicts = [{ path: ['title'], base: 'old', local: 'mine', remote: 'theirs' }];
    io.editor.resolveConflicts = vi.fn().mockResolvedValue(undefined);
    await show();
    expect(screen.getByRole('alert').textContent).toContain('theirs');
    click('keepRemote');
    expect(io.editor.resolveConflicts).toHaveBeenCalledWith(false);
  });
  it('disables writes in read-only mode but keeps menus accessible', async () => {
    io.editor.canEdit = false;
    await show();
    expect(screen.getByText('readOnly')).toBeTruthy();
    panel('insert');
    expect(screen.getByRole('menuitem', { name: 'rect' }).getAttribute('data-disabled')).toBe('');
    close();
    panel('exports');
    expect((screen.getByRole('button', { name: 'export' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
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
    click('undo');
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
    act(() => io.canvasProps.cutV3Clipboard([frame.id]));
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

it('changes object properties without moving other selected objects', async () => {
  await show();
  const e = selectText();
  const props = screen.getByRole('region', { name: 'properties' });
  for (const [label, key, n] of [
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
  ] as const) {
    fireEvent.change(within(props).getByLabelText(label), { target: { value: String(n) } });
    expect(value().pages[0].elements.find(x => x.id === e.id)?.[key]).toBe(n);
  }
  fireEvent.change(within(props).getByLabelText('font'), { target: { value: 'Inter' } });
  fireEvent.change(within(props).getByLabelText('alignment'), { target: { value: 'right' } });
  fireEvent.change(within(props).getByLabelText('verticalAlign'), { target: { value: 'bottom' } });
  fireEvent.change(within(props).getByLabelText('text'), { target: { value: 'Updated' } });
  expect(value().pages[0].elements.find(x => x.id === e.id)).toMatchObject({
    font: 'Inter',
    align: 'right',
    verticalAlign: 'bottom',
    text: 'Updated',
  });
});
