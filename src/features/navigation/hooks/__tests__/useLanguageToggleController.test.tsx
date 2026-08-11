/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageToggleController } from '../useLanguageToggleController';

const mocks = vi.hoisted(() => ({
  language: 'en',
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  success: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    changeLanguage: mocks.changeLanguage,
    t: (key: string) => `translated:${key}`,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success },
}));

beforeEach(() => {
  mocks.language = 'en';
  vi.clearAllMocks();
});

describe('useLanguageToggleController', () => {
  it('exposes localized labels and manages popover interactions', () => {
    const { result } = renderHook(() => useLanguageToggleController());
    expect(result.current.language).toBe('en');
    expect(result.current.labels).toEqual({
      english: 'translated:navigation.toggles.language.english',
      german: 'translated:navigation.toggles.language.german',
      moreLanguages: 'translated:navigation.toggles.language.moreLanguages',
      title: 'translated:navigation.toggles.language.title',
    });

    act(() => result.current.onPopoverTriggerMouseEnter());
    expect(result.current.isLanguagePopoverOpen).toBe(true);
    act(() => result.current.onPopoverMouseLeave());
    expect(result.current.isLanguagePopoverOpen).toBe(false);
    act(() => result.current.onPopoverOpenChange(true));
    expect(result.current.isLanguagePopoverOpen).toBe(true);
  });

  it('changes to English with default popover behavior and English toast icon', async () => {
    const { result } = renderHook(() => useLanguageToggleController());
    act(() => result.current.onPopoverOpenChange(true));
    await act(() => result.current.onLanguageChange('en'));

    expect(mocks.changeLanguage).toHaveBeenCalledWith('en');
    expect(mocks.success).toHaveBeenCalledWith(expect.any(String), {
      description: expect.any(String),
      icon: '🇺🇸',
    });
    expect(result.current.isLanguagePopoverOpen).toBe(true);
  });

  it('changes to German and closes the popover when requested', async () => {
    const { result } = renderHook(() => useLanguageToggleController());
    act(() => result.current.onPopoverOpenChange(true));
    await act(() => result.current.onLanguageChange('de', true));

    expect(mocks.changeLanguage).toHaveBeenCalledWith('de');
    expect(mocks.success).toHaveBeenCalledWith(expect.any(String), {
      description: expect.any(String),
      icon: '🇩🇪',
    });
    expect(result.current.isLanguagePopoverOpen).toBe(false);
  });
});
