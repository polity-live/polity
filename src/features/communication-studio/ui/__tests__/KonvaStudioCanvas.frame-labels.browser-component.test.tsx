import { createRef } from 'react';
import Konva from 'konva';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createFrameNode, createStudioDocumentV5 } from '../../logic/document-v3';
import KonvaStudioCanvas, { type StudioCanvasHandle } from '../KonvaStudioCanvas';

function fixture() {
  const document = createStudioDocumentV5('Frame labels');
  const frames = [520, 0, 260].map((x, index) =>
    createFrameNode('custom', {
      name: ['Welcome', 'Discussion', 'Closing'][index],
      zIndex: index,
      transform: { x, y: 100, width: 220, height: 200 },
    })
  );
  document.nodes = frames;
  document.show = { order: 'manual', cues: [] };
  return { document, frames };
}

async function mount(document = fixture().document, editable = true) {
  const ref = createRef<StudioCanvasHandle>();
  const changes = vi.fn();
  const select = vi.fn();
  const canvas = (value = document, fit?: 'contain') => (
    <div style={{ width: 1000, height: 700 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={value}
        activeFrameId={document.nodes[0].id}
        assets={[]}
        selected={editable ? [document.nodes[0].id] : []}
        selectExact={select}
        applyCanvasChanges={changes}
        editable={editable}
        fit={fit}
        guides={false}
      />
    </div>
  );
  const view = render(canvas());
  const host = screen.getByTestId('studio-canvas');
  const stage = Konva.stages.find(item => host.contains(item.container()))!;
  await waitFor(() => expect(stage.width()).toBe(1000));
  await act(() => ref.current!.execute({ type: 'zoom', mode: 'reset' }));
  const label = (id: string) =>
    host.querySelector<HTMLSpanElement>(`[data-studio-frame-label="${id}"]`)!;
  return { ref, view, canvas, stage, host, label, changes, select };
}

it('numbers visible root frames in layer order, independently of canvas positions, and updates after edits', async () => {
  const { document, frames } = fixture();
  const { view, canvas, host, label } = await mount(document);
  expect(frames.map(frame => label(frame.id).textContent)).toEqual([
    '1 · Welcome',
    '2 · Discussion',
    '3 · Closing',
  ]);
  expect(parseFloat(label(frames[0].id).style.left)).toBeGreaterThan(
    parseFloat(label(frames[1].id).style.left)
  );

  const next = structuredClone(document);
  next.nodes[2].zIndex = -1;
  next.nodes[0].name = 'Introduction';
  view.rerender(canvas(next));
  expect(label(frames[2].id).textContent).toBe('1 · Closing');
  expect(label(frames[0].id).textContent).toBe('2 · Introduction');
  expect(label(frames[1].id).textContent).toBe('3 · Discussion');

  const hidden = structuredClone(next);
  hidden.nodes[2].visible = false;
  view.rerender(canvas(hidden));
  expect(label(frames[2].id)).toBeNull();
  expect(label(frames[0].id).textContent).toBe('1 · Introduction');
  expect(label(frames[1].id).textContent).toBe('2 · Discussion');

  const agenda = structuredClone(hidden);
  agenda.show!.order = 'agenda';
  view.rerender(canvas(agenda));
  expect(label(frames[0].id).textContent).toBe('1 · Introduction');
  expect(label(frames[1].id).textContent).toBe('2 · Discussion');
  delete agenda.show;
  view.rerender(canvas(structuredClone(agenda)));
  expect(label(frames[0].id).textContent).toBe('1 · Introduction');

  view.rerender(canvas(agenda, 'contain'));
  expect(host.querySelectorAll('[data-studio-frame-label]')).toHaveLength(0);
});

it('labels nested frames by name, excludes the master, and respects hidden ancestors in a read-only workspace', async () => {
  const { document, frames } = fixture();
  const nested = createFrameNode('custom', {
    name: 'Nested frame',
    parentFrameId: frames[0].id,
    transform: { x: 30, y: 60, width: 80, height: 60 },
  });
  const master = createFrameNode('custom', { name: 'Master', zIndex: -100 });
  const masterChild = createFrameNode('custom', { name: 'Master child', parentFrameId: master.id });
  document.nodes.push(nested, master, masterChild);
  document.masterLayout.frameId = master.id;
  const { label, view, canvas, host, stage } = await mount(document, false);
  expect(label(nested.id).textContent).toBe('Nested frame');
  expect(label(master.id)).toBeNull();
  expect(label(masterChild.id)).toBeNull();
  expect(label(frames[0].id).textContent).toBe('1 · Welcome');
  expect(parseFloat(label(nested.id).style.left)).toBeCloseTo(
    (520 + 30) * stage.scaleX() + stage.x()
  );
  expect(parseFloat(label(nested.id).style.top)).toBeCloseTo(
    (100 + 60) * stage.scaleY() + stage.y() - 6
  );

  const next = structuredClone(document);
  next.nodes[0].visible = false;
  view.rerender(canvas(next));
  expect(label(nested.id)).toBeNull();
  expect(host.querySelectorAll('[data-studio-frame-label]')).toHaveLength(2);
  expect(label(frames[1].id).textContent).toBe('1 · Discussion');
});

it('keeps labels six pixels above frame bounds with constant text size through zoom, pan, and live transforms', async () => {
  const { document, frames } = fixture();
  const nested = createFrameNode('custom', {
    name: 'Nested',
    parentFrameId: frames[0].id,
    transform: { x: 30, y: 60, width: 80, height: 60 },
  });
  document.nodes.push(nested);
  const { ref, stage, label, view, canvas, host } = await mount(document);
  const element = label(frames[0].id);
  const checkPosition = () => {
    expect(parseFloat(element.style.left)).toBeCloseTo(520 * stage.scaleX() + stage.x());
    const bounds = element.getBoundingClientRect();
    expect(bounds.bottom - host.getBoundingClientRect().top).toBeCloseTo(
      100 * stage.scaleY() + stage.y() - 6,
      1
    );
    expect(getComputedStyle(element).fontSize).toBe('12px');
    expect(getComputedStyle(element).pointerEvents).toBe('none');
  };
  checkPosition();
  await act(() => ref.current!.execute({ type: 'zoom', mode: 'in' }));
  checkPosition();
  const content = host.querySelector('.konvajs-content')!;
  fireEvent.wheel(content.querySelector('canvas')!, { deltaX: 20, deltaY: 30 });
  await waitFor(checkPosition);

  const group = stage.findOne<Konva.Group>(`#${frames[0].id}`)!;
  const initialLeft = parseFloat(element.style.left);
  const nestedLeft = parseFloat(label(nested.id).style.left);
  const nestedTop = parseFloat(label(nested.id).style.top);
  await act(() => {
    group.x(group.x() + 40);
    group.y(group.y() + 25);
    group.getLayer()!.draw();
  });
  expect(parseFloat(element.style.left) - initialLeft).toBeCloseTo(40 * stage.scaleX());
  expect(parseFloat(label(nested.id).style.left) - nestedLeft).toBeCloseTo(40 * stage.scaleX());
  expect(parseFloat(label(nested.id).style.top) - nestedTop).toBeCloseTo(25 * stage.scaleY());

  await act(() => {
    group.scaleX(1.5);
    group.getLayer()!.draw();
  });
  expect(parseFloat(element.style.maxWidth)).toBeCloseTo(220 * 1.5 * stage.scaleX());

  // End the transient gesture before committing the next document transform.
  await act(() => {
    group.position({ x: 630, y: 200 });
    group.scaleX(1);
    group.getLayer()!.draw();
  });

  const rotated = structuredClone(document);
  rotated.nodes[0].transform.rotation = 90;
  rotated.nodes[0].transform.flipX = true;
  view.rerender(canvas(rotated));
  // A 220×200 frame rotated around its center becomes 200×220 at (530, 90).
  expect(parseFloat(element.style.left)).toBeCloseTo(530 * stage.scaleX() + stage.x());
  expect(parseFloat(element.style.top)).toBeCloseTo(90 * stage.scaleY() + stage.y() - 6);
  expect(parseFloat(element.style.maxWidth)).toBeCloseTo(200 * stage.scaleX());
});

it('truncates long names without adding text to the exported Konva scene or intercepting canvas input', async () => {
  const { document, frames } = fixture();
  frames[1].name = 'A long frame name '.repeat(30);
  const { host, label, stage, select } = await mount(document);
  const element = label(frames[1].id);
  expect(element.title).toBe(`2 · ${frames[1].name}`);
  expect(element.scrollWidth).toBeGreaterThan(element.clientWidth);
  expect(getComputedStyle(element).textOverflow).toBe('ellipsis');
  expect(stage.find('Text')).toHaveLength(0);

  const rect = element.getBoundingClientRect();
  const underlying = window.document.elementFromPoint(rect.left + 10, rect.top + rect.height / 2);
  expect(underlying).toBeInstanceOf(HTMLCanvasElement);
  await userEvent.click(underlying!, {
    position: {
      x: rect.left + 10 - underlying!.getBoundingClientRect().left,
      y: rect.top + rect.height / 2 - underlying!.getBoundingClientRect().top,
    },
  });
  expect(select).toHaveBeenCalledWith([]);
  expect(host.querySelectorAll('[data-studio-frame-label]')).toHaveLength(3);
});

it.each(['nested', 'root'] as const)(
  'separates names when a %s frame shares another frame origin, including after zooming',
  async kind => {
    const { document, frames } = fixture();
    const nested = createFrameNode('custom', {
      name: 't1',
      parentFrameId: kind === 'nested' ? frames[1].id : null,
      zIndex: 3,
      transform: { x: 0, y: kind === 'nested' ? 0 : 100, width: 220, height: 200 },
    });
    frames[1].name = 'amendment';
    document.nodes.push(nested);
    const { label, ref, stage } = await mount(document);
    const check = () => {
      const parentBounds = label(frames[1].id).getBoundingClientRect();
      const nestedBounds = label(nested.id).getBoundingClientRect();
      expect(nestedBounds.bottom).toBeLessThanOrEqual(parentBounds.top);
      expect(label(frames[1].id).textContent).toBe('2 · amendment');
      expect(label(nested.id).textContent).toBe(kind === 'nested' ? 't1' : '4 · t1');
      expect(parseFloat(label(frames[1].id).style.top)).toBeCloseTo(
        100 * stage.scaleY() + stage.y() - 6
      );
    };
    check();
    await act(() => ref.current!.execute({ type: 'zoom', mode: 'in' }));
    check();
  }
);
