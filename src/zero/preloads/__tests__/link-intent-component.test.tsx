/* @vitest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  beginIntent: vi.fn(),
  cancelIntent: vi.fn(),
  context: null as null | {
    beginIntent: ReturnType<typeof vi.fn>;
    cancelIntent: ReturnType<typeof vi.fn>;
  },
  currentHref: '/home',
  getMatchedRoutes: vi.fn(() => ({
    matchedRoutes: [],
    routeParams: {},
    foundRoute: { id: '/search' },
  })),
  preloadRoute: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    getMatchedRoutes: mocks.getMatchedRoutes,
    preloadRoute: mocks.preloadRoute,
  }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: mocks.currentHref } }),
}));
vi.mock('../preload-coordinator', () => ({ usePreloadCoordinator: () => mocks.context }));

import { InternalLinkIntentPreloader } from '../link-intent';

describe('InternalLinkIntentPreloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context = { beginIntent: mocks.beginIntent, cancelIntent: mocks.cancelIntent };
    mocks.preloadRoute.mockResolvedValue(undefined);
    window.history.replaceState({}, '', '/home');
  });

  afterEach(() => document.body.replaceChildren());

  it('preloads routes, forwards begin/cancel callbacks, and contains router failures', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.preloadRoute.mockRejectedValueOnce(new Error('offline'));
    const view = render(<InternalLinkIntentPreloader />);
    const link = document.createElement('a');
    link.href = '/search';
    document.body.append(link);

    fireEvent.focusIn(link);
    fireEvent.focusOut(link);
    await Promise.resolve();

    expect(mocks.preloadRoute).toHaveBeenCalledWith({ to: '/search' });
    expect(mocks.beginIntent).toHaveBeenCalledWith('/search', 0);
    expect(mocks.cancelIntent).toHaveBeenCalledWith('/search');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('/search'), expect.any(Error));
    view.unmount();
  });

  it('supports an absent coordinator context', () => {
    mocks.context = null;
    render(<InternalLinkIntentPreloader />);
    const link = document.createElement('a');
    link.href = '/search';
    document.body.append(link);
    fireEvent.focusIn(link);
    fireEvent.focusOut(link);
    expect(mocks.preloadRoute).toHaveBeenCalledOnce();
  });
});
