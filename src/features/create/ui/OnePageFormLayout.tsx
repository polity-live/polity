import { useOnePageFormLayoutController } from '../hooks/useOnePageFormLayoutController';
import type { CreateFormStep } from '../types/create-form.types';
import { OnePageFormLayoutView } from './OnePageFormLayoutView';

interface OnePageFormLayoutProps {
  steps: CreateFormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function OnePageFormLayout({
  steps,
  onStepChange,
  onSubmit,
  isSubmitting,
}: OnePageFormLayoutProps) {
  return (
    <OnePageFormLayoutView
      steps={steps}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      {...useOnePageFormLayoutController({ steps, onStepChange })}
    />
  );
}
