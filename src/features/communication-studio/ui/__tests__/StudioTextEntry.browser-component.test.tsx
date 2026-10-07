import { useState } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page as browserPage, userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { v3DocumentToLegacy } from '../../logic/v3-adapter';
import type { StudioDocumentV3 } from '../../logic/document-v3';
import { useStudioViewportStore } from '../../state/studio-viewport-store';
import { StudioEditor } from '../StudioEditor';
import { TestRouter } from '@/test/router-wrapper';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/shared/hooks/useFixedToolbarController', () => ({
  useFixedToolbarController: () => ({ className: 'fixed' }),
}));
vi.mock('@/features/editor/ui/EditorSaveStatus', () => ({ EditorSaveStatus: () => null }));
vi.mock('@/features/editor/ui/OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: () => null,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton', () => ({ ShareButton: () => null }));
vi.mock('@/features/project-chat/ui/ProjectChatPanel', () => ({ ProjectChatPanel: () => null }));
vi.mock('@/features/groups/ui/GroupThemeSettings', () => ({ GroupThemeSettings: () => null }));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({ ImageEditorDialog: () => null }));

afterEach(cleanup);

const textOf = (node: StudioDocumentV3['nodes'][number]) =>
  node.type === 'richText'
    ? node.content
        .map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
        .join('')
    : '';

async function textEntryHarness() {
  useStudioViewportStore.getState().resetProject('text-entry-test');
  const initial = createStudioTemplateDocumentV5('single', 'Text entry', defaultBrand);
  let savedDocument: StudioDocumentV3 = initial;
  let transactDocument: ((change: (document: StudioDocumentV3) => void) => void) | null = null;

  function Harness() {
    const [v3Value, setV3Value] = useState<StudioDocumentV3>(initial);
    const [selected, setSelected] = useState<string[]>([]);
    const value = v3DocumentToLegacy(v3Value);
    const page = value.pages[0];
    const transactV3 = (change: (document: StudioDocumentV3) => void) => {
      setV3Value(current => {
        const next = structuredClone(current);
        change(next);
        savedDocument = next;
        return next;
      });
    };
    transactDocument = transactV3;
    const controller = new Proxy(
      {
        v3Value,
        value,
        page,
        active: page.elements.find(element => element.id === selected[0]),
        selected,
        selectExact: setSelected,
        transactV3,
        identity: { id: 'editor', name: 'Editor' },
        peers: [],
        assets: [],
        exports: [],
        exportPreparing: false,
        exportStatusError: false,
        exportFailure: '',
        exportFrames: [],
        exportFrameIds: [],
        elementSets: [],
        themes: [],
        theme: null,
        themePalette: null,
        canEdit: true,
        canUndo: false,
        canRedo: false,
        busy: false,
        error: '',
        failure: '',
        photoEdit: null,
        workspaceId: null,
        guides: false,
        status: 'saved',
        format: 'png',
        actions: { request: vi.fn() },
      },
      {
        get(target, key) {
          return key in target ? target[key as keyof typeof target] : vi.fn();
        },
      }
    );
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <StudioEditor
          c={controller as never}
          projectId="text-entry-test"
          groupId={null}
          open={vi.fn()}
        />
      </div>
    );
  }

  render(<Harness />, { wrapper: TestRouter });
  const host = await screen.findByTestId('studio-canvas', {}, { timeout: 15000 });
  await waitFor(() =>
    expect(host.querySelectorAll('.konvajs-content canvas').length).toBeGreaterThan(0)
  );
  const surface = [...host.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas')].at(-1)!;
  await waitFor(() => expect(surface.getBoundingClientRect().width).toBeGreaterThan(100));
  const bounds = surface.getBoundingClientRect();
  const start = { x: bounds.width / 2 - 40, y: bounds.height / 2 + 40 };
  const end = { x: start.x + 60, y: start.y + 40 };
  const textTool = screen.getByRole('button', { name: 'text' });
  return {
    initial,
    surface,
    start,
    end,
    textTool,
    saved: () => savedDocument,
    transact: (change: (document: StudioDocumentV3) => void) => transactDocument?.(change),
  };
}

