import { describe, expect, it } from 'vitest';

import { generateDistinctUserColorMap, generateUserColor } from '../editor-helpers';

const deterministicSeedUserIds = [
  'f1000000-0000-4000-a000-000000000001',
  'f1000000-0000-4000-a000-000000000002',
  'f1000000-0000-4000-a000-000000000003',
  'f1000000-0000-4000-a000-000000000004',
];

describe('editor color helpers', () => {
  it('uses the full user id when generating stable user colors', () => {
    const colors = deterministicSeedUserIds.map(generateUserColor);

    expect(new Set(colors).size).toBe(deterministicSeedUserIds.length);
  });

  it('generates valid HSL colors for non-hex user ids', () => {
    const color = generateUserColor('user-online');

    expect(color).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
    expect(color).not.toContain('NaN');
  });

  it('creates a deterministic distinct color map independent of input order', () => {
    const colors = generateDistinctUserColorMap(deterministicSeedUserIds);
    const reversedColors = generateDistinctUserColorMap([...deterministicSeedUserIds].reverse());

    expect(new Set(colors.values()).size).toBe(deterministicSeedUserIds.length);

    for (const userId of deterministicSeedUserIds) {
      expect(reversedColors.get(userId)).toBe(colors.get(userId));
    }
  });
});
