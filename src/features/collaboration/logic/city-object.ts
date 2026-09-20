import * as Y from 'yjs';

/** User properties merge independently. Geometries remain atomic values so a
 * corridor never contains coordinates assembled from two incompatible edits. */
export function patchCityObject(
  target: Y.Map<unknown>,
  previous: Record<string, unknown> | undefined,
  value: Record<string, unknown>
) {
  for (const key of new Set([...Object.keys(previous ?? {}), ...Object.keys(value)])) {
    if (previous && JSON.stringify(previous[key]) === JSON.stringify(value[key])) continue;
    if (key === 'properties' && value.properties && typeof value.properties === 'object') {
      let properties = previous ? target.get('properties') : undefined;
      if (!(properties instanceof Y.Map)) {
        properties = new Y.Map(Object.entries((properties ?? {}) as Record<string, unknown>));
        target.set('properties', properties);
      }
      const before = (previous?.properties ?? {}) as Record<string, unknown>;
      const after = value.properties as Record<string, unknown>;
      const map = properties as Y.Map<unknown>;
      for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (previous && Object.is(before[name], after[name])) continue;
        if (after[name] === undefined) map.delete(name);
        else map.set(name, after[name]);
      }
    } else if (value[key] === undefined) target.delete(key);
    else target.set(key, value[key]);
  }
}
