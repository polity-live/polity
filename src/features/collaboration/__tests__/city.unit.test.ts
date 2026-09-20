import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createPointCityDesignObject } from '@/features/amendments/city-design/logic/cityDesignPlacement';
import type { CityDesignStateV1 } from '@/features/amendments/city-design/types';
import { applyCityDesignAction } from '../logic/city';
import { candidateDocument, projectDocument, seedDocument } from '../logic/codec';
import { reconcileProjection } from '../logic/reconcile';
import { patchCityObject } from '../logic/city-object';

const initial = {
  ...createEmptyCityDesignState(),
  objects: [createPointCityDesignObject({ id: 'tree-1', type: 'tree', point: { x: 1, z: 2 } })],
};
const read = (doc: Y.Doc) => projectDocument('city', doc) as CityDesignStateV1;
function peers() {
  const a = seedDocument('city', initial),
    b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return [a, b];
}
describe('shared Streetdesign objects', () => {
  it('removes explicit local properties without replacing remaining peer properties or geometry', () => {
    const before: any = { ...structuredClone(initial), localMetadata: 'temporary' };
    before.objects[0].temporary = 'remove';
    before.objects[0].properties.label = 'remove';
    const after = structuredClone(before);
    delete after.localMetadata;
    delete after.objects[0].temporary;
    delete after.objects[0].properties.label;
    const doc = seedDocument('city', before);
    try {
      applyCityDesignAction(doc, before, after, 'local');
      expect(doc.getMap('scene').has('localMetadata')).toBe(false);
      const object = doc.getMap<Y.Map<unknown>>('objects').get('tree-1')!;
      expect(object.has('temporary')).toBe(false);
      expect((object.get('properties') as Y.Map<unknown>).has('label')).toBe(false);
      expect(object.get('geometry')).toEqual(initial.objects[0].geometry);
      object.set('properties', { height: 7, remote: true });
      patchCityObject(object, { properties: { height: 7 } }, { properties: { height: 9 } });
      expect((object.get('properties') as Y.Map<unknown>).toJSON()).toEqual({
        height: 9,
        remote: true,
      });
    } finally {
      doc.destroy();
    }
  });
  it('merges different properties and a complete geometry from concurrent peers', () => {
    const [a, b] = peers();
    const first = structuredClone(initial),
      second = structuredClone(initial);
    first.objects[0].properties.height = 15;
    second.objects[0].properties.label = 'New tree';
    second.objects[0].geometry = { kind: 'point', point: { x: 8, z: 9 }, rotation: 1.5 };
    applyCityDesignAction(a, initial, first, 'a');
    applyCityDesignAction(b, initial, second, 'b');
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(read(a)).toEqual(read(b));
    expect(read(a).objects[0].properties).toMatchObject({ height: 15, label: 'New tree' });
    expect(read(a).objects[0].geometry).toEqual(second.objects[0].geometry);
    a.destroy();
    b.destroy();
  });
  it('preserves remote additions when a stale local action changes another object', () => {
    const [a, b] = peers();
    const remote = structuredClone(initial);
    remote.objects.push(
      createPointCityDesignObject({ id: 'tree-2', type: 'tree', point: { x: 3, z: 4 } })
    );
    applyCityDesignAction(b, initial, remote, 'b');
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    const local = structuredClone(initial);
    local.objects[0].properties.height = 25;
    applyCityDesignAction(a, initial, local, 'a');
    expect(read(a).objects.map(object => object.id)).toEqual(['tree-1', 'tree-2']);
    expect(read(a).objects[0].properties.height).toBe(25);
    a.destroy();
    b.destroy();
  });
  it('does not resurrect an object deleted before a stale local edit is dispatched', () => {
    const [a, b] = peers();
    applyCityDesignAction(b, initial, { ...initial, objects: [] }, 'b');
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    const stale = structuredClone(initial);
    stale.objects[0].properties.height = 42;
    applyCityDesignAction(a, initial, stale, 'a');
    expect(read(a).objects).toEqual([]);
    a.destroy();
    b.destroy();
  });
  it('applies a server decision without losing independent object properties', () => {
    const doc = seedDocument('city', initial);
    const next = structuredClone(initial);
    next.objects[0].properties.height = 16;
    Y.applyUpdate(doc, reconcileProjection('city', Y.encodeStateAsUpdate(doc), next));
    expect(read(doc)).toEqual(next);
    doc.destroy();
  });
  it('changes object order without removing a concurrently added object', () => {
    const base = structuredClone(initial);
    base.objects.push(
      createPointCityDesignObject({ id: 'tree-2', type: 'tree', point: { x: 3, z: 4 } })
    );
    const doc = seedDocument('city', base);
    const remote = structuredClone(base);
    remote.objects.push(
      createPointCityDesignObject({ id: 'tree-3', type: 'tree', point: { x: 5, z: 6 } })
    );
    applyCityDesignAction(doc, base, remote, 'remote');
    applyCityDesignAction(doc, base, { ...base, objects: [...base.objects].reverse() }, 'local');
    expect(read(doc).objects.map(object => object.id)).toEqual(['tree-2', 'tree-1', 'tree-3']);
    doc.destroy();
  });
  it('rejects malformed geometry before accepting a client state', () => {
    const [a, b] = peers();
    b.getMap<Y.Map<unknown>>('objects')
      .get('tree-1')
      ?.set('geometry', { kind: 'point', point: { x: 4 }, rotation: 0 });
    expect(() =>
      candidateDocument('city', Y.encodeStateAsUpdate(a), Y.encodeStateAsUpdate(b))
    ).toThrow('invalid_city');
    expect(read(a)).toEqual(initial);
    a.destroy();
    b.destroy();
  });
});
