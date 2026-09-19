import * as Y from 'yjs';
import type { CityDesignStateV1 } from '@/features/amendments/city-design/types';
import { stableJson } from './codec';
import { patchCityObject } from './city-object';

/** Only fields changed by the local action are written. A remote object added
 * since the action began is never removed by a whole-design replacement. */
export function applyCityDesignAction(
  doc: Y.Doc,
  before: CityDesignStateV1,
  after: CityDesignStateV1,
  origin: unknown
) {
  doc.transact(() => {
    const scene = doc.getMap('scene');
    const old = before as unknown as Record<string, unknown>,
      next = after as unknown as Record<string, unknown>;
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (key === 'objects' || stableJson(old[key]) === stableJson(next[key])) continue;
      if (next[key] === undefined) scene.delete(key);
      else scene.set(key, next[key]);
    }
    const objects = doc.getMap<Y.Map<unknown>>('objects');
    const oldById = new Map(before.objects.map(object => [object.id, object]));
    const nextIds = new Set(after.objects.map(object => object.id));
    for (const id of oldById.keys()) if (!nextIds.has(id)) objects.delete(id);
    for (const object of after.objects) {
      const previous = oldById.get(object.id) as unknown as Record<string, unknown> | undefined;
      const value = object as unknown as Record<string, unknown>;
      let target = objects.get(object.id);
      if (!target) {
        // A stale local action cannot recreate an object deleted by a peer.
        if (previous) continue;
        target = new Y.Map();
        objects.set(object.id, target);
      }
      patchCityObject(target, previous, value);
    }
    const order = doc.getArray<string>('order');
    for (let i = order.length - 1; i >= 0; i--)
      if (oldById.has(order.get(i)) && !nextIds.has(order.get(i))) order.delete(i, 1);
    for (const object of after.objects)
      if (objects.has(object.id) && !order.toArray().includes(object.id)) order.push([object.id]);
    const oldOrder = before.objects.map(object => object.id).filter(id => nextIds.has(id));
    const newOrder = after.objects.map(object => object.id).filter(id => oldById.has(id));
    if (stableJson(oldOrder) !== stableJson(newOrder)) {
      const desired = after.objects.map(object => object.id).filter(id => objects.has(id));
      for (let index = 0; index < desired.length; index++) {
        const from = order.toArray().indexOf(desired[index]);
        if (from === index) continue;
        order.delete(from, 1);
        order.insert(index, [desired[index]]);
      }
    }
  }, origin);
}
