/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnlineUsersProvider, useOnlineUsers } from '../onlineUsers';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  peers: [] as { userId?: string | null }[],
  presenceArgs: [] as any[],
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../usePresence', () => ({
  usePresence: (...args: any[]) => {
    mocks.presenceArgs.push(args);
    return { peers: mocks.peers };
  },
}));

beforeEach(() => {
  mocks.user = null;
  mocks.peers = [];
  mocks.presenceArgs.length = 0;
});

afterEach(() => cleanup());

function Probe() {
  const online = useOnlineUsers();
  return (
    <div>
      <span data-testid="ids">{[...online.onlineUserIds].join(',')}</span>
      <span data-testid="self">{String(online.isUserOnline('self'))}</span>
      <span data-testid="peer">{String(online.isUserOnline('peer'))}</span>
      <span data-testid="missing">{String(online.isUserOnline('missing'))}</span>
      <span data-testid="undefined">{String(online.isUserOnline(undefined))}</span>
      <span data-testid="null">{String(online.isUserOnline(null))}</span>
    </div>
  );
}

describe('OnlineUsersProvider', () => {
  it('provides a safe empty value outside the provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('ids').textContent).toBe('');
    expect(screen.getByTestId('peer').textContent).toBe('false');
  });

  it('disables presence and omits initial data for anonymous users', () => {
    mocks.peers = [{ userId: 'peer' }, { userId: null }, {}];
    render(
      <OnlineUsersProvider>
        <Probe />
      </OnlineUsersProvider>
    );

    expect(mocks.presenceArgs.at(-1)).toEqual([
      'users:online',
      { enabled: false, initialData: undefined },
    ]);
    expect(screen.getByTestId('ids').textContent).toBe('peer');
    expect(screen.getByTestId('peer').textContent).toBe('true');
    expect(screen.getByTestId('undefined').textContent).toBe('false');
    expect(screen.getByTestId('null').textContent).toBe('false');
  });

  it('enables presence, includes the current user, and checks missing ids', () => {
    mocks.user = { id: 'self' };
    mocks.peers = [{ userId: 'peer' }, { userId: 'self' }];
    render(
      <OnlineUsersProvider>
        <Probe />
      </OnlineUsersProvider>
    );

    expect(mocks.presenceArgs.at(-1)).toEqual([
      'users:online',
      { enabled: true, initialData: { userId: 'self' } },
    ]);
    expect(screen.getByTestId('ids').textContent).toBe('peer,self');
    expect(screen.getByTestId('self').textContent).toBe('true');
    expect(screen.getByTestId('missing').textContent).toBe('false');
  });
});