it.each([414, 1280])(
  'renames layers at %ipx with real keyboard and blur events without triggering canvas shortcuts',
  async width => {
    await browserPage.viewport(width, 896);
    const { initial, saved } = await textEntryHarness();
    await userEvent.click(screen.getByRole('button', { name: 'layers' }));
    const panel = await screen.findByRole('dialog');
    // This browser harness does not load Tailwind; supply the panel's overlay positioning.
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '1000',
      top: '0',
      background: 'white',
    });
    const overlayStyle = document.createElement('style');
    overlayStyle.textContent = '[data-radix-popper-content-wrapper] { z-index: 1000 !important; }';
    panel.appendChild(overlayStyle);
    const layer = initial.nodes.find(node => node.type === 'richText')!;
    const row = within(panel)
      .getAllByRole('treeitem')
      .find(row => row.getAttribute('data-studio-layer-id') === layer.id)!;
    await userEvent.click(within(row).getByRole('button', { name: `rename: ${layer.name}` }));
    const input = within(row).getByRole('textbox') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, layer.name.length]);
    await userEvent.keyboard('Typed layer{ArrowLeft}{Delete}{Enter}');
    await waitFor(() =>
      expect(saved().nodes.find(node => node.id === layer.id)?.name).toBe('Typed laye')
    );
    expect(saved()).toEqual({
      ...initial,
      nodes: initial.nodes.map(node =>
        node.id === layer.id ? { ...node, name: 'Typed laye' } : node
      ),
    });
    await userEvent.click(within(row).getByRole('button', { name: 'rename: Typed laye' }));
    await userEvent.keyboard('Discarded{Escape}');
    expect(within(panel).queryByRole('textbox')).toBeNull();
    expect(saved().nodes.find(node => node.id === layer.id)?.name).toBe('Typed laye');
    expect(document.activeElement).toBe(
      within(row).getByRole('button', { name: 'rename: Typed laye' })
    );
    await userEvent.click(within(row).getByRole('button', { name: 'rename: Typed laye' }));
    await userEvent.keyboard('Blur saved');
    await userEvent.click(within(panel).getByRole('searchbox'));
    await waitFor(() =>
      expect(saved().nodes.find(node => node.id === layer.id)?.name).toBe('Blur saved')
    );
    expect(within(panel).queryByRole('textbox')).toBeNull();
    await userEvent.dblClick(within(row).getByRole('button', { name: 'Blur saved' }));
    expect(document.activeElement).toBe(within(row).getByRole('textbox'));
    await userEvent.keyboard('Double click saved{Enter}');
    await waitFor(() =>
      expect(saved().nodes.find(node => node.id === layer.id)?.name).toBe('Double click saved')
    );
    await browserPage.viewport(414, 896);
  }
);

