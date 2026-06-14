import { useState } from 'react';

import type { Language } from '@/features/shared/global-state/language.store.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import deTranslation from '@/i18n/locales/de/deTranslation.ts';
import enTranslation from '@/i18n/locales/en/enTranslation.ts';

export function useLanguageToggleController() {
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  const { t, language, changeLanguage } = useTranslation();

  const handleLanguageChange = async (lang: Language, closePopover = false) => {
    const translations = lang === 'en' ? enTranslation : deTranslation;
    const successMessage = translations.navigation.toggles.language.changeSuccess;
    const description = translations.navigation.toggles.language.changeDescription;

    await changeLanguage(lang);

    toast.success(successMessage, {
      description,
      icon: lang === 'en' ? '🇺🇸' : '🇩🇪',
    });

    if (closePopover) {
      setIsLanguagePopoverOpen(false);
    }
  };

  return {
    isLanguagePopoverOpen,
    language,
    labels: {
      english: t('navigation.toggles.language.english'),
      german: t('navigation.toggles.language.german'),
      moreLanguages: t('navigation.toggles.language.moreLanguages'),
      title: t('navigation.toggles.language.title'),
    },
    onLanguageChange: handleLanguageChange,
    onPopoverOpenChange: setIsLanguagePopoverOpen,
    onPopoverTriggerMouseEnter: () => setIsLanguagePopoverOpen(true),
    onPopoverMouseLeave: () => setIsLanguagePopoverOpen(false),
  };
}
