import { describe, expect, it } from 'vitest';

import { getPrimaryRouteFromPathname, isItemActive } from '../nav-helpers';

describe('getPrimaryRouteFromPathname', () => {
  it.each([
    ['/', 'home'],
    ['/messages', 'messages'],
    ['/search', 'search'],
    ['/group/group-1', 'group'],
    ['/event/event-1/agenda', 'event'],
    ['/group/group-1/blog/blog-1', 'blog'],
    ['/group/group-1/blog/blog-1/editor', 'blog'],
    ['/user/user-1/blog/blog-1/comments', 'blog'],
  ])('derives %s as %s', (pathname, expected) => {
    expect(getPrimaryRouteFromPathname(pathname)).toBe(expected);
  });
});

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
