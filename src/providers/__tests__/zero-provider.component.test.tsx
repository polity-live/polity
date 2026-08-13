/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as null | {
    access_token: string;
    user: { id: string; email?: string };
  },
  zeroProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../auth-provider', () => ({
  useAuth: () => ({ session: mocks.session }),
}));

vi.mock('@rocicorp/zero/react', () => ({
  ZeroProvider: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    mocks.zeroProps = props;
    return props.children;
  },
}));

import { ZeroAppProvider } from '../zero-provider';

describe('ZeroAppProvider identity', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ZERO_CACHE_URL', 'https://zero.example.test');
    vi.stubEnv('VITE_APP_URL', 'https://app.example.test');
    mocks.session = null;
    mocks.zeroProps = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('omits userID for logged-out clients while retaining the anonymous query context', () => {
    render(<ZeroAppProvider>content</ZeroAppProvider>);

    expect(mocks.zeroProps).toBeDefined();
    expect(Object.hasOwn(mocks.zeroProps ?? {}, 'userID')).toBe(false);
    expect(mocks.zeroProps?.context).toEqual({ userID: 'anon', email: '' });
    expect(mocks.zeroProps?.auth).toBeUndefined();
  });

  it('passes the authenticated identity and context to Zero', () => {
    mocks.session = {
      access_token: 'access-token',
      user: { id: 'user-123', email: 'person@example.test' },
    };

    render(<ZeroAppProvider>content</ZeroAppProvider>);

    expect(mocks.zeroProps?.userID).toBe('user-123');
    expect(mocks.zeroProps?.context).toEqual({
      userID: 'user-123',
      email: 'person@example.test',
    });
    expect(mocks.zeroProps?.auth).toBe('access-token');
  });

  it('requires both Zero and application URLs', () => {
    vi.stubEnv('VITE_ZERO_CACHE_URL', '');
    expect(() => render(<ZeroAppProvider>content</ZeroAppProvider>)).toThrow(
      'VITE_ZERO_CACHE_URL is not defined'
    );

    vi.stubEnv('VITE_ZERO_CACHE_URL', 'https://zero.example.test');
    vi.stubEnv('VITE_APP_URL', '');
    expect(() => render(<ZeroAppProvider>content</ZeroAppProvider>)).toThrow(
      'VITE_APP_URL is not defined'
    );
  });

  it('uses an empty email for authenticated sessions without one', () => {
    mocks.session = { access_token: 'token', user: { id: 'user-1' } };
    render(<ZeroAppProvider>content</ZeroAppProvider>);
    expect(mocks.zeroProps?.context).toEqual({ userID: 'user-1', email: '' });
  });
});
