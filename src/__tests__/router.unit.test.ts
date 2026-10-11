import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRouter: vi.fn(() => ({ id: 'router' })),
  routeTree: { id: 'route-tree' },
  connectedCode: vi.fn(() => Promise.resolve({})),
  authenticatedCode: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@tanstack/react-router', () => ({ createRouter: mocks.createRouter }));
vi.mock('../routeTree.gen', () => ({ routeTree: mocks.routeTree }));
vi.mock('../runtime/app-runtime', () => ({ loadConnectedAppRuntime: mocks.connectedCode }));
vi.mock('../layout/app-shell', () => ({ loadAuthenticatedShell: mocks.authenticatedCode }));

import { getRouter } from '../router';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('router bootstrap', () => {
  it('creates the router when optional frame code prefetch fails', async () => {
    vi.stubGlobal('window', { location: { pathname: '/search' } });
    mocks.connectedCode.mockRejectedValueOnce(new Error('connected chunk unavailable'));
    mocks.authenticatedCode.mockRejectedValueOnce(new Error('shell chunk unavailable'));
    expect(getRouter()).toEqual({ id: 'router' });
    await Promise.resolve();
    expect(mocks.createRouter).toHaveBeenCalledOnce();
  });
  it('starts only code loading for nonpublic browser routes, without mounting providers', () => {
    vi.stubGlobal('window', { location: { pathname: '/' } });
    getRouter();
    expect(mocks.connectedCode).not.toHaveBeenCalled();
    expect(mocks.authenticatedCode).not.toHaveBeenCalled();
    vi.stubGlobal('window', { location: { pathname: '/search' } });
    getRouter();
    expect(mocks.connectedCode).toHaveBeenCalledTimes(1);
    expect(mocks.authenticatedCode).toHaveBeenCalledTimes(1);
  });
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
