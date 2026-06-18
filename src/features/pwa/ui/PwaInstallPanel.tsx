'use client';

import {
  CheckCircle2,
  Download,
  Info,
  Loader2,
  type LucideIcon,
  RotateCw,
  Share2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { usePwaInstall, type PwaInstallStatus } from '@/features/pwa/hooks/usePwaInstallPrompt';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

interface PwaInstallPanelProps {
  surface: 'onboarding' | 'settings';
  onDismiss?: () => void;
  className?: string;
}

const STATUS_ICONS = {
  checking: Loader2,
  installed: CheckCircle2,
  promptable: Download,
  'manual-ios': Share2,
  'reload-required': RotateCw,
  unavailable: Info,
} satisfies Record<PwaInstallStatus, LucideIcon>;

function getTitleKey(surface: PwaInstallPanelProps['surface'], status: PwaInstallStatus) {
  if (status === 'promptable') {
    return `common.pwa.installPanel.${surface}.promptableTitle`;
  }

  if (status === 'manual-ios') {
    return `common.pwa.installPanel.${surface}.manualTitle`;
  }

  if (status === 'installed') {
    return 'common.pwa.installPanel.installedTitle';
  }

  if (status === 'checking') {
    return 'common.pwa.installPanel.checkingTitle';
  }

  if (status === 'reload-required') {
    return 'common.pwa.installPanel.reloadRequiredTitle';
  }

  return 'common.pwa.installPanel.unavailableTitle';
}

function getDescriptionKey(surface: PwaInstallPanelProps['surface'], status: PwaInstallStatus) {
  if (status === 'promptable') {
    return `common.pwa.installPanel.${surface}.promptableDescription`;
  }

  if (status === 'manual-ios') {
    return `common.pwa.installPanel.${surface}.manualDescription`;
  }

  if (status === 'installed') {
    return 'common.pwa.installPanel.installedDescription';
  }

  if (status === 'checking') {
    return 'common.pwa.installPanel.checkingDescription';
  }

  if (status === 'reload-required') {
    return 'common.pwa.installPanel.reloadRequiredDescription';
  }

  return 'common.pwa.installPanel.unavailableDescription';
}

export function PwaInstallPanel({ surface, onDismiss, className }: PwaInstallPanelProps) {
  const { t } = useTranslation();
  const { canPrompt, install, isInstalling, outcome, reload, status } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (surface === 'onboarding' && isDismissed) {
    return null;
  }

  const Icon = STATUS_ICONS[status];
  const isManualIos = status === 'manual-ios';
  const isChecking = status === 'checking';
  const showReloadAction = status === 'reload-required';
  const showInstallAction = canPrompt && status === 'promptable';
  const content = (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <div className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-md">
        <Icon className={cn('h-5 w-5', isChecking && 'animate-spin')} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base leading-6 font-semibold">{t(getTitleKey(surface, status))}</h3>
            <BadgeControl variant="outline">
              {t(`common.pwa.installPanel.status.${status}`)}
            </BadgeControl>
          </div>
          <p className="text-muted-foreground text-sm leading-6">
            {t(getDescriptionKey(surface, status))}
          </p>
        </div>

        {isManualIos && (
          <ol className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-3">
            <li className="rounded-md border p-3">{t('common.pwa.installPanel.iosStepShare')}</li>
            <li className="rounded-md border p-3">{t('common.pwa.installPanel.iosStepAdd')}</li>
            <li className="rounded-md border p-3">{t('common.pwa.installPanel.iosStepConfirm')}</li>
          </ol>
        )}

        {outcome === 'dismissed' && surface === 'settings' && (
          <p className="text-muted-foreground text-sm">
            {t('common.pwa.installPanel.dismissedMessage')}
          </p>
        )}
      </div>

      <div className="flex flex-none items-center gap-2 sm:justify-end">
        {showInstallAction && (
          <Button
            type="button"
            onClick={() => {
              void install().catch(error => {
                console.error('Failed to trigger PWA install:', error);
              });
            }}
            loading={isInstalling}
            loadingLabel={t('common.pwa.installPanel.installingAction')}
          >
            <Download className="h-4 w-4" />
            {t('common.pwa.installPanel.installAction')}
          </Button>
        )}

        {showReloadAction && (
          <Button type="button" variant="outline" onClick={reload}>
            <RotateCw className="h-4 w-4" />
            {t('common.pwa.installPanel.reloadAction')}
          </Button>
        )}

        {surface === 'onboarding' && onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsDismissed(true);
              onDismiss();
            }}
            aria-label={t('common.pwa.dismiss')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (surface === 'settings') {
    return content;
  }

  return (
    <Card surface="primarySoft">
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}
