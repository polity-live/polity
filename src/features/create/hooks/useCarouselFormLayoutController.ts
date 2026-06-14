import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEmblaCarousel } from '@/features/shared/ui/ui/carousel';

import type { CreateFormStep } from '../types/create-form.types';

interface UseCarouselFormLayoutControllerProps {
  steps: CreateFormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
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

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    onStepChange(index);
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi, onStepChange]);

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
    if (emblaApi && canScrollNext && currentStepValid) {
      emblaApi.scrollNext();
    }
  }, [emblaApi, canScrollNext, currentStepValid]);

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
    canScrollNext,
    canScrollPrev,
    currentStepValid,
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
