import { describe, expect, it, vi } from 'vitest';

import {
  formatNumberWithUnit,
  getBlogGradient,
  getRoleBadgeColor,
  getStatusStyles,
  getTagColor,
} from '../userWiki.utils';

const featureThemeClassName = vi.hoisted(() => vi.fn((token: string) => `theme:${token}`));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (token: string) => featureThemeClassName(token),
}));

describe('userWiki.utils', () => {
  it.each([
    ['Passed', 'primary'],
    ['passed', 'primary'],
    ['Rejected', 'destructive'],
    ['rejected', 'destructive'],
    ['Under Review', 'secondary'],
    ['Drafting', 'outline'],
    ['unknown', 'outline'],
  ] as const)('maps amendment status %s', (status, badge) => {
    expect(getStatusStyles(status)).toMatchObject({ badge });
    expect(getStatusStyles(status).bgColor).toMatch(/^theme:/);
  });

  it.each([
    [999, { value: 999, unit: '' }],
    [1_000, { value: 1, unit: 'k' }],
    [1_250, { value: 1.3, unit: 'k' }],
    [1_000_000, { value: 1, unit: 'M' }],
    [1_250_000, { value: 1.3, unit: 'M' }],
  ])('formats %i with a compact unit', (value, expected) => {
    expect(formatNumberWithUnit(value)).toEqual(expected);
  });

  it('chooses deterministic variants from tag and blog hashes', () => {
    const badges = [
      { bg: 'one', text: '1' },
      { bg: 'two', text: '2' },
      { bg: 'three', text: '3' },
    ];
    expect(getTagColor('A', badges)).toBe(badges[2]);
    expect(getTagColor('A', badges)).toBe(getTagColor('A', badges));
    expect(getBlogGradient('A', ['one', 'two', 'three'])).toBe('three');
  });

  it.each([
    ['founder', 'purple'],
    ['FOUNDER', 'purple'],
    ['advisor', 'blue'],
    ['member', 'green'],
    ['guest', 'gray'],
    ['', 'gray'],
  ] as const)('maps role %s to badge %s', (role, badge) => {
    expect(getRoleBadgeColor(role)).toMatchObject({ badge });
  });
});
