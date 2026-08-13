import { describe, expect, it } from 'vitest';

import { nullableTimestampSchema, toMutableJSONValue } from '../helpers';

describe('shared zero helpers', () => {
  it('normalizes nullable timestamps', () => {
    expect(nullableTimestampSchema.parse(null)).toBe(0);
    expect(nullableTimestampSchema.parse(42)).toBe(42);
  });

  it('round-trips JSON values without retaining object identity', () => {
    const value = { nested: ['value', 2, true, null] };
    const result = toMutableJSONValue(value);
    expect(result).toEqual(value);
    expect(result).not.toBe(value);
  });

  it('rejects values that JSON cannot serialize', () => {
    expect(() => toMutableJSONValue(undefined)).toThrow('Value is not JSON-serializable');
  });
});
