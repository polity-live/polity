import { describe, expect, it, vi } from 'vitest';

import { createEntitySecondaryNavItemsUnauthenticated } from '../nav-items-unauthenticated';

const translate = (key: string) => key;

function getItems(pathname: string) {
  return createEntitySecondaryNavItemsUnauthenticated(pathname, vi.fn(), translate);
}

describe('unauthenticated entity secondary navigation', () => {
  it('shows only public user navigation items', () => {
    const items = getItems('/user/user-1');

    expect(items?.map(item => item.id)).toEqual(['user', 'meet', 'network']);
    expect(items?.map(item => item.href)).toEqual([
      '/user/user-1',
      '/user/user-1/meet',
      '/user/user-1/network',
    ]);
  });

  it('shows public event navigation items', () => {
    const items = getItems('/event/event-1/agenda');

    expect(items?.map(item => item.id)).toEqual(['overview', 'agenda', 'network']);
  });

  it('shows public group navigation items without restricted management routes', () => {
    const items = getItems('/group/group-1/events');

    expect(items?.map(item => item.id)).toEqual([
      'overview',
      'events',
      'amendments',
      'blogs-and-statements',
      'network',
    ]);
  });

  it('shows public amendment navigation items', () => {
    const items = getItems('/amendment/amendment-1/process');

    expect(items?.map(item => item.id)).toEqual([
      'overview',
      'text',
      'changeRequests',
      'discussions',
      'city-design',
      'process',
    ]);
    expect(items?.map(item => item.href)).toEqual([
      '/amendment/amendment-1',
      '/amendment/amendment-1/text',
      '/amendment/amendment-1/change-requests',
      '/amendment/amendment-1/discussions',
      '/amendment/amendment-1/citydesign',
      '/amendment/amendment-1/process',
    ]);
  });

  it('shows the public overview for direct and nested blog routes', () => {
    expect(getItems('/blog/blog-1')?.map(item => item.href)).toEqual(['/blog/blog-1']);
    expect(getItems('/group/group-1/blog/blog-1')?.map(item => item.href)).toEqual([
      '/group/group-1/blog/blog-1',
    ]);
    expect(getItems('/user/user-1/blog/blog-1')?.map(item => item.href)).toEqual([
      '/user/user-1/blog/blog-1',
    ]);
  });

  it('returns no entity sidebar for unrelated public routes', () => {
    expect(getItems('/pricing')).toBeNull();
  });
});
