/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateFormStep } from '../../types/create-form.types';

const carouselMocks = vi.hoisted(() => ({
  emblaApi: null as ReturnType<typeof createEmblaApi> | null,
  emblaRef: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/carousel', () => ({
  useEmblaCarousel: () => [carouselMocks.emblaRef, carouselMocks.emblaApi],
}));

import { useCarouselFormLayoutController } from '../useCarouselFormLayoutController';

function createStep(isValid: boolean): CreateFormStep {
  return {
    label: isValid ? 'Valid step' : 'Invalid step',
    isValid: () => isValid,
    fields: [],
  };
}

function createEmblaApi(initialIndex = 0, stepCount = 3) {
  let selectedIndex = initialIndex;
  const listeners = new Map<string, Set<() => void>>();

  const notify = (event: string) => {
    listeners.get(event)?.forEach(listener => listener());
  };

  return {
    selectedScrollSnap: vi.fn(() => selectedIndex),
    canScrollPrev: vi.fn(() => selectedIndex > 0),
    canScrollNext: vi.fn(() => selectedIndex < stepCount - 1),
    scrollTo: vi.fn((index: number) => {
      selectedIndex = index;
    }),
    scrollPrev: vi.fn(() => {
      selectedIndex = Math.max(0, selectedIndex - 1);
      notify('select');
    }),
    scrollNext: vi.fn(() => {
      selectedIndex = Math.min(stepCount - 1, selectedIndex + 1);
      notify('select');
    }),
    on: vi.fn((event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    }),
    off: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }),
    triggerSelect(index: number) {
      selectedIndex = index;
      notify('select');
    },
  };
}

beforeEach(() => {
  carouselMocks.emblaApi = createEmblaApi();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCarouselFormLayoutController', () => {
  it('accepts swipe-selected next steps when prior steps are valid', async () => {
    const onStepChange = vi.fn();
    const steps = [createStep(true), createStep(true), createStep(true)];

    renderHook(() =>
      useCarouselFormLayoutController({
        steps,
        currentStep: 0,
        onStepChange,
      })
    );

    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith(0));
    onStepChange.mockClear();

    act(() => {
      carouselMocks.emblaApi?.triggerSelect(1);
    });

    expect(onStepChange).toHaveBeenCalledWith(1);
    expect(carouselMocks.emblaApi?.scrollTo).not.toHaveBeenCalled();
  });

  it('rejects swipe-selected next steps when the current step is invalid', async () => {
    const onStepChange = vi.fn();
    const steps = [createStep(false), createStep(true), createStep(true)];

    renderHook(() =>
      useCarouselFormLayoutController({
        steps,
        currentStep: 0,
        onStepChange,
      })
    );

    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith(0));
    onStepChange.mockClear();

    act(() => {
      carouselMocks.emblaApi?.triggerSelect(1);
    });

    expect(onStepChange).not.toHaveBeenCalled();
    expect(carouselMocks.emblaApi?.scrollTo).toHaveBeenCalledWith(0);
  });

  it('does not scroll beyond the review step from the last step', async () => {
    const onStepChange = vi.fn();
    const steps = [createStep(true), createStep(true)];
    carouselMocks.emblaApi = createEmblaApi(1, steps.length);

    const { result } = renderHook(() =>
      useCarouselFormLayoutController({
        steps,
        currentStep: 1,
        onStepChange,
      })
    );

    await waitFor(() => expect(result.current.isLastStep).toBe(true));

    act(() => {
      result.current.onScrollNext();
    });

    expect(carouselMocks.emblaApi?.scrollNext).not.toHaveBeenCalled();
  });
});
