import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useHorizontalArrowNavigation } from '@/features/shared/hooks/useHorizontalArrowNavigation';
import { useEmblaCarousel } from '@/features/shared/ui/ui/carousel';

import type { CreateFormStep } from '../types/create-form.types';

interface UseCarouselFormLayoutControllerProps {
  steps: CreateFormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

function canNavigateForwardToStep(steps: CreateFormStep[], targetStep: number) {
  return steps.slice(0, targetStep).every(step => step.isValid());
}

export function useCarouselFormLayoutController({
  steps,
  currentStep,
  onStepChange,
}: UseCarouselFormLayoutControllerProps) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ watchDrag: true });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const currentStepValid = steps[currentStep]?.isValid() ?? false;
  const currentStepInvalidReason = currentStepValid
    ? null
    : (steps[currentStep]?.getInvalidReason?.() ?? null);
  const canNavigateNext = canNavigateForwardToStep(steps, currentStep + 1);

  const onSelect = useCallback(() => {
    const api = emblaApi as NonNullable<typeof emblaApi>;
    const index = api.selectedScrollSnap();

    if (index > currentStep && !canNavigateForwardToStep(steps, index)) {
      api.scrollTo(currentStep);
      setCanScrollPrev(currentStep > 0);
      setCanScrollNext(currentStep < steps.length - 1);
      return;
    }

    onStepChange(index);
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, [currentStep, emblaApi, onStepChange, steps]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== currentStep) {
      emblaApi.scrollTo(currentStep);
    }
  }, [emblaApi, currentStep]);

  const scrollPrev = useCallback(() => {
    if (emblaApi && canScrollPrev) {
      emblaApi.scrollPrev();
    }
  }, [emblaApi, canScrollPrev]);

  const scrollNext = useCallback(() => {
    if (emblaApi && canScrollNext && canNavigateForwardToStep(steps, currentStep + 1)) {
      emblaApi.scrollNext();
    }
  }, [emblaApi, canScrollNext, currentStep, steps]);

  useHorizontalArrowNavigation({
    mode: 'global',
    canGoPrev: canScrollPrev,
    canGoNext: canScrollNext && canNavigateNext,
    onGoPrev: scrollPrev,
    onGoNext: scrollNext,
  });

  const handleStepClick = useCallback(
    (step: number) => {
      const canNavigate = steps.slice(0, step).every(s => s.isValid());
      if (canNavigate && emblaApi) {
        emblaApi.scrollTo(step);
      }
    },
    [emblaApi, steps]
  );

  return {
    canScrollNext: canScrollNext && canNavigateNext,
    canScrollPrev,
    currentStepValid,
    currentStepInvalidReason,
    emblaRef,
    isLastStep: currentStep === steps.length - 1,
    labels: {
      creating: t('pages.create.creating'),
      createButton: t('pages.create.summary.createButton'),
      next: t('pages.create.next'),
      previous: t('pages.create.previous'),
    },
    stepLabels: steps.map(s => s.label),
    validSteps: steps.map((_, index) => steps.slice(0, index).every(s => s.isValid())),
    onScrollNext: scrollNext,
    onScrollPrev: scrollPrev,
    onStepClick: handleStepClick,
  };
}
