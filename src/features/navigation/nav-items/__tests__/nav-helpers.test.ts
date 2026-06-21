import { describe, expect, it } from 'vitest';

import { isItemActive } from '../nav-helpers';

describe('isItemActive', () => {
  it('matches secondary landing navigation items by hash', () => {
    expect(
      isItemActive(
        {
          id: 'landing-features',
          icon: 'Sparkles',
          label: 'Features',
          href: '/#features',
        },
        '/#features',
        false
      )
    ).toBe(true);
  });

  it('does not match other landing hash items on a different active hash', () => {
    expect(
      isItemActive(
        {
          id: 'landing-home',
          icon: 'Home',
          label: 'Home',
          href: '/#home',
        },
        '/#solutions',
        false
      )
    ).toBe(false);

    expect(
      isItemActive(
        {
          id: 'landing-features',
          icon: 'Sparkles',
          label: 'Features',
          href: '/#features',
        },
        '/#solutions',
        false
      )
    ).toBe(false);
  });

  it('matches secondary navigation items even when href carries a branch query', () => {
    expect(
      isItemActive(
        {
          id: 'process',
          icon: 'Workflow',
          label: 'Process',
          href: '/amendment/amendment-1/process?branch=branch-2',
        },
        '/amendment/amendment-1/process',
        false
      )
    ).toBe(true);
  });
});
