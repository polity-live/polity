/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRuntime } from '../app-runtime';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  session: null as object | null,
  loading: false,
  connected: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: object) => string }) =>
    select({ location: { pathname: mocks.pathname } }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: mocks.session, loading: mocks.loading }),
}));
vi.mock('../connected-app-runtime', () => ({
  default: ({ children }: React.PropsWithChildren) => {
    mocks.connected();
    return <div>Connected:{children}</div>;
  },
}));

afterEach(() => {
  cleanup();
  mocks.pathname = '/';
  mocks.session = null;
  mocks.loading = false;
  mocks.connected.mockClear();
});

describe('AppRuntime', () => {
  it('renders anonymous public-root children directly', () => {
    render(<AppRuntime>Public</AppRuntime>);
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText(/Connected:/)).toBeNull();
  });

  it('loads the connected runtime for other routes', async () => {
    mocks.pathname = '/group/one';
    render(<AppRuntime>Private</AppRuntime>);
    await waitFor(() => expect(screen.getByText(/Connected:/)).toBeTruthy());
    mocks.pathname = '/';
  });

  it('commits the auth loading shell before mounting the connected runtime', async () => {
    mocks.pathname = '/messages';
    mocks.loading = true;
    const { container, rerender } = render(<AppRuntime>Private</AppRuntime>);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(mocks.connected).not.toHaveBeenCalled();
    mocks.loading = false;
    mocks.session = { user: { id: 'viewer' } };
    rerender(<AppRuntime>Private</AppRuntime>);
    await waitFor(() => expect(screen.getByText(/Connected:/)).toBeTruthy());
  });
});
