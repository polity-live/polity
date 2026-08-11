import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRouter: vi.fn(() => ({ id: 'app-router' })),
  routeTree: { id: 'generated-route-tree' },
  NotFound: () => null,
}));

vi.mock('@tanstack/react-router', () => ({ createRouter: mocks.createRouter }));
vi.mock('../routeTree.gen', () => ({ routeTree: mocks.routeTree }));
vi.mock('@/features/shared/ui/ui/not-found', () => ({ NotFound: mocks.NotFound }));

import { createRouter } from '../../app/router';

describe('application router entry point', () => {
  it('creates the generated route tree with restoration and the shared not-found view', () => {
    expect(createRouter()).toEqual({ id: 'app-router' });
    expect(mocks.createRouter).toHaveBeenCalledWith({
      routeTree: mocks.routeTree,
      scrollRestoration: true,
      defaultNotFoundComponent: mocks.NotFound,
    });
  });
});
