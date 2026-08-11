/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnsureUserView } from '../EnsureUserView';

const defaults = {
  hasUser: true,
  isLoading: false,
  connectionStatus: 'syncing' as const,
  retry: vi.fn(),
  signOut: vi.fn(),
  zeroConnectionState: 'connected',
};

afterEach(cleanup);

describe('EnsureUserView readiness contract', () => {
  it('publishes a deterministic marker after auth, user hydration and Zero are ready', () => {
    render(
      <EnsureUserView {...defaults}>
        <div>Application</div>
      </EnsureUserView>
    );

    const marker = screen.getByTestId('app-readiness');
    expect(marker.getAttribute('data-app-state')).toBe('ready');
    expect(marker.getAttribute('data-auth-state')).toBe('authenticated');
    expect(marker.getAttribute('data-data-state')).toBe('hydrated');
    expect(marker.getAttribute('data-zero-connection')).toBe('connected');
    expect(screen.getByText('Application')).toBeTruthy();
  });

  it('does not expose readiness while the authenticated user is hydrating', () => {
    render(
      <EnsureUserView {...defaults} isLoading>
        <div>Application</div>
      </EnsureUserView>
    );

    expect(screen.queryByTestId('app-readiness')).toBeNull();
  });
});
