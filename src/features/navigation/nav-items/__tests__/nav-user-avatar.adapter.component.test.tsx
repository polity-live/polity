/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavUserAvatar } from '../nav-user-avatar';

const mocks = vi.hoisted(() => ({ user: null as { id: string } | null, zeroReady: false }));
vi.mock('@/providers/auth-provider.tsx', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/providers/zero-ready-context.ts', () => ({ useZeroReady: () => mocks.zeroReady }));
vi.mock('../nav-user-avatar-connected', () => ({
  default: ({ authUser }: { authUser: { id: string } }) => <div>connected:{authUser.id}</div>,
}));

afterEach(() => {
  cleanup();
  mocks.user = null;
  mocks.zeroReady = false;
});

describe('NavUserAvatar readiness adapter', () => {
  it('requires authentication and Zero readiness for the connected avatar', async () => {
    const first = render(<NavUserAvatar navigationView="asButtonList" isMobile={false} />);
    expect(first.container.firstChild).toBeNull();
    first.unmount();
    mocks.user = { id: 'user-1' };
    const second = render(<NavUserAvatar navigationView="asButtonList" isMobile={false} />);
    expect(second.container.firstChild).toBeNull();
    second.unmount();
    mocks.zeroReady = true;
    render(<NavUserAvatar navigationView="asButtonList" isMobile />);
    await waitFor(() => expect(screen.getByText('connected:user-1')).toBeTruthy());
  });
});
