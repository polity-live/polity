import { expect, it } from 'vitest';
import { canvasFocusTarget, canvasFocusView, freeCanvasRectangle } from '../canvas-focus';
import { createFrameNode } from '../document-v3';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { defaultBrand } from '../document';

it('resolves nested rotated frames from the live hierarchy and allows locked objects', () => {
  const document = createStudioTemplateDocumentV5('single', 'Focus', defaultBrand);
  const root = document.nodes.find(node => node.type === 'frame')!;
  root.transform.x = 200;
  root.transform.rotation = 25;
  const nested = createFrameNode('custom', {
    parentFrameId: root.id,
    transform: { x: 30, y: 40, width: 300, height: 200, rotation: 15 },
  });
  document.nodes.push(nested);
  const node = document.nodes.find(node => node.type === 'richText')!;
  node.parentFrameId = nested.id;
  node.locked = true;
  const target = canvasFocusTarget(document, node.id);
  expect(target.frameId).toBe(root.id);
  expect(target.bounds.right).toBeGreaterThan(target.bounds.left);
  expect(target.bounds.left).not.toBe(node.transform.x);
  nested.visible = false;
  expect(() => canvasFocusTarget(document, node.id)).toThrow();
  nested.visible = true;
  root.visible = false;
  expect(() => canvasFocusTarget(document, node.id)).toThrow();
  expect(() => canvasFocusTarget(document, 'deleted')).toThrow();
});
it('finds the largest free rectangle beside desktop chat and above mobile chat', () => {
  const viewport = { left: 0, top: 0, right: 1000, bottom: 700 };
  expect(
    freeCanvasRectangle(viewport, [{ left: 700, top: 150, right: 1000, bottom: 700 }])
  ).toEqual({ left: 0, top: 0, right: 700, bottom: 700 });
  expect(
    freeCanvasRectangle({ ...viewport, right: 390 }, [
      { left: 0, top: 220, right: 390, bottom: 700 },
    ])
  ).toEqual({ left: 0, top: 0, right: 390, bottom: 220 });
  expect(freeCanvasRectangle(viewport, [viewport])).toBeNull();
  expect(
    freeCanvasRectangle(viewport, [{ left: -100, top: -100, right: -10, bottom: -10 }])
  ).toEqual(viewport);
});
it('retains zoom for small elements and reduces it to fit large elements with padding', () => {
  const free = { left: 200, top: 0, right: 800, bottom: 500 };
  const small = { left: 1000, top: 1200, right: 1100, bottom: 1300 };
  expect(canvasFocusView(small, free, 0.8)).toEqual({ zoom: 0.8, pan: { x: -340, y: -750 } });
  const large = canvasFocusView({ left: 0, top: 0, right: 1000, bottom: 1000 }, free, 1);
  expect(large.zoom).toBeCloseTo(0.436);
  expect(large.pan.x + 500 * large.zoom).toBeCloseTo(500);
  expect(large.pan.y + 500 * large.zoom).toBeCloseTo(250);
  expect(() => canvasFocusView(small, { left: 0, top: 0, right: 20, bottom: 20 }, 1)).toThrow();
});
