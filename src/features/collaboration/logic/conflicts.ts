import { stableJson } from './codec';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Only fields touched by a proposal must still match its base. Arrays and
 * geometries are indivisible values; unrelated object fields may diverge. */
export function proposalConflicts(
  current: unknown,
  before: unknown,
  after: unknown,
  path = ''
): string[] {
  if (stableJson(before) === stableJson(after)) return [];
  if (record(before) && record(after) && record(current)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      if (key === 'geometry')
        return stableJson(before[key]) !== stableJson(after[key]) &&
          stableJson(current[key]) !== stableJson(before[key])
          ? [`${path}/${key}`]
          : [];
      return proposalConflicts(current[key], before[key], after[key], `${path}/${key}`);
    });
  }
  return stableJson(current) === stableJson(before) ? [] : [path || '/'];
}
