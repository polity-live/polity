import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import type { CreateFormStyle } from '@/zero/preferences/schema';
import { useFormStyle } from './useFormStyle';
import type { CreateFormConfig } from '../types/create-form.types';

interface UseCreateFormShellControllerOptions {
  config: CreateFormConfig;
}

export function useCreateFormShellController({ config }: UseCreateFormShellControllerOptions) {
  const { t } = useTranslation();
  const { createFormStyle } = usePreferenceState();
  const { updateFormStyle } = usePreferenceActions();
  const [optimisticFormStyle, setOptimisticFormStyle] = useState<CreateFormStyle | null>(null);
  const selectedFormStyle = optimisticFormStyle ?? createFormStyle;
  const { formMode } = useFormStyle(selectedFormStyle);
  const [currentStep, setCurrentStep] = useState(0);
  const isCarouselLayout = formMode === 'carousel';

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const handleFormStyleChange = useCallback(
    (style: CreateFormStyle) => {
      setOptimisticFormStyle(style);
      updateFormStyle(style);
    },
    [updateFormStyle]
  );

  useEffect(() => {
    if (optimisticFormStyle === createFormStyle) {
      setOptimisticFormStyle(null);
    }
  }, [createFormStyle, optimisticFormStyle]);

  return {
    title: t(config.title),
    isCarouselLayout,
    selectedFormStyle,
    steps: config.steps,
    currentStep,
    onFormStyleChange: handleFormStyleChange,
    onStepChange: handleStepChange,
    onSubmit: config.onSubmit,
    isSubmitting: config.isSubmitting,
  };
}
