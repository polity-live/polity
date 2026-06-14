import type { RefObject } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';

import type { CreateFormStep } from '../types/create-form.types';
import { CreateProgressIndicator } from './CreateProgressIndicator';
import { CreateStepRenderer } from './CreateStepRenderer';

interface OnePageFormLayoutViewProps {
  steps: CreateFormStep[];
  activeSection: number;
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
  sectionRefs,
  stepLabels,
  onStepClick,
  onSubmit,
  isSubmitting,
  creatingLabel,
  createButtonLabel,
}: OnePageFormLayoutViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-background/95 sticky top-0 z-10 pt-2 pb-2 backdrop-blur-sm">
        <CreateProgressIndicator
          currentStep={activeSection}
          totalSteps={steps.length}
          stepLabels={stepLabels}
          onStepClick={onStepClick}
        />
      </div>

      <div className="space-y-8">
        {steps.map((step: any, index: number) => (
          <div
            key={index}
            ref={el => {
              sectionRefs.current[index] = el;
            }}
            className="scroll-mt-24"
          >
            <h3 className="text-muted-foreground mb-3 text-sm font-medium">
              {index + 1}. {step.label}
            </h3>
            <CreateStepRenderer step={step} />
          </div>
        ))}
      </div>

      <Button onClick={onSubmit} disabled={isSubmitting} className="w-full" size="lg">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {creatingLabel}
          </>
        ) : (
          createButtonLabel
        )}
      </Button>
    </div>
  );
}
