import { createRef, useState, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { worldBounds } from '../../logic/selection-geometry';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';

afterEach(cleanup);

async function harness({ locked = false, toolLocked = false, editable = true } = {}) {
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
  function Harness() {
    const [selected, selectExact] = useState<string[]>([]);
    return (
      <div style={{ width: 1000, height: 700 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={document}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={selectExact}
          editable={editable}
          onCreateNode={create}
          onCanvasStateChange={value => {
            state.current = value;
          }}
        />
        <output data-testid="selected-text">{selected.join(',')}</output>
      </div>
    );
  }
  render(<Harness />);
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(state.current?.zoom).toBeLessThan(1));
  await act(() => ref.current!.execute({ type: 'setTool', tool: 'text', locked: toolLocked }));
  const surface = host.querySelector<HTMLCanvasElement>('canvas')!;
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
  return { ref, state, surface, create, pointer, client, text };
}

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

it.each(['pointercancel', 'escape', 'tool change', 'blur', 'multitouch'] as const)(
  'cancels overlapping text creation on %s and allows the next gesture',
  async reason => {
    const { pointer, ref, surface, client, create } = await harness();
    pointer('down');
    pointer('move', 40, 30);
    if (reason === 'pointercancel') pointer('cancel', 40, 30);
    if (reason === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
    if (reason === 'tool change')
      await act(() => ref.current!.execute({ type: 'setTool', tool: 'selection' }));
    if (reason === 'blur') fireEvent.blur(window);
    if (reason === 'multitouch') {
      const point = client();
      const touches = [1, 2].map(
        identifier => new Touch({ identifier, target: surface, ...point })
      );
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
  }
);

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
