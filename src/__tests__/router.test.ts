import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRouter: vi.fn(() => ({ id: 'router' })),
  routeTree: { id: 'route-tree' },
}));

vi.mock('@tanstack/react-router', () => ({ createRouter: mocks.createRouter }));
vi.mock('../routeTree.gen', () => ({ routeTree: mocks.routeTree }));

import { getRouter } from '../router';

describe('router bootstrap', () => {
  it('creates the application router with stable preload and restoration defaults', () => {
    expect(getRouter()).toEqual({ id: 'router' });
    expect(mocks.createRouter).toHaveBeenCalledWith({
      routeTree: mocks.routeTree,
      scrollRestoration: true,
      defaultPreload: 'intent',
      defaultPreloadDelay: 50,
      defaultPreloadStaleTime: 0,
    });
  });
});
