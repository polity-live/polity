/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRuntime } from '../app-runtime';

const mocks = vi.hoisted(() => ({ pathname: '/', session: null as object | null }));
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: object) => string }) =>
    select({ location: { pathname: mocks.pathname } }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('../connected-app-runtime', () => ({
  default: ({ children }: React.PropsWithChildren) => <div>Connected:{children}</div>,
}));

afterEach(cleanup);

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
});
