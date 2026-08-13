import { describe, expect, it } from 'vitest';

import { generateDistinctUserColorMap } from '../editor-helpers';

describe('editor helper collision branches A04', () => {
  it('deterministically assigns a distinct variant when two users share a base hue', () => {
    const colors = generateDistinctUserColorMap(['user-29', 'user-65']);

    expect(colors.get('user-29')).toBeDefined();
    expect(colors.get('user-65')).toBeDefined();
    expect(new Set(colors.values())).toHaveLength(2);
  });
});
