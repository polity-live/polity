import { describe, expect, it, vi } from 'vitest';

import { getPrimaryRouteFromPathname, isItemActive } from '../nav-helpers';
import type { NavigationItem } from '../../types/navigation.types';

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
    ['///', 'home'],
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

  it('rejects missing routes and items without navigation targets', () => {
    const item: NavigationItem = { id: 'other', icon: 'File', label: 'Other' };
    expect(isItemActive(item, undefined, false)).toBe(false);
    expect(isItemActive(item, '/current', false)).toBe(false);
    expect(isItemActive(item, '/current', true)).toBe(false);
  });

  it('matches exact paths without hashes and primary child paths', () => {
    const item: NavigationItem = { id: 'group', icon: 'Users', label: 'Group', href: '/group' };
    expect(isItemActive(item, '/group?tab=one', false)).toBe(true);
    expect(isItemActive(item, '/group/id', true)).toBe(true);
    expect(isItemActive(item, '/group/id', false)).toBe(false);
    expect(isItemActive({ ...item, id: 'different', href: '/group#one' }, '/group', false)).toBe(
      false
    );
  });

  it('extracts exact and hierarchical routes from click handlers', () => {
    const exact: NavigationItem = {
      id: 'click',
      icon: 'File',
      label: 'Click',
      onClick: () => ({ to: '/messages' }),
    };
    expect(isItemActive(exact, '/messages', false)).toBe(true);
    expect(isItemActive(exact, '/messages/thread', true)).toBe(true);
    expect(isItemActive(exact, '/messages/thread', false)).toBe(false);
    expect(isItemActive({ ...exact, onClick: () => undefined }, '/messages', true)).toBe(false);

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwing = () => undefined;
    Object.defineProperty(throwing, 'toString', {
      value: () => {
        throw new Error('unprintable');
      },
    });
    expect(
      isItemActive({ id: 'throwing', icon: 'File', label: 'Throwing', onClick: throwing }, '/x')
    ).toBe(false);
    expect(error).toHaveBeenCalledWith('Error parsing onClick route:', expect.any(Error));
  });

  it('matches home, direct ids, and primary id descendants', () => {
    expect(isItemActive({ id: 'home', icon: 'Home', label: 'Home' }, '/', false)).toBe(true);
    expect(
      isItemActive({ id: 'messages', icon: 'File', label: 'Messages' }, 'messages', false)
    ).toBe(true);
    expect(
      isItemActive({ id: 'messages', icon: 'File', label: 'Messages' }, '/messages/thread', true)
    ).toBe(true);
    expect(isItemActive({ id: 'messages', icon: 'File', label: 'Messages' }, '/other', true)).toBe(
      false
    );
    expect(isItemActive({ id: 'home', icon: 'Home', label: 'Home' }, '?tab=one')).toBe(true);
  });
});
