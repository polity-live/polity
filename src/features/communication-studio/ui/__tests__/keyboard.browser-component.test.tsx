import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Type } from 'lucide-react';
import { Toolbar } from '@/features/shared/ui/layout';
import { StudioDataProperties } from '../StudioDataProperties';
import { StudioTextEditor, type StudioTextSelectionEditor } from '../StudioTextEditor';
import { StudioMenuItem, StudioToolbarMenu } from '../StudioToolbarMenu';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { element } from '../../logic/document';
const io = vi.hoisted(() => ({ controller: {} as any, canvasExecute: vi.fn() }));
vi.mock('../../hooks/useStudioController', () => ({ useStudioController: () => io.controller }));
vi.mock('../../hooks/useStudioEditorTools', () => ({ useStudioEditorTools: vi.fn() }));
vi.mock('../StudioProjectOverview', () => ({
  StudioProjectOverview: () => <p>Project overview</p>,
}));
vi.mock('../useStudioProcedure', () => ({
  useStudioProcedure: () => ({
    tools: <section aria-label="Procedure" />,
    modeButton: null,
    canvasOverlay: null,
    markers: [],
    previewDocument: null,
    previewAssets: [],
    editingAllowed: true,
    selectProposal: vi.fn(),
  }),
}));
vi.mock('@/features/shared/hooks/useFixedToolbarController', () => ({
  useFixedToolbarController: () => ({ className: 'fixed' }),
}));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({
  ProjectChatPanel: () => <p>Project chat</p>,
}));
vi.mock('@/features/groups/ui/GroupThemeSettings', () => ({
  GroupThemeSettings: () => null,
}));
vi.mock('../StudioCanvas', () => ({
  default: ({ onGeometry }: any) => {
    useEffect(
      () => onGeometry?.({ left: 100, top: 180, right: 300, bottom: 400, interacting: false }),
      []
    );
    return <div />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({ ImageEditorDialog: () => null }));
vi.mock('../CanvasGovernancePanel', () => ({
  CanvasGovernancePanel: () => <section aria-label="Procedure" />,
}));
vi.mock('../KonvaStudioCanvas', () => ({
  default: forwardRef(({ inspector }: any, ref) => {
    useImperativeHandle(ref, () => ({ execute: io.canvasExecute }));
    return <div>{inspector && <section aria-label="properties">{inspector}</section>}</div>;
  }),
}));
import { StudioWorkspace } from '../StudioWorkspace';
afterEach(cleanup);
function model() {
  const value = createDocument('campaign', 'Keyboard campaign', undefined, 1);
  return new Proxy(
    {
      value,
      v3Value: legacyDocumentToV3(value),
      identity: { id: 'author' },
      exportFrames: legacyDocumentToV3(value).nodes.filter(node => node.type === 'frame'),
      exportFrameIds: value.pages.map(page => page.id),
      page: value.pages[0],
      post: value.posts[0],
      active: value.pages[0].elements[1],
      peers: [],
      assets: [],
      exports: [
        { id: 'queued', format: 'pdf', status: 'queued', progress: 0 },
        { id: 'complete', format: 'png', status: 'completed', progress: 100 },
      ],
      projects: [{ id: 'p', title: 'Existing', kind: 'single' }],
      themes: [{ id: 'theme', name: 'Theme' }],
      sources: [{ id: 'source', title: 'Source' }],
      elementSets: [],
      selected: [value.pages[0].elements[1].id],
      theme: null,
      themePalette: null,
      canEdit: true,
      busy: false,
      exportPreparing: false,
      exportFailure: '',
      exportStatusError: '',
      playing: false,
      guides: true,
      status: 'saved',
      collaboration: { commit: vi.fn() },
      conflicts: [],
      error: '',
      failure: '',
      photoEdit: undefined,
      kind: 'campaign',
      title: 'New campaign',
      template: 'announcement',
      mode: 'ai',
      weeks: 4,
      core: 3,
      stories: 2,
      brief: 'Explain participation',
      sourceType: 'event',
      format: 'png',
      scope: 'all',
      proposal: {
        posts: [{ title: 'Proposal', action: 'Join', slides: [{ title: 'Title', text: 'Text' }] }],
      },
    } as any,
    {
      get(target, key) {
        return key in target ? target[key] : (target[key] = vi.fn());
      },
    }
  );
}
async function keyboardControls(container: HTMLElement) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  for (const detail of container.querySelectorAll('details')) detail.open = true;
  let count = 0;
  for (const control of container.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('button,input,select,textarea,[role="menuitem"],[role="menuitemradio"]')) {
    if (
      control.getAttribute('aria-label') === 'close' ||
      !control.isConnected ||
      control.disabled ||
      control.closest('fieldset:disabled') ||
      !control.getClientRects().length
    )
      continue;
    control.focus();
    expect(document.activeElement).toBe(control);
    expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    const changed = vi.fn();
    if (control.tagName === 'BUTTON' || control.getAttribute('role')?.startsWith('menuitem')) {
      control.addEventListener('click', changed);
      await userEvent.keyboard(control.getAttribute('role') === 'checkbox' ? ' ' : '{Enter}');
      expect(changed, control.outerHTML).toHaveBeenCalledOnce();
      control.removeEventListener('click', changed);
    } else if (control instanceof HTMLSelectElement) {
      control.addEventListener('keydown', changed);
      await userEvent.keyboard('{ArrowDown}');
      expect(changed).toHaveBeenCalled();
      control.removeEventListener('keydown', changed);
    } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.addEventListener('change', changed);
      await userEvent.keyboard(' ');
      expect(changed, control.outerHTML).toHaveBeenCalledOnce();
      control.removeEventListener('change', changed);
    } else if (
      control instanceof HTMLTextAreaElement ||
      (control instanceof HTMLInputElement && ['text', 'number'].includes(control.type))
    ) {
      control.addEventListener('input', changed);
      await userEvent.keyboard(
        control instanceof HTMLInputElement && control.type === 'number' ? '2' : 'x'
      );
      expect(changed).toHaveBeenCalled();
      control.removeEventListener('input', changed);
    }
    count++;
  }
  return count;
}
it('exposes Studio creation, text, media, campaign and export controls to real keyboard focus and native activation', async () => {
  io.controller = model();
  render(<StudioWorkspace groupId="group" projectId="project" open={vi.fn()} />);
  await screen.findByRole('button', { name: 'table' });
  for (const panel of [
    'layers',
    'elementAlignment',
    'distribute',
    'order',
    'groupElements',
    'text',
    'exports',
    'project',
  ]) {
    const triggers = screen.getAllByRole('button', { name: panel });
    const trigger = triggers.find(button => button.hasAttribute('aria-haspopup')) ?? triggers[0];
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const surface = await screen.findByRole(
      ['project', 'elementAlignment', 'distribute', 'order', 'groupElements', 'text'].includes(
        panel
      )
        ? 'menu'
        : 'dialog'
    );
    if (['elementAlignment', 'distribute', 'groupElements'].includes(panel)) {
      expect(surface.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
      if (panel !== 'groupElements')
        expect(surface.querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
    } else {
      expect(await keyboardControls(surface), panel).toBeGreaterThan(0);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole(surface.getAttribute('role') as 'menu' | 'dialog')).toBeNull()
    );
    expect(document.activeElement).toBe(trigger);
  }
  expect(
    await keyboardControls(screen.getByRole('region', { name: 'properties' }))
  ).toBeGreaterThan(10);
  expect(io.controller.transactV3).toHaveBeenCalled();
  expect(io.controller.exportMedia).toHaveBeenCalled();
}, 30000);

it('supports native keyboard focus and activation for table and chart controls', async () => {
  const patch = vi.fn();
  const ui = render(<StudioDataProperties element={element('table')} patch={patch} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(20);
  expect(patch).toHaveBeenCalled();
  ui.rerender(<StudioDataProperties element={element('chart')} patch={patch} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(10);
  const pie = element('chart');
  if (!pie.chart) throw new Error('Chart fixture missing');
  pie.chart.kind = 'pie';
  ui.rerender(<StudioDataProperties element={pie} patch={patch} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(10);
  expect(screen.getByLabelText('color A')).toBeInstanceOf(HTMLInputElement);
});

it('opens image crop with native keyboard focus and activation', async () => {
  const controller = model();
  const image = element('image', { assetId: crypto.randomUUID() });
  controller.value.pages[0].elements.push(image);
  controller.v3Value = legacyDocumentToV3(controller.value);
  controller.active = image;
  controller.selected = [];
  io.controller = controller;
  io.canvasExecute.mockClear();
  const ui = render(<StudioWorkspace groupId="group" projectId="project" open={vi.fn()} />);
  controller.selected = [image.id];
  ui.rerender(<StudioWorkspace groupId="group" projectId="project" open={vi.fn()} />);
  const crop = await screen.findByRole<HTMLButtonElement>('button', { name: 'cropMedia' });
  crop.focus();
  expect(document.activeElement).toBe(crop);
  await userEvent.keyboard('{Enter}');
  expect(io.canvasExecute).toHaveBeenCalledWith({ type: 'crop', action: 'start' });
});

it('navigates icon-only Studio menus with arrow keys and returns focus on Escape', async () => {
  io.controller = model();
  render(<StudioWorkspace groupId="group" projectId="project" open={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'shapes' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await screen.findByRole('menu');
  for (const name of ['rectangle', 'ellipse', 'diamond', 'roundedRectangle']) {
    expect(menu.querySelector(`[role="menuitem"][aria-label="${name}"]`)).not.toBeNull();
  }
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it('keeps a partial editor selection when a text-menu action takes focus', async () => {
  const patch = vi.fn();
  let editor: StudioTextSelectionEditor | null = null;
  render(
    <>
      <StudioTextEditor
        element={element('text', { text: 'Hello' })}
        onChange={patch}
        register={value => {
          editor = value;
        }}
      />
      <Toolbar>
        <StudioToolbarMenu label="Text options" icon={<Type />}>
          <StudioMenuItem
            label="Link"
            icon={<Type />}
            onSelect={() => editor?.mark('url', 'https://example.org')}
          />
        </StudioToolbarMenu>
      </Toolbar>
    </>
  );
  const text = screen.getByRole('textbox', { name: 'Text' });
  text.focus();
  const string = text.querySelector('[data-slate-string]')?.firstChild;
  expect(string).toBeTruthy();
  const range = document.createRange();
  range.setStart(string!, 0);
  range.setEnd(string!, 2);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  await userEvent.click(screen.getByRole('button', { name: 'Text options' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Link' }));
  await waitFor(() => expect(patch).toHaveBeenCalled());
  const richText = patch.mock.lastCall?.[0]?.richText;
  expect(richText?.[0]?.children?.[0]).toMatchObject({ text: 'He', url: 'https://example.org' });
  expect(richText?.[0]?.children?.[1]?.text).toBe('llo');
});
