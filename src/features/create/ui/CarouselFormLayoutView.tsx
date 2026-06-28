import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/features/shared/ui/ui/button';

import type { CreateFormStep } from '../types/create-form.types';
import { CreateProgressIndicator } from './CreateProgressIndicator';
import { CreateSubmitInvalidNotice } from './CreateSubmitInvalidNotice';
import { CreateStepRenderer } from './CreateStepRenderer';

interface CarouselFormLayoutViewProps {
  steps: CreateFormStep[];
  currentStep: number;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  canScrollNext: boolean;
  canScrollPrev: boolean;
  currentStepValid: boolean;
  currentStepInvalidReason?: ReactNode;
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
  currentStepInvalidReason,
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
          className="-mx-4 sm:-mx-5 lg:-mx-6"
          currentStep={currentStep}
          totalSteps={steps.length}
          stepLabels={stepLabels}
          onStepClick={onStepClick}
          validSteps={validSteps}
        />
      </div>

      <div ref={emblaRef} className="min-h-0 flex-1 overflow-hidden py-4">
        <div className="flex h-full">
          {steps.map((step: any, index: number) => (
            <div key={index} className="min-h-0 min-w-0 flex-[0_0_100%] px-1">
              <div className="h-full overflow-y-auto pr-1">
                <CreateStepRenderer step={step} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-background/95 flex shrink-0 items-center justify-between border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onScrollPrev}
          disabled={!canScrollPrev}
          data-create-action="previous-step"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {labels.previous}
        </Button>

        <div className="flex flex-col items-end gap-2">
          {currentStepInvalidReason ? (
            <CreateSubmitInvalidNotice
              reason={currentStepInvalidReason}
              className="max-w-sm py-3 text-sm"
            />
          ) : null}

          {isLastStep ? (
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={isSubmitting || !currentStepValid}
              data-create-action="submit"
            >
              {isSubmitting ? labels.creating : labels.createButton}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onScrollNext}
              disabled={!canScrollNext || !currentStepValid}
              data-create-action="next-step"
            >
              {labels.next}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
