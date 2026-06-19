'use client';

import { ArrowLeft, ArrowRight, Smartphone } from 'lucide-react';

import { PwaInstallPanel } from '@/features/pwa/ui';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { Button } from '@/features/shared/ui/ui/button.tsx';

interface AppInstallStepProps {
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function AppInstallStep({ onNext, onBack, isLoading }: AppInstallStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex">
          <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-lg">
            <Smartphone className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-3xl leading-tight font-bold tracking-tight">
          {t('onboarding.appInstallStep.title')}
        </h2>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          {t('onboarding.appInstallStep.description')}
        </p>
      </div>

      <div data-swipe-lock>
        <PwaInstallPanel surface="onboarding" />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.goBack')}
        </Button>
        <Button type="button" onClick={onNext} disabled={isLoading} size="lg">
          {t('onboarding.appInstallStep.continue')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
