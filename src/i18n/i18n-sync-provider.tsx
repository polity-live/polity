'use client';

import { Fragment, useEffect } from 'react';
import {
  hydrateLanguageStore,
  useLanguageStore,
} from '@/features/shared/global-state/language.store.tsx';
import i18n from '@/i18n/i18n.ts';

/**
 * Provider that syncs the Zustand language store with i18next.
 * This ensures that all ui using either the custom useTranslation hook
 * or the react-i18next useTranslation hook stay in sync.
 */
export function I18nSyncProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore(state => state.language);
  const setLanguage = useLanguageStore(state => state.setLanguage);

  // Defer persisted/browser language selection until after React hydration.
  useEffect(() => {
    void hydrateLanguageStore();
  }, []);

  // Sync Zustand store changes to i18next
  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
  }, [language]);

  // Sync i18next changes back to Zustand store
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      if (lng !== language && (lng === 'en' || lng === 'de')) {
        setLanguage(lng as 'en' | 'de');
      }
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [language, setLanguage]);

  return <Fragment key={language}>{children}</Fragment>;
}
