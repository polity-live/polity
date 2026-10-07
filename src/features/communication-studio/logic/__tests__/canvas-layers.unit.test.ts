import { expect, it } from 'vitest';
import { canvasLayers } from '../canvas-layers';
import { makePage } from '../templates';
import { element } from '../document';
it('preserves mixed layer order, groups adjacent native objects and excludes hidden objects', () => {
  const page = makePage('Layers', 'feed', undefined, 0, 'blank');
  const visible = element('rect', { order: 0 });
  page.elements = [visible, element('rect', { visible: false })];
  const native = (id: string, customData?: any, isDeleted = false) =>
    ({ id, customData, isDeleted }) as any;
  page.canvas = {
    elements: [
      native('b'),
      native('a'),
      native('after', { polityOrder: 1 }),
      native('deleted', {}, true),
    ],
  } as any;
  const result = canvasLayers(page);
  expect(result.map(layer => layer.kind)).toEqual(['native', 'polity', 'native']);
  expect(result[0]).toMatchObject({ elements: [{ id: 'b' }, { id: 'a' }] });
  expect(result[1]).toMatchObject({ element: { id: visible.id } });
  expect(result[2]).toMatchObject({ elements: [{ id: 'after' }] });
  expect(page.canvas!.elements).toHaveLength(4);
  page.canvas!.elements = [native('b', { polityOrder: 0 }), native('a', { polityOrder: 0 })];
  page.elements = [];
  expect(canvasLayers(page)[0]).toMatchObject({ elements: [{ id: 'a' }, { id: 'b' }] });
  page.canvas = undefined;
  expect(canvasLayers(page)).toEqual([]);
});
