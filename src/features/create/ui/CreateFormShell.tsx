import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useFormStyle } from '../hooks/useFormStyle';
import type { CreateFormConfig } from '../types/create-form.types';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import type { CreateFormStyle } from '@/zero/preferences/schema';
import { CreateFormShellView } from './CreateFormShellView';

interface CreateFormShellProps {
  config: CreateFormConfig;
}

/**
 * Master wrapper: reads the user's form style preference,
 * then delegates to CarouselFormLayout or OnePageFormLayout.
 */
export function CreateFormShell({ config }: CreateFormShellProps) {
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

  return (
    <CreateFormShellView
      title={t(config.title)}
      isCarouselLayout={isCarouselLayout}
      selectedFormStyle={selectedFormStyle}
      steps={config.steps}
      currentStep={currentStep}
      onFormStyleChange={handleFormStyleChange}
      onStepChange={handleStepChange}
      onSubmit={config.onSubmit}
      isSubmitting={config.isSubmitting}
    />
  );
}
