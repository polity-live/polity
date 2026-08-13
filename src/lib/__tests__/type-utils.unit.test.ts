import { describe, expect, it } from 'vitest';

import { toUndefined } from '../type-utils';

describe('toUndefined', () => {
  it('preserves values and maps only null to undefined', () => {
    expect(toUndefined('value')).toBe('value');
    expect(toUndefined(false)).toBe(false);
    expect(toUndefined(0)).toBe(0);
    expect(toUndefined(null)).toBeUndefined();
  });
});
