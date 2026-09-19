/* @vitest-environment jsdom */
import { useEffect, useReducer } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDocument } from '../../logic/templates';
import * as shared from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  editor: {} as any,
  projects: [] as any[],
  exports: [] as any[],
  loading: false,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'author', email: 'author@polity.test' } }),
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
      ydoc.on('update', notify);
      return () => ydoc.off('update', notify);
    }, []);
    return { ...io.editor };
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      key === 'features.studio.format' ? 'Format' : key.replace('features.studio.', ''),
  }),
}));
vi.mock('../StudioCanvas', () => ({
  default: (p: any) => (
    <div data-testid="canvas">
      <button onClick={() => p.cursor(12, 24)}>Move cursor</button>
      <button onClick={() => p.select(p.page.elements.map((e: any) => e.id))}>Select all</button>
      {p.page.elements.map((e: any) => (
        <button key={e.id} onClick={() => p.select([e.id])}>{`Select ${e.type} ${e.id}`}</button>
      ))}
    </div>
  ),
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
import { StudioWorkspace } from '../StudioWorkspace';
let ydoc: Y.Doc;
function value() {
  return shared.readDocument(ydoc);
}
function setup(kind: Parameters<typeof createDocument>[0] = 'single') {
  ydoc?.destroy();
  ydoc = new Y.Doc();
  shared.initialize(ydoc, createDocument(kind, 'Editable campaign', undefined, 1));
  io.editor = {
    get value() {
      return value();
    },
    canEdit: true,
    status: 'saved',
    error: '',
    peers: [{ user: { name: 'Peer' } }, {}],
    assets: [],
    transact: (fn: (d: Y.Doc) => void) => ydoc.transact(() => fn(ydoc)),
    patchElement: (p: string, id: string, change: any) =>
      shared.patchElement(ydoc, p, id, change, 'local'),
    patchPage: (id: string, p: any) => shared.patchPage(ydoc, id, p),
    patchPost: (id: string, p: any) => shared.patchPost(ydoc, id, p),
    insertElement: (p: string, e: any) => shared.insertElement(ydoc, p, e),
    removeElement: (p: string, id: string) => shared.removeElement(ydoc, p, id),
    meta: (k: string, v: any) => ydoc.getMap('meta').set(k, v),
    state: () => Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64'),
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
  io.request.mockImplementation(async (op: string) => (op === 'create' ? { id: 'saved' } : []));
  setup();
});
afterEach(() => {
  cleanup();
  ydoc.destroy();
  vi.restoreAllMocks();
});
const pageName = () =>
  within(screen.getByText('properties').closest('fieldset')!).getByLabelText(
    'name'
  ) as HTMLInputElement;
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const change = (name: string, v: string) =>
  fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value: v } });
