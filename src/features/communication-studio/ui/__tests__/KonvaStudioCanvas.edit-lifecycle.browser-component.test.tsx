import { createRef, useState, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page as browserPage, userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { shapeNodeSchema } from '../../logic/document-v3';
import { worldBounds } from '../../logic/selection-geometry';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';

afterEach(cleanup);

async function harness({
  locked = false,
  toolLocked = false,
  editable = true,
  tool = 'text' as 'text' | 'selection',
  multipleSelection = false,
  transition = 'normal' as
    'normal' | 'readonly' | 'removed' | 'replaced' | 'locked' | 'multiple' | 'deferred',
} = {}) {
  await browserPage.viewport(1280, 1000);
  const document = createStudioTemplateDocumentV5('single', 'Text gestures', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const text = document.nodes.find(node => node.type === 'richText')!;
  text.transform = { ...text.transform, x: 100, y: 100, width: 400, height: 200 };
  text.locked = locked;
  document.nodes = [frame, text];
  const ref = createRef<StudioCanvasHandle>();
  const state: { current: StudioCanvasState | null } = { current: null };
  const create = vi.fn<NonNullable<ComponentProps<typeof KonvaStudioCanvas>['onCreateNode']>>(
    () => null
  );
  const changes = vi.fn();
  const changeText = vi.fn();
  function Harness() {
    const [selected, selectExact] = useState<string[]>(
      multipleSelection ? [text.id, frame.id] : [text.id]
    );
    const [value, setValue] = useState(document);
    const [canEdit, setCanEdit] = useState(editable);
    return (
      <div style={{ width: 1000, height: 700 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={value}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={ids => {
            if (ids.length) {
              if (transition === 'readonly') setCanEdit(false);
              if (transition === 'removed')
                setValue(current => ({
                  ...current,
                  nodes: current.nodes.filter(node => node.id !== text.id),
                }));
              if (transition === 'replaced')
                setValue(current => ({
                  ...current,
                  nodes: current.nodes.map(node =>
                    node.id === text.id
                      ? shapeNodeSchema.parse({ ...node, type: 'shape', shape: 'rectangle' })
                      : node
                  ),
                }));
              if (transition === 'locked')
                setValue(current => ({
                  ...current,
                  nodes: current.nodes.map(node =>
                    node.id === text.id ? { ...node, locked: true } : node
                  ),
                }));
              selectExact(
                transition === 'multiple'
                  ? [text.id, frame.id]
                  : transition === 'deferred'
                    ? []
                    : ids
              );
            } else selectExact(ids);
          }}
          editable={canEdit}
          onCreateNode={create}
          applyCanvasChanges={changes}
          onTextChange={(id, content) => {
            changeText(id, content);
            setValue(current => ({
              ...current,
              nodes: current.nodes.map(node =>
                node.id === id && node.type === 'richText' ? { ...node, content } : node
              ),
            }));
          }}
          onCanvasStateChange={value => {
            state.current = value;
          }}
        />
        <output data-testid="selected-text">{selected.join(',')}</output>
        <button onClick={() => selectExact([text.id])}>Confirm deferred selection</button>
        <button
          onClick={() =>
            setValue(current => ({
              ...current,
              nodes: current.nodes.filter(node => node.id !== text.id),
            }))
          }
        >
          Remove remote text
        </button>
      </div>
    );
  }
  render(<Harness />);
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(state.current?.zoom).toBeLessThan(1));
  await act(() => ref.current!.execute({ type: 'setTool', tool, locked: toolLocked }));
  const surface = [...host.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas')].at(-1)!;
  const client = () => {
    const bounds = host.querySelector<HTMLElement>('.konvajs-content')!.getBoundingClientRect();
    const origin = ref.current!.scenePoint(bounds.left, bounds.top);
    const node = worldBounds(document, text);
    return {
      clientX: bounds.left + (node.left + 50 - origin.x) * state.current!.zoom,
      clientY: bounds.top + (node.top + 50 - origin.y) * state.current!.zoom,
    };
  };
  const position = () => {
    const bounds = surface.getBoundingClientRect();
    const point = client();
    return { x: point.clientX - bounds.left, y: point.clientY - bounds.top };
  };
  return {
    ref,
    state,
    surface,
    create,
    changes,
    changeText,
    position,
    text,
    frame,
    document,
    host,
  };
}

it.each(['readonly', 'removed', 'replaced', 'locked', 'multiple'] as const)(
  'rechecks the requested text after its selection transaction becomes %s',
  async transition => {
    const { host, changeText, create } = await harness({ tool: 'selection', transition });
    host.focus();
    fireEvent.keyDown(host, { key: 'Enter' });
    expect(screen.queryByLabelText('Text')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
    expect(changeText).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  }
);

it('waits for the controlled selection acknowledgment before opening the requested editor', async () => {
  const { host, text } = await harness({ tool: 'selection', transition: 'deferred' });
  fireEvent.keyDown(host, { key: 'Enter' });
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.getByTestId('selected-text')).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deferred selection' }));
  expect(screen.getByLabelText('Text')).toBeTruthy();
  expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
});

it('finishes editing when Escape is pressed on the canvas host and preserves the text selection', async () => {
  const { host, text } = await harness({ tool: 'selection' });
  fireEvent.keyDown(host, { key: 'Enter' });
  const editor = screen.getByLabelText('Text');
  expect(window.document.activeElement).toBe(editor);
  host.focus();
  fireEvent.keyDown(host, { key: 'Escape' });
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
  expect(window.document.activeElement).toBe(host);
});

it('keeps a double-clicked text node out of the editor while multiple nodes remain selected', async () => {
  const { surface, position, text, frame } = await harness({
    tool: 'selection',
    multipleSelection: true,
    transition: 'multiple',
  });
  await userEvent.dblClick(surface, { position: position() } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.getByTestId('selected-text')).toHaveTextContent(`${text.id},${frame.id}`);
});

it('keeps a text double click as navigation while the hand tool is active', async () => {
  const { ref, surface, position } = await harness({ tool: 'selection' });
  await act(() => ref.current!.execute({ type: 'setTool', tool: 'hand' }));
  await userEvent.dblClick(surface, { position: position() } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
});
