import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as any,
  zeroReady: false,
  currentUser: null as any,
  ref: { current: false },
  refresh: vi.fn(),
  signOut: vi.fn(),
  stored: null as string | null,
  remove: vi.fn(),
}));

vi.mock('react', () => ({
  useRef: () => mocks.ref,
  useState: (initializer: () => unknown) => [initializer()],
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, refreshAuthState: mocks.refresh, signOut: mocks.signOut }),
}));
vi.mock('@/providers/zero-ready-context', () => ({ useZeroReady: () => mocks.zeroReady }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));

import { useHomePageController } from '../useHomePageController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  mocks.zeroReady = false;
  mocks.currentUser = null;
  mocks.ref.current = false;
  mocks.stored = null;
  vi.stubGlobal('window', {
    sessionStorage: { getItem: () => mocks.stored, removeItem: mocks.remove },
  });
  vi.stubGlobal('sessionStorage', (globalThis as any).window.sessionStorage);
});

describe('home page controller branches A07', () => {
  it('uses the SSR default and loading dependencies', () => {
    vi.stubGlobal('window', undefined);
    expect(useHomePageController().kind).toBe('loading');
    vi.stubGlobal('window', { sessionStorage: { getItem: () => null, removeItem: mocks.remove } });
    mocks.user = { id: 'u1', email: 'a@b' };
    expect(useHomePageController().kind).toBe('loading');
    mocks.zeroReady = true;
    expect(useHomePageController().kind).toBe('loading');
  });

  it('redirects completed users and starts onboarding from storage or an incomplete row', () => {
    mocks.user = { id: 'u1', email: 'a@b' };
    mocks.zeroReady = true;
    mocks.currentUser = { first_name: 'Ada' };
    expect(useHomePageController().kind).toBe('redirect');

    mocks.stored = 'true';
    mocks.currentUser = null;
    const stored = useHomePageController();
    expect(stored.kind).toBe('onboarding');
    if (stored.kind === 'onboarding') stored.onComplete();
    expect(mocks.remove).toHaveBeenCalledWith('polity_onboarding');

    mocks.ref.current = false;
    mocks.stored = null;
    mocks.currentUser = { first_name: '' };
    expect(useHomePageController().kind).toBe('onboarding');
    mocks.currentUser = { first_name: 'Ada' };
    expect(useHomePageController().kind).toBe('onboarding');
  });
});
