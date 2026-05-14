import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useFormStyle } from '../hooks/useFormStyle';
import { CarouselFormLayout } from './CarouselFormLayout';
import { OnePageFormLayout } from './OnePageFormLayout';
import { FormStyleSelector } from './FormStyleSelector';
import type { CreateFormConfig } from '../types/create-form.types';

interface CreateFormShellProps {
  config: CreateFormConfig;
}

/**
 * Master wrapper: reads the user's form style preference,
 * then delegates to CarouselFormLayout or OnePageFormLayout.
 */
export function CreateFormShell({ config }: CreateFormShellProps) {
  const { t } = useTranslation();
  const { formMode } = useFormStyle();
  const [currentStep, setCurrentStep] = useState(0);
  const isCarouselLayout = formMode === 'carousel';

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const Layout = isCarouselLayout ? CarouselFormLayout : OnePageFormLayout;

  return (
    <div
      className={
        isCarouselLayout
          ? 'mx-auto flex h-[calc(100dvh-3rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 py-6'
          : 'mx-auto w-full max-w-2xl px-4 py-6'
      }
    >
      <Card
        className={isCarouselLayout ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}
      >
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{t(config.title)}</CardTitle>
            <CardDescription className="sr-only">{t(config.title)}</CardDescription>
          </div>
          <FormStyleSelector />
        </CardHeader>
        <CardContent className={isCarouselLayout ? 'flex min-h-0 flex-1 flex-col' : undefined}>
          <Layout
            steps={config.steps}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            onSubmit={config.onSubmit}
            isSubmitting={config.isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
