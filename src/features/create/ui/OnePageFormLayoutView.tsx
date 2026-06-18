import type { RefObject } from 'react';

import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';

import type { CreateFormStep } from '../types/create-form.types';
import { CreateProgressIndicator } from './CreateProgressIndicator';
import { CreateStepRenderer } from './CreateStepRenderer';

interface OnePageFormLayoutViewProps {
  steps: CreateFormStep[];
  activeSection: number;
  allStepsValid: boolean;
  sectionRefs: RefObject<(HTMLDivElement | null)[]>;
  stepLabels: string[];
  onStepClick: (step: number) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  creatingLabel: string;
  createButtonLabel: string;
}

export function OnePageFormLayoutView({
  steps,
  activeSection,
  allStepsValid,
  sectionRefs,
  stepLabels,
  onStepClick,
  onSubmit,
  isSubmitting,
  creatingLabel,
  createButtonLabel,
}: OnePageFormLayoutViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <CreateProgressIndicator
        sticky
        className="-mx-4 sm:-mx-5 lg:-mx-6"
        currentStep={activeSection}
        totalSteps={steps.length}
        stepLabels={stepLabels}
        onStepClick={onStepClick}
        validSteps={steps.map(() => true)}
      />

      <div className="space-y-10">
        {steps.map((step: any, index: number) => (
          <div
            key={index}
            ref={el => {
              sectionRefs.current[index] = el;
            }}
            className="scroll-mt-32"
            data-testid="one-page-create-section"
          >
            <div className="mb-5 flex items-center gap-3 border-b pb-4">
              <BadgeControl variant="outline" size="xs">
                {index + 1}
              </BadgeControl>
              <h3 className="text-foreground text-base leading-tight font-semibold">
                {step.label}
              </h3>
            </div>

            <div className="min-w-0">
              <CreateStepRenderer step={step} />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-5">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || !allStepsValid}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? creatingLabel : createButtonLabel}
        </Button>
      </div>
    </div>
  );
}
