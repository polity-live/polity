import { describe, expect, it, vi } from 'vitest';

import { navItemsAuthenticated } from '../nav-items-authenticated';

describe('navItemsAuthenticated', () => {
  it('performs exactly one navigation for a primary item click', () => {
    const navigate = vi.fn();
    const searchItem = navItemsAuthenticated(navigate).primaryNavItems.find(
      item => item.id === 'search'
    );

    searchItem?.onClick?.();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: '/search' });
  });

  it('builds and activates every primary and secondary navigation item', () => {
    const navigate = vi.fn();
    const translated: string[] = [];
    const api = navItemsAuthenticated(navigate, key => {
      translated.push(key);
      return `translated:${key}`;
    });
    const clickAll = (items: { onClick?: () => void }[]) => {
      for (const item of items) item.onClick?.();
    };

    clickAll(api.primaryNavItems);
    clickAll(api.projectSecondaryNavItems);

    const defaultEvent = api.getEventSecondaryNavItems('event');
    const privilegedEvent = api.getEventSecondaryNavItems('event', true, true);
    expect(defaultEvent.map(item => item.id)).toEqual(['overview', 'agenda', 'network']);
    expect(privilegedEvent.map(item => item.id)).toEqual([
      'overview',
      'agenda',
      'network',
      'participants',
      'notifications',
      'edit',
    ]);
    clickAll(defaultEvent);
    clickAll(privilegedEvent);

    const publicUser = api.getUserSecondaryNavItems('user', false);
    const ownUser = api.getUserSecondaryNavItems('user', true);
    expect(publicUser.map(item => item.id)).toEqual(['user', 'meet', 'network']);
    expect(ownUser.map(item => item.id)).toEqual([
      'user',
      'memberships',
      'subscriptions',
      'meet',
      'network',
      'edit',
    ]);
    clickAll(publicUser);
    clickAll(ownUser);

    const publicGroup = api.getGroupSecondaryNavItems('group');
    const privilegedGroup = api.getGroupSecondaryNavItems(
      'group',
      true,
      true,
      true,
      true,
      true,
      true
    );
    expect(publicGroup.map(item => item.id)).toEqual([
      'overview',
      'events',
      'amendments',
      'blogs-and-statements',
      'network',
    ]);
    expect(privilegedGroup.map(item => item.id)).toContain('operation');
    expect(privilegedGroup.map(item => item.id)).toContain('editor');
    expect(privilegedGroup.map(item => item.id)).toContain('memberships');
    expect(privilegedGroup.map(item => item.id)).toContain('notifications');
    expect(privilegedGroup.map(item => item.id)).toContain('edit');
    clickAll(publicGroup);
    clickAll(privilegedGroup);

    const publicAmendment = api.getAmendmentSecondaryNavItems('amendment');
    const managedAmendment = api.getAmendmentSecondaryNavItems('amendment', true, true, true, true);
    expect(publicAmendment.map(item => item.id)).toEqual([
      'overview',
      'discussions',
      'city-design',
      'process',
    ]);
    expect(managedAmendment.map(item => item.id)).toContain('text');
    expect(managedAmendment.map(item => item.id)).toContain('changeRequests');
    expect(managedAmendment.map(item => item.id)).toContain('collaborators');
    expect(managedAmendment.map(item => item.id)).toContain('notifications');
    expect(managedAmendment.map(item => item.id)).toContain('edit');
    clickAll(publicAmendment);
    clickAll(managedAmendment);

    const publicBlog = api.getBlogSecondaryNavItems('blog');
    const groupBlog = api.getBlogSecondaryNavItems('blog', true, true, 'group');
    const userBlog = api.getBlogSecondaryNavItems('blog', false, false, undefined, 'user');
    expect(publicBlog[0]?.href).toBe('/blog/blog');
    expect(groupBlog[0]?.href).toBe('/group/group/blog/blog');
    expect(userBlog[0]?.href).toBe('/user/user/blog/blog');
    clickAll(publicBlog);
    clickAll(groupBlog);
    clickAll(userBlog);

    expect(translated.length).toBeGreaterThan(0);
    expect(navigate).toHaveBeenCalledWith({ to: '/group/group/operation' });
    expect(navigate).toHaveBeenCalledWith({ to: '/amendment/amendment/change-requests' });
    expect(navigate).toHaveBeenCalledWith({ to: '/group/group/blog/blog/editor' });
  });

  it('covers every route dispatcher outcome and optional default', () => {
    const api = navItemsAuthenticated(vi.fn(), key => key);
    const resolve = api.getSecondaryNavItems as (...args: any[]) => unknown;

    expect(resolve('projects')).toBe(api.projectSecondaryNavItems);
    expect(resolve('event')).toBeNull();
    expect(resolve('event', 'event')).toHaveLength(3);
    expect(
      resolve(
        'event',
        'event',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      )
    ).toHaveLength(6);

    expect(resolve('user')).toBeNull();
    expect(resolve('user', undefined, 'user')).toHaveLength(3);
    expect(resolve('user', undefined, 'user', true)).toHaveLength(6);

    expect(resolve('group')).toBeNull();
    expect(resolve('group', undefined, undefined, undefined, 'group')).toHaveLength(5);
    expect(
      resolve(
        'group',
        undefined,
        undefined,
        undefined,
        'group',
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        true,
        true,
        true,
        true
      )
    ).toHaveLength(10);

    expect(resolve('amendment')).toBeNull();
    expect(resolve('amendment', undefined, undefined, undefined, undefined, 'a')).toHaveLength(4);
    expect(
      resolve(
        'amendment',
        undefined,
        undefined,
        undefined,
        undefined,
        'a',
        undefined,
        undefined,
        true,
        true,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      )
    ).toHaveLength(9);

    expect(resolve('blog')).toBeNull();
    expect(
      resolve(
        'blog',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'b'
      )
    ).toHaveLength(1);
    expect(
      resolve(
        'blog',
        undefined,
        'user',
        undefined,
        'group',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'b',
        true,
        undefined,
        undefined,
        true
      )
    ).toHaveLength(4);
    expect(resolve(null)).toBeNull();
    expect(resolve('unknown')).toBeNull();
  });

  it('defers primary navigation in a browser environment', () => {
    const navigate = vi.fn();
    const setTimeout = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal('window', { setTimeout });

    navItemsAuthenticated(navigate).primaryNavItems[0]?.onClick?.();

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(navigate).toHaveBeenCalledWith({ to: '/home' });
    vi.unstubAllGlobals();
  });
});
