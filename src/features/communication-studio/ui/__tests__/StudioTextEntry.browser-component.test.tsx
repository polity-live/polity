import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { v3DocumentToLegacy } from '../../logic/v3-adapter';
import type { StudioDocumentV3 } from '../../logic/document-v3';
import { useStudioViewportStore } from '../../state/studio-viewport-store';
import { StudioEditor } from '../StudioEditor';

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

it('types immediately after drawing with T and after one click on existing text in either tool', async () => {
  useStudioViewportStore.getState().resetProject('text-entry-test');
  const initial = createStudioTemplateDocumentV5('single', 'Text entry', defaultBrand);
  let savedDocument: StudioDocumentV3 = initial;
  let transactDocument: ((change: (document: StudioDocumentV3) => void) => void) | null = null;
  const initialTextCount = initial.nodes.filter(node => node.type === 'richText').length;
  const textOf = (node: StudioDocumentV3['nodes'][number]) =>
    node.type === 'richText'
      ? node.content
          .map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
          .join('')
      : '';

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

  render(<Harness />);
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
    expect(savedDocument.nodes.filter(node => node.type === 'richText')).toHaveLength(
      initialTextCount + 1
    )
  );
  await waitFor(() =>
    expect(
      savedDocument.nodes.some(node => node.type === 'richText' && textOf(node) === 'Hallo')
    ).toBe(true)
  );

  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'collapseProperties' }));
  await userEvent.click(textTool);
  const count = savedDocument.nodes.length;
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  const existingEditor = await screen.findByLabelText('Text');
  const existingText = existingEditor.textContent;
  await waitFor(() => expect(document.activeElement).toBe(existingEditor));
  await userEvent.keyboard('X');
  await waitFor(() => expect(screen.getByLabelText('Text').textContent).toBe(`${existingText}X`));
  expect(savedDocument.nodes).toHaveLength(count);

  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'selection' }));
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Text')));
  await userEvent.keyboard('Y');
  await waitFor(() => expect(screen.getByLabelText('Text').textContent).toBe(`${existingText}XY`));
  expect(savedDocument.nodes).toHaveLength(count);
  await waitFor(() =>
    expect(
      savedDocument.nodes.some(
        node => node.type === 'richText' && textOf(node) === `${existingText}XY`
      )
    ).toBe(true)
  );

  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Shift>}');
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  await userEvent.keyboard('{/Shift}');
  expect(screen.queryByLabelText('Text')).toBeNull();

  const existingNode = savedDocument.nodes.find(
    node => node.type === 'richText' && textOf(node) === `${existingText}XY`
  );
  if (!existingNode) throw new Error('Expected edited text node');
  await act(async () => {
    transactDocument?.(document => {
      const node = document.nodes.find(candidate => candidate.id === existingNode.id);
      if (node) node.locked = true;
    });
  });
  await userEvent.click(textTool);
  await userEvent.click(surface, { position: { x: start.x + 12, y: start.y + 12 } } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(savedDocument.nodes).toHaveLength(count);

  await act(async () => {
    transactDocument?.(document => {
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
  expect(savedDocument.nodes).toHaveLength(count);
});
