import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';

import type { CreateFormStep } from '../types/create-form.types';
import { CreateProgressIndicator } from './CreateProgressIndicator';
import { CreateStepRenderer } from './CreateStepRenderer';

interface CarouselFormLayoutViewProps {
  steps: CreateFormStep[];
  currentStep: number;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  canScrollNext: boolean;
  canScrollPrev: boolean;
  currentStepValid: boolean;
  emblaRef: (node: HTMLDivElement | null) => void;
  isLastStep: boolean;
  labels: {
    creating: string;
    createButton: string;
    next: string;
    previous: string;
  };
  stepLabels: string[];
  validSteps: boolean[];
  onScrollNext: () => void;
  onScrollPrev: () => void;
  onStepClick: (step: number) => void;
}

export function CarouselFormLayoutView({
  steps,
  currentStep,
  onSubmit,
  isSubmitting,
  canScrollNext,
  canScrollPrev,
  currentStepValid,
  emblaRef,
  isLastStep,
  labels,
  stepLabels,
  validSteps,
  onScrollNext,
  onScrollPrev,
  onStepClick,
}: CarouselFormLayoutViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <CreateProgressIndicator
          currentStep={currentStep}
          totalSteps={steps.length}
          stepLabels={stepLabels}
          onStepClick={onStepClick}
          validSteps={validSteps}
        />
      </div>

      <div ref={emblaRef} className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full">
          {steps.map((step, index) => (
            <div key={index} className="min-h-0 min-w-0 flex-[0_0_100%] px-1">
              <div className="h-full overflow-y-auto py-2 pr-1">
                <CreateStepRenderer step={step} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onScrollPrev}
          disabled={!canScrollPrev}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {labels.previous}
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={isSubmitting || !currentStepValid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {labels.creating}
              </>
            ) : (
              labels.createButton
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onScrollNext}
            disabled={!canScrollNext || !currentStepValid}
          >
            {labels.next}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
