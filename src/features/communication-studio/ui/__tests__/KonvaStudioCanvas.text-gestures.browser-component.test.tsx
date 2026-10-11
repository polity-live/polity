import { createRef, useState, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { page as browserPage, userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
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
      multipleSelection ? [text.id, frame.id] : []
    );
    const [value, setValue] = useState(document);
    return (
      <div style={{ width: 1000, height: 700 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={value}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={selectExact}
          editable={editable}
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
  const pointer = (
    type: 'down' | 'move' | 'up' | 'cancel',
    dx = 0,
    dy = 0,
    shiftKey = false,
    pointerId = 7
  ) => {
    const point = client();
    const event = {
      pointerId,
      pointerType: 'mouse',
      button: 0,
      clientX: point.clientX + dx,
      clientY: point.clientY + dy,
      shiftKey,
    };
    if (type === 'down') fireEvent.pointerDown(surface, event);
    if (type === 'move') fireEvent.pointerMove(surface, event);
    if (type === 'up') fireEvent.pointerUp(surface, event);
    if (type === 'cancel') fireEvent.pointerCancel(surface, event);
  };
  const position = () => {
    const bounds = surface.getBoundingClientRect();
    const point = client();
    return { x: point.clientX - bounds.left, y: point.clientY - bounds.top };
  };
  const touch = (type: 'start' | 'move' | 'end', dx = 0, dy = 0) => {
    const point = client();
    const finger = new Touch({
      identifier: 38,
      target: surface,
      clientX: point.clientX + dx,
      clientY: point.clientY + dy,
    });
    fireEvent(
      surface,
      new TouchEvent(`touch${type}`, {
        bubbles: true,
        cancelable: true,
        touches: type === 'end' ? [] : [finger],
        changedTouches: [finger],
      })
    );
  };
  return {
    ref,
    state,
    surface,
    create,
    changes,
    changeText,
    pointer,
    touch,
    position,
    client,
    text,
    frame,
    document,
    host,
  };
}

it.each(['mouse', 'touch'] as const)(
  'selects text without editing, edits with the button, and keeps it movable after Done (%s)',
  async input => {
    const { surface, position, touch, text, host, changes, changeText, state } = await harness({
      tool: 'selection',
    });
    if (input === 'mouse') await userEvent.click(surface, { position: position() } as never);
    else {
      touch('start');
      touch('end');
    }
    expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
    expect(screen.queryByLabelText('Text')).toBeNull();
    const edit = await screen.findByRole('button', { name: 'Edit text' });
    expect(edit.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(edit.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    if (input === 'mouse') {
      edit.focus();
      await userEvent.keyboard('{Enter}');
    } else await userEvent.click(edit);
    const editor = screen.getByLabelText('Text');
    expect(window.document.activeElement).toBe(editor);
    await userEvent.keyboard('Added text');
    expect(editor).toHaveTextContent('Added text');
    expect(changeText).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('Text')).toBeNull();
    expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
    expect(window.document.activeElement).toBe(host);
    await userEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    expect(screen.getByLabelText('Text')).toHaveTextContent('Added text');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    if (input === 'mouse') {
      const start = position();
      await userEvent.dragAndDrop(surface, surface, {
        sourcePosition: start,
        targetPosition: { x: start.x + 50, y: start.y + 30 },
      } as never);
    } else {
      touch('start');
      touch('move', 20, 10);
      touch('move', 50, 30);
      touch('end', 50, 30);
    }
    expect(screen.queryByLabelText('Text')).toBeNull();
    await waitFor(() => expect(changes).toHaveBeenCalledOnce());
    const transform = changes.mock.calls[0][0][0].transform;
    expect(Number.isFinite(transform.dx)).toBe(true);
    expect(Number.isFinite(transform.dy)).toBe(true);
    expect(transform.dx).toBeGreaterThan(0);
    expect(transform.dy).toBeGreaterThan(0);
    if (input === 'touch') {
      expect(transform.dx).toBeCloseTo(50 / state.current!.zoom);
      expect(transform.dy).toBeCloseTo(30 / state.current!.zoom);
    }
  }
);

it('focuses the editor synchronously on a double tap and keeps the selection after Escape', async () => {
  const { touch, text } = await harness({ tool: 'selection' });
  touch('start');
  touch('end');
  expect(screen.queryByLabelText('Text')).toBeNull();
  touch('start');
  touch('end');
  const editor = screen.getByLabelText('Text');
  expect(window.document.activeElement).toBe(editor);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
});

it.each([{ locked: true }, { editable: false }])(
  'prevents button, double tap and Enter editing when %j',
  async options => {
    const { touch, host, text } = await harness({ ...options, tool: 'selection' });
    touch('start');
    touch('end');
    touch('start');
    touch('end');
    expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
    expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
    fireEvent.keyDown(host, { key: 'Enter' });
    expect(screen.queryByLabelText('Text')).toBeNull();
  }
);

it('opens single selected text with Enter and ends editing on an outside selection', async () => {
  const { surface, position, host } = await harness({ tool: 'selection' });
  await userEvent.click(surface, { position: position() } as never);
  host.focus();
  await userEvent.keyboard('{Enter}');
  expect(window.document.activeElement).toBe(screen.getByLabelText('Text'));
  const lowerSurface = host.querySelector<HTMLCanvasElement>('canvas')!;
  await userEvent.click(lowerSurface, { position: { x: 5, y: 5 } } as never);
  expect(screen.queryByLabelText('Text')).toBeNull();
});

it('does not offer or open the text editor for a multiple selection', async () => {
  const { host, text, frame } = await harness({ tool: 'selection', multipleSelection: true });
  expect(screen.getByTestId('selected-text')).toHaveTextContent(`${text.id},${frame.id}`);
  expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
  fireEvent.keyDown(host, { key: 'Enter' });
  expect(screen.queryByLabelText('Text')).toBeNull();
});

it('does not edit text after a two-finger gesture or Shift double click', async () => {
  const { surface, client, position } = await harness({ tool: 'selection' });
  const point = client();
  const fingers = [1, 2].map(identifier => new Touch({ identifier, target: surface, ...point }));
  for (const type of ['touchstart', 'touchend']) {
    fireEvent(
      surface,
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : fingers,
        changedTouches: fingers,
      })
    );
  }
  expect(screen.queryByLabelText('Text')).toBeNull();
  await userEvent.keyboard('{Shift>}');
  await userEvent.dblClick(surface, { position: position() } as never);
  await userEvent.keyboard('{/Shift}');
  expect(screen.queryByLabelText('Text')).toBeNull();
});

it('accepts a touch pointer without a mouse button and edits the actual text node', async () => {
  const { surface, client, text, create } = await harness();
  const event = { ...client(), pointerId: 38, pointerType: 'touch', button: -1 };
  fireEvent.pointerDown(surface, event);
  fireEvent.pointerUp(surface, event);
  await screen.findByLabelText('Text');
  expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
  expect(create).not.toHaveBeenCalled();
});

it('does not select or recreate a text node removed by a remote update before pointer release', async () => {
  const { pointer, create } = await harness();
  pointer('down');
  fireEvent.click(screen.getByRole('button', { name: 'Remove remote text' }));
  pointer('up');
  expect(screen.queryByLabelText('Text')).toBeNull();
  expect(screen.getByTestId('selected-text')).toBeEmptyDOMElement();
  expect(create).not.toHaveBeenCalled();
});

it.each(['click', 'drag', 'cancel'] as const)(
  'handles text creation on blank frame space with a %s gesture',
  async action => {
    const { ref, state, surface, create, frame, document, host } = await harness();
    const bounds = host.querySelector<HTMLElement>('.konvajs-content')!.getBoundingClientRect();
    const origin = ref.current!.scenePoint(bounds.left, bounds.top);
    const frameBounds = worldBounds(document, frame);
    const clientX = bounds.left + (frameBounds.left + 40 - origin.x) * state.current!.zoom;
    const clientY = bounds.top + (frameBounds.top + 40 - origin.y) * state.current!.zoom;
    const pointer = { pointerId: 29, pointerType: 'mouse', button: 0, clientX, clientY };
    fireEvent.pointerDown(surface, pointer);
    if (action === 'drag')
      fireEvent.pointerMove(surface, { ...pointer, clientX: clientX + 40, clientY: clientY + 30 });
    if (action === 'cancel') fireEvent.pointerCancel(surface, pointer);
    fireEvent.pointerUp(surface, {
      ...pointer,
      clientX: clientX + (action === 'drag' ? 40 : 0),
      clientY: clientY + (action === 'drag' ? 30 : 0),
    });
    expect(screen.queryByLabelText('Text')).toBeNull();
    if (action === 'cancel') expect(create).not.toHaveBeenCalled();
    else {
      expect(create).toHaveBeenCalledOnce();
      expect(create.mock.calls[0][0]).toBe('text');
      const [, start, end] = create.mock.calls[0];
      expect(end.x - start.x).toBeCloseTo(action === 'drag' ? 40 / state.current!.zoom : 0);
      expect(end.y - start.y).toBeCloseTo(action === 'drag' ? 30 / state.current!.zoom : 0);
    }
  }
);

it.each(['initial', 'zoomed'] as const)(
  'uses a four-screen-pixel drag threshold at %s zoom',
  async zoom => {
    const { ref, create, pointer, text } = await harness();
    if (zoom === 'zoomed') await act(() => ref.current!.execute({ type: 'zoom', mode: 'in' }));
    pointer('down');
    pointer('move', 2, 1);
    pointer('up', 2, 1);
    await waitFor(() => expect(screen.getByLabelText('Text')).toBeTruthy());
    expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
    expect(create).not.toHaveBeenCalled();
    await act(() => ref.current!.execute({ type: 'setTool', tool: 'text' }));
    pointer('down');
    pointer('move', 4);
    pointer('up', 4);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toBe('text');
    expect(screen.queryByLabelText('Text')).toBeNull();
  }
);

it('keeps Shift-click selection and locked-text clicks without opening an editor', async () => {
  const { pointer, create, text } = await harness({ locked: true });
  pointer('down');
  pointer('up');
  expect(screen.getByTestId('selected-text')).toHaveTextContent(text.id);
  expect(screen.queryByLabelText('Text')).toBeNull();
  pointer('down', 0, 0, true);
  pointer('up', 0, 0, true);
  expect(screen.getByTestId('selected-text')).toBeEmptyDOMElement();
  expect(create).not.toHaveBeenCalled();
  pointer('down');
  pointer('move', 40, 30);
  pointer('up', 40, 30);
  expect(create).toHaveBeenCalledTimes(1);
});

it.each([
  'pointercancel',
  'escape',
  'focused escape',
  'tool change',
  'blur',
  'multitouch',
] as const)('cancels overlapping text creation on %s and allows the next gesture', async reason => {
  const { pointer, ref, surface, client, create } = await harness();
  pointer('down');
  pointer('move', 40, 30);
  if (reason === 'pointercancel') pointer('cancel', 40, 30);
  if (reason === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
  if (reason === 'focused escape') {
    const host = screen.getByTestId('studio-canvas');
    host.focus();
    fireEvent.keyDown(host, { key: 'Escape' });
  }
  if (reason === 'tool change')
    await act(() => ref.current!.execute({ type: 'setTool', tool: 'selection' }));
  if (reason === 'blur') fireEvent.blur(window);
  if (reason === 'multitouch') {
    const point = client();
    const touches = [1, 2].map(identifier => new Touch({ identifier, target: surface, ...point }));
    fireEvent(
      surface,
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches,
        changedTouches: touches,
      })
    );
    fireEvent(
      surface,
      new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: touches,
      })
    );
  }
  pointer('up', 40, 30);
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Text')).toBeNull();
  await act(() => ref.current!.execute({ type: 'setTool', tool: 'text' }));
  pointer('down');
  pointer('move', 40, 30);
  pointer('up', 40, 30);
  expect(create).toHaveBeenCalledTimes(1);
});

