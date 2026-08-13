import { describe, expect, it } from 'vitest';

import { getIconComponent, iconMap } from '../icon-map';

describe('navigation icon map', () => {
  it('returns mapped icons and the defensive search fallback', () => {
    expect(getIconComponent('Home')).toBe(iconMap.Home);
    expect(getIconComponent('missing' as never)).toBe(iconMap.Search);
  });
});
