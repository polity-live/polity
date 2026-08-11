/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import i18n from '@/i18n/i18n';
import { useTranslation } from '../use-translation';

afterEach(async () => {
  useLanguageStore.getState().setLanguage('en');
  await i18n.changeLanguage('en');
  vi.restoreAllMocks();
});

describe('useTranslation', () => {
  it('syncs a differing i18n language and exposes translation helpers', async () => {
    useLanguageStore.getState().setLanguage('en');
    await i18n.changeLanguage('de');
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');
    const { result } = renderHook(() => useTranslation());

    expect(changeLanguage).toHaveBeenCalledWith('en');
    expect(result.current.t('components.labels.members')).toBe('Members');
    expect(result.current.tArray('pages.home.publicLanding.hero.decisionFlow')).toEqual([
      'Proposal',
      'Amendment',
      'Vote',
    ]);
    expect(result.current.tArray('components.labels.members')).toEqual([]);

    await act(() => result.current.changeLanguage('de'));
    expect(useLanguageStore.getState().language).toBe('de');
    expect(changeLanguage).toHaveBeenCalledWith('de');
    expect(result.current.i18n.changeLanguage).toBe(result.current.changeLanguage);
  });

  it('does not resynchronize an already matching language', async () => {
    useLanguageStore.getState().setLanguage('en');
    await i18n.changeLanguage('en');
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage');
    renderHook(() => useTranslation());
    expect(changeLanguage).not.toHaveBeenCalled();
  });
});
