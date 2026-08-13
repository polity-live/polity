/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/presence', () => ({
  OnlineUsersProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="presence-provider">{children}</div>
  ),
}));

vi.mock('@/providers/zero-provider', () => ({
  ZeroAppProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="zero-provider">{children}</div>
  ),
}));

import ConnectedAppRuntime from '../connected-app-runtime';

describe('ConnectedAppRuntime', () => {
  it('nests the Zero runtime inside the online-presence boundary', () => {
    render(
      <ConnectedAppRuntime>
        <span>Application</span>
      </ConnectedAppRuntime>
    );

    expect(
      screen.getByTestId('presence-provider').contains(screen.getByTestId('zero-provider'))
    ).toBe(true);
    expect(screen.getByText('Application')).toBeTruthy();
  });
});
