/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const basePalette = {
    background: '#fff',
    foreground: '#111',
    card: '#eee',
    border: '#ccc',
    secondary: '#ddd',
    primary: '#00f',
    primaryForeground: '#fff',
    accent: '#0ff',
  };
  const polity = {
    id: 'polity',
    name: 'Polity',
    kind: 'builtin',
    fonts: { sans: 'sans', display: 'display' },
    light: basePalette,
    dark: { ...basePalette, secondary: '#222', background: '#000' },
  };
  return {
    polity,
    group: { ...polity, id: 'group', name: 'Group', kind: 'group' },
    other: { ...polity, id: 'other', name: 'Other', kind: 'builtin' },
    themes: [] as any[],
    themesLoading: false,
    preferenceLoading: false,
    selectedId: null as string | null,
    setAppearanceTheme: vi.fn(),
    updateAppearanceTheme: vi.fn(),
    updateProfile: vi.fn(),
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    toastError: vi.fn(),
  };
});

const { polity, group, other } = mocks;

vi.mock('@/features/shared/appearance-theme', () => ({
  FONT_FAMILIES: { sans: 'Arial', display: 'Georgia' },
  POLITY_THEME: mocks.polity,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/global-state/theme.store', () => ({
  useThemeStore: (
    selector: (state: { setAppearanceTheme: typeof mocks.setAppearanceTheme }) => unknown
  ) => selector({ setAppearanceTheme: mocks.setAppearanceTheme }),
}));
vi.mock('@/zero/appearance-themes/hooks', () => ({
  useAvailableAppearanceThemes: () => ({ themes: mocks.themes, isLoading: mocks.themesLoading }),
}));
vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({ updateAppearanceTheme: mocks.updateAppearanceTheme }),
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({
    appearanceThemeId: mocks.selectedId,
    isLoading: mocks.preferenceLoading,
  }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: (...args: unknown[]) => mocks.toastError(...args) },
}));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: mocks.updateProfile }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) },
  }),
}));

import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { AppearanceThemeSelector } from '../ui/AppearanceThemeSelector';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.themes = [polity, group, other];
  mocks.themesLoading = false;
  mocks.preferenceLoading = false;
  mocks.selectedId = null;
  mocks.upload.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/avatar' } });
  mocks.updateProfile.mockResolvedValue(undefined);
  vi.spyOn(Date, 'now').mockReturnValue(123);
});
afterEach(cleanup);

describe('appearance and avatar branches A07', () => {
  it('shows loading for either data source', () => {
    mocks.themesLoading = true;
    const view = render(<AppearanceThemeSelector />);
    expect(screen.getByText('common.loading.default')).toBeTruthy();
    mocks.themesLoading = false;
    mocks.preferenceLoading = true;
    view.rerender(<AppearanceThemeSelector />);
    expect(screen.getByText('common.loading.default')).toBeTruthy();
  });

  it('renders builtin/group and selected/unselected cards and persists null/custom ids', () => {
    const view = render(<AppearanceThemeSelector />);
    expect(screen.getAllByText('pages.user.preferences.builtinTheme')).toHaveLength(2);
    expect(screen.getByText('pages.user.preferences.groupTheme')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Polity/ }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: /Polity/ }));
    fireEvent.click(screen.getByRole('button', { name: /Group/ }));
    expect(mocks.updateAppearanceTheme).toHaveBeenCalledWith(null);
    expect(mocks.updateAppearanceTheme).toHaveBeenCalledWith('group');

    mocks.selectedId = 'group';
    view.rerender(<AppearanceThemeSelector />);
    expect(screen.getByRole('button', { name: /Group/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Other/ }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('rejects missing avatar inputs', async () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const withoutUser = renderHook(() => useAvatarUpload({ userId: '' }));
    await expect(withoutUser.result.current.uploadAvatar(file)).rejects.toThrow('require a file');
    const withUser = renderHook(() => useAvatarUpload({ userId: 'u1' }));
    await expect(withUser.result.current.uploadAvatar(null as never)).rejects.toThrow(
      'require a file'
    );
  });

  it('uploads, cache-busts, updates profile and optionally calls success', async () => {
    const onSuccess = vi.fn();
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const hook = renderHook(() => useAvatarUpload({ userId: 'u1', onSuccess }));
    await expect(hook.result.current.uploadAvatar(file)).resolves.toBe('https://cdn/avatar?t=123');
    expect(mocks.upload).toHaveBeenCalledWith('u1/avatar', file, {
      upsert: true,
      contentType: 'image/png',
    });
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      avatar: 'https://cdn/avatar?t=123',
      video_url: null,
    });
    expect(onSuccess).toHaveBeenCalledWith('https://cdn/avatar?t=123');

    const noCallback = renderHook(() => useAvatarUpload({ userId: 'u2' }));
    await noCallback.result.current.uploadAvatar(file);
  });

  it('reports storage failures and rethrows them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('storage down');
    mocks.upload.mockResolvedValue({ error });
    const hook = renderHook(() => useAvatarUpload({ userId: 'u1' }));
    await expect(hook.result.current.uploadAvatar(new File(['x'], 'a.png'))).rejects.toBe(error);
    expect(mocks.toastError).toHaveBeenCalled();
  });
});