async function show(props: any = { projectId: 'project', groupId: 'group', open: vi.fn() }) {
  let ui: ReturnType<typeof render>;
  await act(async () => {
    ui = render(<StudioWorkspace {...props} />);
  });
  return ui!;
}
describe('Studio user workflows', () => {
  it('shares connection diagnostics and keeps a rejected photo edit open for retry', async () => {
    io.editor.collaboration = { phase: 'active' };
    const asset = crypto.randomUUID();
    io.editor.assets = [{ id: asset, url: 'http://localhost:3000/photo.png' }];
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    await show();
    expect(screen.getByText('Shared connection status')).toBeTruthy();
    const upload = screen.getByLabelText('upload');
    fireEvent.change(upload, { target: { files: [] } });
    expect(io.upload).not.toHaveBeenCalled();
    fireEvent.change(upload, { target: { files: [new File(['image'], 'image.png')] } });
    await screen.findByRole('button', { name: 'editImage' });
    click('editImage');
    io.upload.mockRejectedValueOnce(new Error('Upload rejected'));
    click('Save image');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Upload rejected'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(value().pages[0].elements.at(-1)!.assetId).toBe(asset);
  });
  it('hands off a personal video export without introducing a group scope', async () => {
    io.exports = [{ id: 'video', format: 'mp4', status: 'completed', progress: 100 }];
    io.request.mockResolvedValue({ media: [{ id: 'video' }] });
    await show({ projectId: 'project', open: vi.fn() });
    click('usePost');
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('studio:post')!)).toMatchObject({
        groupId: null,
        projectId: 'project',
      })
    );
  });
  it('limits the entire video to sixty seconds, shares cursor positions and preserves invalid duration input', async () => {
    setup('video');
    await show();
    const page = value().pages[0];
    click('Move cursor');
    expect(io.editor.cursor).toHaveBeenCalledWith(page.id, 12, 24);
    change('duration', '41');
    expect(value().pages[0].duration).toBe(5);
    change('duration', '40');
    expect(value().pages[0].duration).toBe(40);
    change('duration', '0');
    expect(value().pages[0].duration).toBe(40);
    expect(value().pages.reduce((sum, p) => sum + p.duration, 0)).toBe(60);
  });
  it('shows loading and empty personal project lists and opens a regular project without a template label', async () => {
    io.loading = true;
    const open = vi.fn();
    const view = await show({ open });
    expect(screen.getByText('loading')).toBeTruthy();
    io.loading = false;
    view.rerender(<StudioWorkspace open={open} />);
    expect(screen.getByText('empty')).toBeTruthy();
    io.projects = [{ id: 'regular', title: 'My draft', kind: 'single', is_template: false }];
    view.rerender(<StudioWorkspace open={open} />);
    fireEvent.click(screen.getByRole('button', { name: /My draft/ }));
    expect(open).toHaveBeenCalledWith('regular');
    expect(screen.queryByText('templateSaved')).toBeNull();
  });
  it('disables every document mutation and duplicate while an export request is awaiting confirmation', async () => {
    io.exports = [
      { id: 'queued', format: 'pdf', status: 'queued', progress: 0 },
      { id: 'done', format: 'png', status: 'completed', progress: 100 },
    ];
    let finish: (value: unknown) => void = () => {
      throw new Error('Request has not started');
    };
    io.request.mockImplementation((op: string) =>
      op === 'themes'
        ? Promise.resolve([])
        : new Promise(resolve => {
            finish = resolve;
          })
    );
    await show();
    click('Select all');
    click('export');
    for (const name of [
      'undo',
      'redo',
      'saveTemplate',
      'duplicateProject',
      'pageUp',
      'pageDown',
      'addPage',
      'text',
      'rect',
      'ellipse',
      'groupElements',
      'ungroup',
      'align',
      'export',
      'cancel',
      'usePost',
    ])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    for (const name of ['duplicate', 'remove'])
      for (const button of screen.getAllByRole('button', { name }))
        expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ id: 'exported' }));
    expect((screen.getByRole('button', { name: 'export' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('creates a configured campaign, preserves failed input and opens existing projects with keyboard focus', async () => {
    const open = vi.fn();
    io.projects = [{ id: 'old', title: 'Existing template', kind: 'story', is_template: true }];
    await show({ groupId: 'group', open });
    const create = screen.getByRole('button', { name: 'create' });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    change('name', 'Four weeks');
    change('templateName', 'campaign');
    change('template', 'checklist');
    change('weeks', '5');
    change('weeks', '4');
    change('core', '2');
    change('stories', '1');
    click('ai');
    change('brief', 'Keep democracy accessible');
    click('template');
    io.request.mockRejectedValueOnce(new Error('Permission changed'));
    click('create');
    await screen.findByText('Permission changed');
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Four weeks');
    expect(open).not.toHaveBeenCalled();
    click('create');
    await waitFor(() => expect(open).toHaveBeenCalledWith('saved'));
    const created = io.request.mock.calls.find(([op]) => op === 'create')![1].document;
    expect(created.posts).toHaveLength(12);
    expect(created.title).toBe('Four weeks');
    const existing = screen.getByRole('button', { name: /Existing template/ });
    existing.focus();
    expect(document.activeElement).toBe(existing);
    fireEvent.click(existing);
    expect(open).toHaveBeenCalledWith('old');
  });
  it('edits shared text properties and rejects invalid dimensions', async () => {
    await show();
    const page = value().pages[0],
      text = page.elements.find(e => e.type === 'text')!;
    click(`Select text ${text.id}`);
    change('text', 'A joint decision');
    change('font', 'Inter');
    change('alignment', 'center');
    click('undo');
    click('redo');
    fireEvent.click(screen.getByLabelText('bold'));
    fireEvent.click(screen.getByLabelText('locked'));
    change('X', '125');
    change('Y', '240');
    change('width', '400');
    change('height', '100');
    change('rotation', '12');
    change('opacity', '0.5');
    change('order', '9');
    change('fontSize', '48');
    change('color', '#123456');
    change('animation', 'fade');
    const edited = value().pages[0].elements.find(e => e.id === text.id)!;
    expect(edited).toMatchObject({
      text: 'A joint decision',
      font: 'Inter',
      align: 'center',
      bold: !text.bold,
      locked: !text.locked,
      x: 125,
      y: 240,
      width: 400,
      height: 100,
      rotation: 12,
      opacity: 0.5,
      order: 9,
      fontSize: 48,
      fill: '#123456',
      animation: 'fade',
    });
    change('width', '1');
    expect(value().pages[0].elements.find(e => e.id === text.id)?.width).toBe(400);
    expect(io.editor.undo).toHaveBeenCalledOnce();
    expect(io.editor.redo).toHaveBeenCalledOnce();
  });
  it('edits shared project and page properties', async () => {
    await show();
    fireEvent.change(document.querySelector('header input')!, { target: { value: 'Renamed' } });
    fireEvent.change(pageName(), { target: { value: 'New page name' } });
    const backgrounds = screen.getAllByLabelText('background');
    fireEvent.change(backgrounds[0], { target: { value: '#abcdef' } });
    change('duration', '8');
    change('transition', 'fade');
    fireEvent.change(screen.getAllByLabelText('Format')[0], { target: { value: 'square' } });
    expect(value().title).toBe('Renamed');
    expect(value().pages[0]).toMatchObject({
      name: 'New page name',
      duration: 8,
      background: '#abcdef',
      transition: 'fade',
      format: 'square',
    });
  });
  it('preserves selection operations and toggles the preview', async () => {
    await show();
    click('text');
    click('rect');
    click('ellipse');
    click('Select all');
    click('groupElements');
    expect(new Set(value().pages[0].elements.map(e => e.group)).size).toBe(1);
    click('ungroup');
    expect(value().pages[0].elements.every(e => e.group === null)).toBe(true);
    click('align');
    const count = value().pages[0].elements.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'duplicate' })[1]);
    expect(value().pages[0].elements.length).toBe(count * 2);
    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[1]);
    expect(value().pages[0].elements.length).toBe(count);
    click('preview');
    await screen.findByRole('button', { name: 'stop' });
    click('stop');
    fireEvent.click(screen.getByLabelText('guides'));
  });
  it('reorders, duplicates and removes pages without dropping their post references', async () => {
    await show();
    click('addPage');
    expect(value().pages).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'duplicate' })[0]);
    expect(value().pages).toHaveLength(3);
    const duplicate = value().pages[2].id;
    click('pageUp');
    expect(value().pages[1].id).toBe(duplicate);
    click('pageDown');
    expect(value().pages[2].id).toBe(duplicate);
    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
    expect(value().posts[0].pageIds).not.toContain(duplicate);
    click(`2. ${value().pages[1].name}`);
    expect(pageName().value).toBe(value().pages[1].name);
  });
  it('uploads images and video, edits cropping and clip properties and replaces an image without flattening it', async () => {
    const asset = crypto.randomUUID();
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    io.editor.assets = [{ id: asset, url: 'http://localhost:3000/example.png' }];
    await show();
    fireEvent.change(screen.getByLabelText('upload'), {
      target: { files: [new File(['image'], 'image.png', { type: 'image/png' })] },
    });
    await screen.findByRole('button', { name: 'editImage' });
    change('fit', 'cover');
    change('cropX', '0.2');
    change('cropY', '0.8');
    click('logo');
    expect(value().brand.logoAssetId).toBe(asset);
    click('editImage');
    await screen.findByRole('dialog');
    click('Keep image open');
    expect(screen.getByRole('dialog')).toBeTruthy();
    click('Close image');
    expect(screen.queryByRole('dialog')).toBeNull();
    click('editImage');
    const replacement = crypto.randomUUID();
    io.upload.mockResolvedValue({ id: replacement, mime: 'image/png' });
    click('Save image');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(value().pages[0].elements.some(e => e.assetId === replacement && e.cropX === 0.2)).toBe(
      true
    );
    io.upload.mockResolvedValue({ id: crypto.randomUUID(), mime: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('upload'), {
      target: { files: [new File(['clip'], 'clip.mp4', { type: 'video/mp4' })] },
    });
    await screen.findByLabelText('trim');
    change('trim', '2');
    fireEvent.click(screen.getByLabelText('muted'));
    expect(value().pages[0].elements.at(-1)).toMatchObject({
      type: 'video',
      trimStart: 2,
      muted: false,
    });
  });
  it('imports an authorized source and theme while treating generated copy as an explicit proposal', async () => {
    const theme = {
      id: 'theme',
      name: 'Group colors',
      revision_id: 'r',
      light_palette: { background: '#112233', foreground: '#ffffff', accent: '#abcdef' },
      fonts: { display: 'inter', sans: 'ubuntu' },
    };
    io.request.mockImplementation(async (op: string) =>
      op === 'themes'
        ? [theme]
        : op === 'sources'
          ? [
              {
                id: '31111111-1111-4111-8111-111111111111',
                type: 'event',
                updatedAt: 123,
                title: 'Open assembly',
                text: 'Tuesday, town hall',
              },
            ]
          : {
              title: 'AI',
              posts: [
                {
                  title: 'Generated title',
                  action: 'Join',
                  instagram: 'IG',
                  linkedin: 'LI',
                  facebook: 'FB',
                  slides: [{ title: 'Generated slide', text: 'Generated text' }],
                },
              ],
            }
    );
    await show();
    click('theme: Group colors');
    expect(value().brand.themeId).toBe('theme');
    fireEvent.change(screen.getAllByLabelText('background')[1], { target: { value: '#223344' } });
    expect(value().brand.background).toBe('#223344');
    fireEvent.click(screen.getByText('sources', { selector: 'summary' }));
    const sourceSelect = screen.getByRole('option', { name: 'event' }).parentElement!;
    fireEvent.change(sourceSelect, { target: { value: 'amendment' } });
    click('loadSources');
    await screen.findByRole('button', { name: 'Open assembly' });
    click('Open assembly');
    expect(value().source).toMatchObject({ id: '31111111-1111-4111-8111-111111111111' });
    expect(value().title).toBe('Open assembly');
    fireEvent.click(screen.getByText('ai', { selector: 'summary' }));
    change('brief', 'Help explain the meeting');
    click('generate');
    await screen.findByRole('button', { name: 'accept' });
    expect(value().posts[0].title).not.toBe('Generated title');
    click('discard');
    expect(screen.queryByText('Generated slide')).toBeNull();
    click('generate');
    await screen.findByRole('button', { name: 'accept' });
    click('accept');
    expect(value().posts[0]).toMatchObject({
      title: 'Generated title',
      captions: { instagram: 'IG', linkedin: 'LI', facebook: 'FB' },
    });
    expect(screen.getByRole('link', { name: 'editThemes' }).getAttribute('href')).toBe(
      '/group/group/settings?tab=themes'
    );
  });
  it('updates channel copy and campaign assignments then exports the selected confirmed scope', async () => {
    setup('campaign');
    await show();
    change('action', 'Join the pilot');
    for (const c of ['instagram', 'linkedin', 'facebook']) change(c, `Copy for ${c}`);
    change('startDate', '2026-10-01');
    fireEvent.change(screen.getAllByLabelText('day')[0], { target: { value: '500' } });
    fireEvent.change(screen.getAllByLabelText('status')[0], { target: { value: 'ready' } });
    fireEvent.change(screen.getAllByLabelText('assignee')[0], { target: { value: 'Editor' } });
    expect(value().posts[0]).toMatchObject({
      action: 'Join the pilot',
      day: 365,
      status: 'ready',
      assignee: 'Editor',
      captions: { instagram: 'Copy for instagram' },
    });
    const post = value().posts[1];
    click(`${post.code} · ${post.title}`);
    expect(pageName().value).toBe(value().pages.find(p => p.id === post.pageIds[0])!.name);
    fireEvent.change(screen.getAllByLabelText('Format')[1], { target: { value: 'canva' } });
    change('scope', 'page');
    click('export');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'export',
        expect.objectContaining({
          format: 'canva',
          pageIds: [post.pageIds[0]],
          state: expect.any(String),
        })
      )
    );
    expect(screen.getByText('canvaHint')).toBeTruthy();
  });
  it('saves templates, opens a confirmed duplicate and handles completed and cancelled export jobs', async () => {
    io.exports = [
      { id: 'png', format: 'png', status: 'completed', progress: 100 },
      { id: 'queued', format: 'pdf', status: 'queued', progress: 0 },
      { id: 'failed', format: 'mp4', status: 'failed', progress: 0, error: 'Renderer failed' },
    ];
    const open = vi.fn();
    const browserOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    io.request.mockImplementation(async (op: string) =>
      op === 'themes'
        ? []
        : op === 'duplicate'
          ? { id: 'copy' }
          : op === 'download'
            ? { url: 'http://localhost:3000/confirmed.png' }
            : { media: [{ id: 'png' }] }
    );
    await show({ groupId: 'group', projectId: 'project', open });
    click('saveTemplate');
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('template', { id: 'project', value: true })
    );
    click('duplicateProject');
    await waitFor(() => expect(open).toHaveBeenCalledWith('copy'));
    click('download');
    await waitFor(() =>
      expect(browserOpen).toHaveBeenCalledWith(
        'http://localhost:3000/confirmed.png',
        '_blank',
        'noopener,noreferrer'
      )
    );
    click('cancel');
    await waitFor(() => expect(io.request).toHaveBeenCalledWith('cancel', { id: 'queued' }));
    click('usePost');
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('studio:post')!)).toMatchObject({
        groupId: 'group',
        projectId: 'project',
        title: 'Editable campaign',
      })
    );
    expect(screen.getByText('Renderer failed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'projects' }).getAttribute('href')).toBe(
      '/group/group/studio'
    );
  });
  it('keeps unavailable, read-only and offline states visible and disables mutation controls', async () => {
    io.editor.canEdit = false;
    const ui = await show();
    expect(screen.getByText('readOnly')).toBeTruthy();
    for (const name of [
      'undo',
      'redo',
      'saveTemplate',
      'addPage',
      'text',
      'rect',
      'ellipse',
      'export',
    ])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    const properties = screen.getByText('properties').closest('fieldset')!;
    expect(properties.disabled).toBe(true);
    expect(within(properties).getByLabelText('name')).toBeTruthy();
    io.editor.canEdit = true;
    io.editor.status = 'offline';
    ui.rerender(<StudioWorkspace projectId="project" open={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'export' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    Object.defineProperty(io.editor, 'value', { get: () => null, configurable: true });
    io.editor.error = 'Access revoked';
    ui.rerender(<StudioWorkspace projectId="project" open={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('Access revoked');
    io.editor.error = '';
    ui.rerender(<StudioWorkspace projectId="project" open={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('loading');
  });
});