it('types immediately after drawing with T and after one click on existing text in either tool', async () => {
  const { initial, surface, start, end, textTool, saved, transact } = await textEntryHarness();
  const initialTextCount = initial.nodes.filter(node => node.type === 'richText').length;

  await userEvent.click(textTool);
  await waitFor(() => expect(textTool).toHaveAttribute('aria-pressed', 'true'));
  await userEvent.dragAndDrop(surface, surface, {
    sourcePosition: start,
    targetPosition: end,
  } as never);
  await userEvent.keyboard('Hallo');

  const editor = await screen.findByLabelText('Text');
  await waitFor(() => expect(document.activeElement).toBe(editor));
  await waitFor(() => expect(editor).toHaveTextContent('Hallo'));
  await waitFor(() => expect(textTool).toHaveAttribute('aria-pressed', 'false'));
  await waitFor(() =>
    expect(saved().nodes.filter(node => node.type === 'richText')).toHaveLength(
      initialTextCount + 1
    )
  );
  await waitFor(() =>
    expect(saved().nodes.some(node => node.type === 'richText' && textOf(node) === 'Hallo')).toBe(
      true
    )
  );

  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'collapseProperties' }));
  await userEvent.click(textTool);
  const count = saved().nodes.length;
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  const existingEditor = await screen.findByLabelText('Text');
  const existingText = existingEditor.textContent;
  await waitFor(() => expect(document.activeElement).toBe(existingEditor));
  await userEvent.keyboard('X');
  await waitFor(() => expect(screen.getByLabelText('Text').textContent).toBe(`${existingText}X`));
  expect(saved().nodes).toHaveLength(count);

  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'selection' }));
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Text')));
  await userEvent.keyboard('Y');
  await waitFor(() => expect(screen.getByLabelText('Text').textContent).toBe(`${existingText}XY`));
  expect(saved().nodes).toHaveLength(count);
  await waitFor(() =>
    expect(
      saved().nodes.some(node => node.type === 'richText' && textOf(node) === `${existingText}XY`)
    ).toBe(true)
  );

  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Shift>}');
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  await userEvent.keyboard('{/Shift}');
  expect(screen.queryByLabelText('Text')).toBeNull();

  const existingNode = saved().nodes.find(
    node => node.type === 'richText' && textOf(node) === `${existingText}XY`
  );
  if (!existingNode) throw new Error('Expected edited text node');
  await act(async () => {
    transact(document => {
      const node = document.nodes.find(candidate => candidate.id === existingNode.id);
      if (node) node.locked = true;
    });
  });
  await userEvent.click(textTool);
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(saved().nodes).toHaveLength(count);

  await act(async () => {
    transact(document => {
      const node = document.nodes.find(candidate => candidate.id === existingNode.id);
      if (node) node.locked = false;
    });
  });
  await userEvent.click(screen.getByRole('button', { name: 'selection' }));
  await userEvent.dragAndDrop(surface, surface, {
    sourcePosition: { x: start.x + 12, y: start.y + 12 },
    targetPosition: { x: start.x + 34, y: start.y + 32 },
  } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(saved().nodes).toHaveLength(count);
});

it.each(['inside', 'outside'] as const)(
  'creates and focuses one overlapping text field when dragging ends %s the existing field',
  async destination => {
    const { surface, start, end, textTool, saved } = await textEntryHarness();
    await userEvent.click(textTool);
    await userEvent.dragAndDrop(surface, surface, {
      sourcePosition: start,
      targetPosition: end,
    } as never);
    await userEvent.keyboard('Original');
    await waitFor(() => expect(screen.getByLabelText('Text')).toHaveTextContent('Original'));
    const original = saved().nodes.find(
      node => node.type === 'richText' && textOf(node) === 'Original'
    )!;
    const before = saved().nodes.length;
    await userEvent.click(screen.getByRole('button', { name: 'collapseProperties' }));

    // Activating T must also close the current inline editor, which otherwise intercepts the drag.
    await userEvent.click(textTool);
    await waitFor(() => expect(screen.queryByLabelText('Text')).toBeNull());
    const sourcePosition = { x: start.x + 12, y: start.y + 12 };
    const targetPosition =
      destination === 'inside'
        ? { x: start.x + 60, y: start.y + 36 }
        : { x: start.x - 30, y: start.y - 30 };
    await userEvent.dragAndDrop(surface, surface, { sourcePosition, targetPosition } as never);
    await userEvent.keyboard('Overlay');
    await waitFor(() => expect(screen.getByLabelText('Text')).toHaveTextContent('Overlay'));
    expect(document.activeElement).toBe(screen.getByLabelText('Text'));
    expect(saved().nodes).toHaveLength(before + 1);
    const added = saved().nodes.find(
      node => node.type === 'richText' && textOf(node) === 'Overlay'
    )!;
    expect(added.id).not.toBe(original.id);
    expect(added.parentFrameId).toBe(original.parentFrameId);
    expect(added.zIndex).toBeGreaterThan(original.zIndex);
    expect(saved().nodes.find(node => node.id === original.id)).toEqual(original);
    expect(textTool).toHaveAttribute('aria-pressed', 'false');
  }
);
