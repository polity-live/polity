'use client';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { PWAInstallPromptView } from './PWAInstallPromptView';

export function PWAInstallPrompt() {
  const { t } = useTranslation();
  const { isVisible, handleDismiss, handleInstall } = usePwaInstallPrompt();

  if (!isVisible) return null;

  return (
    <PWAInstallPromptView
      installTitle={t('common.pwa.installTitle')}
      installDescription={t('common.pwa.installDescription')}
      dismissLabel={t('common.pwa.dismiss')}
      notNowLabel={t('common.pwa.notNow')}
      installLabel={t('common.pwa.install')}
      onDismiss={handleDismiss}
      onInstall={handleInstall}
    />
  );
}
