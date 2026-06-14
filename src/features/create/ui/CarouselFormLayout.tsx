import { useCarouselFormLayoutController } from '../hooks/useCarouselFormLayoutController';
import type { CreateFormStep } from '../types/create-form.types';
import { CarouselFormLayoutView } from './CarouselFormLayoutView';

interface CarouselFormLayoutProps {
  steps: CreateFormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function CarouselFormLayout({
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  isSubmitting,
}: CarouselFormLayoutProps) {
  return (
    <CarouselFormLayoutView
      steps={steps}
      currentStep={currentStep}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      {...useCarouselFormLayoutController({ steps, currentStep, onStepChange })}
    />
  );
}
