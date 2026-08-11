/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preference: null as any,
  loading: false,
  theme: 'light',
  language: 'de',
  navigationView: 'sidebar',
  setTheme: vi.fn(),
  setLanguage: vi.fn(),
  setNavigationView: vi.fn(),
  setDisplayCurrency: vi.fn(),
  mutate: vi.fn(),
  onServerError: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../usePreferenceState', () => ({
  usePreferenceState: () => ({ preference: mocks.preference, isLoading: mocks.loading }),
}));
vi.mock('../../mutators', () => ({
  mutators: {
    preferences: {
      create: (args: unknown) => ({ type: 'create', args }),
      update: (args: unknown) => ({ type: 'update', args }),
    },
  },
}));
vi.mock('@/features/shared/global-state/theme.store', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ theme: mocks.theme, setTheme: mocks.setTheme }),
}));
vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: (selector: (state: unknown) => unknown) =>
    selector({ language: mocks.language, setLanguage: mocks.setLanguage }),
}));
vi.mock('@/features/navigation/state/navigation.store', () => ({
  useNavigationStore: (selector: (state: unknown) => unknown) =>
    selector({ navigationView: mocks.navigationView, setNavigationView: mocks.setNavigationView }),
}));
vi.mock('@/features/shared/global-state/currency.store', () => ({
  useDisplayCurrencyStore: (selector: (state: unknown) => unknown) =>
    selector({ setDisplayCurrency: mocks.setDisplayCurrency }),
}));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser: mocks.updateUser } }),
}));

import { usePreferenceSync } from '../usePreferenceSync';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preference = null;
  mocks.loading = false;
  mocks.theme = 'light';
  mocks.language = 'de';
  mocks.navigationView = 'sidebar';
  mocks.mutate.mockReturnValue({ server: Promise.resolve() });
  mocks.updateUser.mockResolvedValue({ error: null });
});

describe('usePreferenceSync branches A07', () => {
  it('does nothing while loading or without an initial preference', () => {
    mocks.loading = true;
    const loading = renderHook(() => usePreferenceSync());
    expect(mocks.mutate).not.toHaveBeenCalled();
    mocks.loading = false;
    loading.rerender();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('restores an existing preference including currency fallback and optional fields', () => {
    mocks.preference = {
      id: 'p1',
      created_at: 1,
      updated_at: 2,
      display_currency: null,
      theme: 'dark',
      language: 'en',
      navigation_view: 'buttons',
    };
    const hook = renderHook(() => usePreferenceSync());
    expect(mocks.setDisplayCurrency).toHaveBeenCalledWith('EUR');
    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
    expect(mocks.setLanguage).toHaveBeenCalledWith('en');
    expect(mocks.setNavigationView).toHaveBeenCalledWith('buttons');
    hook.rerender();
    expect(mocks.setTheme).toHaveBeenCalledOnce();
  });

  it('skips absent optional existing fields and preserves a present currency', () => {
    mocks.preference = {
      id: 'p2',
      created_at: 1,
      updated_at: 2,
      display_currency: 'USD',
      theme: null,
      language: null,
      navigation_view: null,
    };
    renderHook(() => usePreferenceSync());
    expect(mocks.setDisplayCurrency).toHaveBeenCalledWith('USD');
    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(mocks.setLanguage).not.toHaveBeenCalled();
    expect(mocks.setNavigationView).not.toHaveBeenCalled();
  });

  it('pushes browser defaults for a new user and then persists changed fields', async () => {
    mocks.preference = { id: 'p3', created_at: 1, updated_at: 1, display_currency: 'EUR' };
    const hook = renderHook(() => usePreferenceSync());
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
    mocks.mutate.mockClear();

    mocks.theme = 'dark';
    mocks.language = 'en';
    mocks.navigationView = 'asButtonList';
    hook.rerender();
    expect(mocks.mutate).toHaveBeenCalledTimes(3);
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } });
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalled());
  });

  it('creates a preference after sync if the row disappears and skips writes while loading', () => {
    mocks.preference = { id: 'p4', created_at: 1, updated_at: 1, display_currency: 'EUR' };
    const hook = renderHook(() => usePreferenceSync());
    mocks.mutate.mockClear();
    mocks.preference = null;
    mocks.theme = 'dark';
    hook.rerender();
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ type: 'create' }));

    mocks.mutate.mockClear();
    mocks.loading = true;
    mocks.theme = 'system';
    hook.rerender();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('reports auth language failures and server create/update failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.updateUser.mockResolvedValue({ error: { message: 'auth failed' } });
    mocks.onServerError.mockImplementation((_result, callback) => callback('server failed'));
    mocks.preference = { id: 'p5', created_at: 1, updated_at: 1, display_currency: 'EUR' };
    const hook = renderHook(() => usePreferenceSync());
    mocks.language = 'fr';
    hook.rerender();
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Auth language update failed:', 'auth failed')
    );
    expect(consoleError).toHaveBeenCalledWith('Preference update failed:', 'server failed');

    mocks.preference = null;
    mocks.theme = 'dark';
    hook.rerender();
    expect(consoleError).toHaveBeenCalledWith('Preference create failed:', 'server failed');
  });
});