it('ignores other pointers while dragging and creates once for the initiating pointer', async () => {
  const { pointer, create } = await harness();
  pointer('down');
  pointer('down', 40, 30, false, 8);
  pointer('move', 40, 30, false, 8);
  pointer('up', 40, 30, false, 8);
  pointer('cancel', 40, 30, false, 8);
  expect(create).not.toHaveBeenCalled();
  pointer('move', 40, 30);
  pointer('up', 40, 30);
  pointer('up', 40, 30);
  expect(create).toHaveBeenCalledTimes(1);
});

it('keeps the text tool active after creation when the tool is locked', async () => {
  const { pointer, create, state, text } = await harness({ toolLocked: true });
  create.mockReturnValue(text.id);
  pointer('down');
  pointer('move', 40, 30);
  pointer('up', 40, 30);
  await waitFor(() => expect(screen.getByLabelText('Text')).toBeTruthy());
  expect(create).toHaveBeenCalledTimes(1);
  expect(state.current?.activeTool).toBe('text');
  expect(state.current?.toolLocked).toBe(true);
});

it('does not create text in a read-only canvas', async () => {
  const { pointer, create } = await harness({ editable: false });
  pointer('down');
  pointer('move', 40, 30);
  pointer('up', 40, 30);
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Text')).toBeNull();
});
