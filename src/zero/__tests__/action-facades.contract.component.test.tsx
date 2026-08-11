/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });
  const mutation = (key: string) => vi.fn((args: unknown) => token(key, args));
  return {
    zeroMutate: vi.fn(),
    onServerError: vi.fn(),
    trackCreation: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    updateAuthUser: vi.fn(),
    preferenceState: {
      preference: null as Record<string, unknown> | null,
      isLoading: false,
      groupNetworkLayouts: {} as Record<string, unknown>,
    },
    stores: {
      theme: 'dark',
      language: 'de',
      navigationView: 'sidebar',
      setTheme: vi.fn(),
      setLanguage: vi.fn(),
      setNavigationView: vi.fn(),
      setDisplayCurrency: vi.fn(),
    },
    ai: {
      createSkill: mutation('ai.createSkill'),
      updateSkill: mutation('ai.updateSkill'),
      deleteSkill: mutation('ai.deleteSkill'),
      createTool: mutation('ai.createTool'),
      updateTool: mutation('ai.updateTool'),
    },
    calendar: {
      subscribe: mutation('calendar.subscribe'),
      update: mutation('calendar.update'),
      unsubscribe: mutation('calendar.unsubscribe'),
    },
    preferences: {
      create: mutation('preferences.create'),
      update: mutation('preferences.update'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.zeroMutate }),
}));
vi.mock('../mutators', () => ({
  mutators: {
    ai: mocks.ai,
    calendarSubscriptions: mocks.calendar,
    preferences: mocks.preferences,
  },
}));
vi.mock('../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => mocks.onServerError(...args),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: (...args: unknown[]) => mocks.trackCreation(...args),
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../preferences/usePreferenceState', () => ({
  usePreferenceState: () => mocks.preferenceState,
}));
vi.mock('@/features/shared/global-state/theme.store', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ theme: mocks.stores.theme, setTheme: mocks.stores.setTheme }),
}));
vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: (selector: (state: unknown) => unknown) =>
    selector({ language: mocks.stores.language, setLanguage: mocks.stores.setLanguage }),
}));
vi.mock('@/features/navigation/state/navigation.store', () => ({
  useNavigationStore: (selector: (state: unknown) => unknown) =>
    selector({
      navigationView: mocks.stores.navigationView,
      setNavigationView: mocks.stores.setNavigationView,
    }),
}));
vi.mock('@/features/shared/global-state/currency.store', () => ({
  useDisplayCurrencyStore: (selector: (state: unknown) => unknown) =>
    selector({ setDisplayCurrency: mocks.stores.setDisplayCurrency }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser: mocks.updateAuthUser } }),
}));

import { useAiActions } from '../ai/useAiActions';
import { useCalendarSubscriptionActions } from '../calendar-subscriptions/useCalendarSubscriptionActions';
import { usePreferenceActions } from '../preferences/usePreferenceActions';
import { usePreferenceSync } from '../preferences/usePreferenceSync';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.zeroMutate.mockImplementation((mutation: unknown) => ({
    mutation,
    server: Promise.resolve({ type: 'success' }),
  }));
  mocks.onServerError.mockImplementation((_result, callback) => callback('server-error'));
  mocks.updateAuthUser.mockResolvedValue({ error: null });
  mocks.preferenceState.preference = null;
  mocks.preferenceState.isLoading = false;
  mocks.preferenceState.groupNetworkLayouts = {};
  mocks.stores.theme = 'dark';
  mocks.stores.language = 'de';
  mocks.stores.navigationView = 'sidebar';
});

