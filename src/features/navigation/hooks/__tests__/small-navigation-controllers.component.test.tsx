/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDynamicNavigationController } from '../useDynamicNavigationController';
import { useNavUserAvatar2Controller } from '../useNavUserAvatar2Controller';
import { useThemeToggleController } from '../useThemeToggleController';

const mocks = vi.hoisted(() => ({
  authUser: null as { id: string } | null,
  isMobile: false,
  navigate: vi.fn(),
  setTheme: vi.fn(),
  theme: 'light' as string | undefined,
  themeMounted: false,
}));
vi.mock('@/features/shared/global-state/screen.store.tsx', () => ({
  useScreenStore: (selector: (state: object) => unknown) =>
    selector({ isMobileScreen: mocks.isMobile }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider.tsx', () => ({ useAuth: () => ({ user: mocks.authUser }) }));
vi.mock('@/features/shared/global-state/theme.store.tsx', () => ({
  useThemeStore: (selector: (state: object) => unknown) =>
    selector({ theme: mocks.theme, setTheme: mocks.setTheme, isMounted: mocks.themeMounted }),
}));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  mocks.authUser = null;
  mocks.isMobile = false;
  mocks.theme = 'light';
  mocks.themeMounted = false;
  vi.clearAllMocks();
});

describe('small navigation controllers', () => {
  it('resolves desktop, forced-mobile, and automatic screen types', () => {
    expect(
      renderHook(() => useDynamicNavigationController('desktop')).result.current.isMobileDevice
    ).toBe(false);
    expect(
      renderHook(() => useDynamicNavigationController('mobile')).result.current.isMobileDevice
    ).toBe(true);
    expect(
      renderHook(() => useDynamicNavigationController('automatic')).result.current.isMobileDevice
    ).toBe(false);
    mocks.isMobile = true;
    expect(
      renderHook(() => useDynamicNavigationController('automatic')).result.current.isMobileDevice
    ).toBe(true);
  });

  it('returns no avatar model without an authenticated user', () => {
    expect(renderHook(() => useNavUserAvatar2Controller(false)).result.current).toBeNull();
  });

  it('controls desktop and mobile avatar interactions', () => {
    mocks.authUser = { id: 'user-1' };
    const { result } = renderHook(() => useNavUserAvatar2Controller(false));
    expect(result.current?.popoverId).toBe('user-avatar');
    act(() => result.current?.onHoverStart());
    expect(result.current?.hoveredItem).toBe('user-avatar');
    act(() => result.current?.onHoverEnd());
    expect(result.current?.hoveredItem).toBeNull();
    act(() => result.current?.onClick());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/user/user-1' });
    expect(renderHook(() => useNavUserAvatar2Controller(true)).result.current?.popoverId).toBe(
      'user-avatar-mobile'
    );
  });

  it('uses system theme until mounted and exposes all theme actions', () => {
    const initial = renderHook(() => useThemeToggleController());
    expect(initial.result.current.currentTheme).toBe('system');
    initial.unmount();
    mocks.themeMounted = true;
    mocks.theme = undefined;
    const mounted = renderHook(() => useThemeToggleController());
    expect(mounted.result.current.currentTheme).toBe('system');
    act(() => mounted.result.current.onLight());
    act(() => mounted.result.current.onDark());
    act(() => mounted.result.current.onSystem());
    expect(mocks.setTheme.mock.calls.map(call => call[0])).toEqual(['light', 'dark', 'system']);
    mounted.unmount();
    mocks.theme = 'dark';
    expect(renderHook(() => useThemeToggleController()).result.current.currentTheme).toBe('dark');
  });
});