describe('Zero action facade contracts', () => {
  it('routes every AI skill and tool action through Zero with finalization', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useAiActions());

    act(() => {
      result.current.createSkill({
        slug: 'summarize',
        name: 'Summarize',
        system_prompt: 'Summarize this',
      });
      result.current.updateSkill({
        id: 'skill-1',
        slug: 'updated',
        name: 'Updated',
        system_prompt: 'Updated prompt',
      });
      result.current.deleteSkill('skill-1');
      result.current.createTool({ tool_name: 'create_group' });
      result.current.updateTool({ id: 'tool-1', tool_name: 'create_group', enabled: false });
    });

    expect(mocks.ai.createSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        aliases: '',
        enabled: true,
      })
    );
    expect(mocks.ai.updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-1', aliases: '' })
    );
    expect(mocks.ai.deleteSkill).toHaveBeenCalledWith({ id: 'skill-1' });
    expect(mocks.ai.createTool).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      tool_name: 'create_group',
      enabled: true,
    });
    expect(mocks.ai.updateTool).toHaveBeenCalledWith({
      id: 'tool-1',
      tool_name: 'create_group',
      enabled: false,
    });
    expect(mocks.zeroMutate).toHaveBeenCalledTimes(5);
    expect(mocks.trackCreation).toHaveBeenCalledTimes(2);
    expect(mocks.onServerError).toHaveBeenCalledTimes(3);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledTimes(3);
  });

  it('subscribes, updates, and unsubscribes calendars with error feedback', () => {
    const { result } = renderHook(() => useCalendarSubscriptionActions());

    act(() => {
      result.current.subscribeToCalendar({ id: 'subscription-1', group_id: 'group-1' } as never);
      result.current.updateCalendarSubscription({ id: 'subscription-1', color: 'blue' } as never);
      result.current.unsubscribeFromCalendar({ id: 'subscription-1' } as never);
    });

    expect(mocks.calendar.subscribe).toHaveBeenCalledWith({
      id: 'subscription-1',
      group_id: 'group-1',
    });
    expect(mocks.calendar.update).toHaveBeenCalledWith({ id: 'subscription-1', color: 'blue' });
    expect(mocks.calendar.unsubscribe).toHaveBeenCalledWith({ id: 'subscription-1' });
    expect(mocks.zeroMutate).toHaveBeenCalledTimes(3);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledTimes(3);
  });

  it('creates, updates, blocks, and scopes every preference action deterministically', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const created = renderHook(() => usePreferenceActions());

    act(() => {
      created.result.current.updateFormStyle('one_page');
      created.result.current.updateTheme('light');
      created.result.current.updateAppearanceTheme('theme-1');
      created.result.current.updateLanguage('en');
      created.result.current.updateDisplayCurrency('USD');
      created.result.current.updateNavigationView('asButtonList');
      created.result.current.saveNetworkLayout('custom', { nodes: {}, edges: {} } as never);
      created.result.current.resetNetworkLayout('custom');
      created.result.current.saveGroupNetworkLayout('group-1', { nodes: {}, edges: {} } as never);
      created.result.current.resetGroupNetworkLayout('group-1');
      created.result.current.saveDecisionTerminalDashboard({ widgets: [] } as never);
    });

    expect(mocks.preferences.create).toHaveBeenCalledTimes(11);
    expect(mocks.preferences.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: '00000000-0000-4000-8000-000000000002', theme: 'light' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(5);

    mocks.preferenceState.preference = { id: 'preference-1' };
    const existing = renderHook(() => usePreferenceActions());
    act(() => existing.result.current.updateTheme('system'));
    expect(mocks.preferences.update).toHaveBeenCalledWith({
      id: 'preference-1',
      theme: 'system',
    });

    mocks.preferenceState.isLoading = true;
    const loading = renderHook(() => usePreferenceActions());
    act(() => loading.result.current.updateTheme('dark'));
    expect(mocks.preferences.create).toHaveBeenCalledTimes(11);
    expect(mocks.preferences.update).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledTimes(12);
  });

  it('restores existing preferences and persists subsequent store changes', async () => {
    mocks.stores.theme = 'light';
    mocks.stores.language = 'en';
    mocks.stores.navigationView = 'asButtonList';
    mocks.preferenceState.preference = {
      id: 'preference-1',
      theme: 'light',
      language: 'en',
      display_currency: 'USD',
      navigation_view: 'asButtonList',
      created_at: 1,
      updated_at: 2,
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hook = renderHook(() => usePreferenceSync());

    expect(mocks.stores.setTheme).toHaveBeenCalledWith('light');
    expect(mocks.stores.setLanguage).toHaveBeenCalledWith('en');
    expect(mocks.stores.setNavigationView).toHaveBeenCalledWith('asButtonList');
    expect(mocks.stores.setDisplayCurrency).toHaveBeenCalledWith('USD');

    mocks.stores.theme = 'system';
    mocks.stores.language = 'de';
    mocks.stores.navigationView = 'sidebar';
    hook.rerender();

    await waitFor(() => {
      expect(mocks.preferences.update).toHaveBeenCalledWith({
        id: 'preference-1',
        theme: 'system',
      });
      expect(mocks.preferences.update).toHaveBeenCalledWith({
        id: 'preference-1',
        language: 'de',
      });
      expect(mocks.preferences.update).toHaveBeenCalledWith({
        id: 'preference-1',
        navigation_view: 'sidebar',
      });
    });
    expect(mocks.updateAuthUser).toHaveBeenCalledWith({ data: { language: 'de' } });
    expect(error).toHaveBeenCalledTimes(3);
  });
});
