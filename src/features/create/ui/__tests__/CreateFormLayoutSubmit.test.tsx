/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../CreateProgressIndicator', () => ({
  CreateProgressIndicator: () => <div data-testid="progress-indicator" />,
}));

vi.mock('../CreateStepRenderer', () => ({
  CreateStepRenderer: () => <div data-testid="step-renderer" />,
}));

import { CarouselFormLayoutView } from '../CarouselFormLayoutView';
import { OnePageFormLayoutView } from '../OnePageFormLayoutView';
import type { CreateFormStep } from '../../types/create-form.types';

afterEach(cleanup);

const steps: CreateFormStep[] = [
  {
    label: 'Review',
    isValid: () => true,
    fields: [],
  },
];

describe('create form submit layouts', () => {
  it('keeps the carousel submit button spinner-free while submitting', () => {
    const { container } = render(
      <CarouselFormLayoutView
        steps={steps}
        currentStep={0}
        onSubmit={vi.fn()}
        isSubmitting
        canScrollNext={false}
        canScrollPrev={false}
        currentStepValid
        emblaRef={vi.fn()}
        isLastStep
        labels={{
          creating: 'Creating',
          createButton: 'Create',
          next: 'Next',
          previous: 'Previous',
        }}
        stepLabels={['Review']}
        validSteps={[true]}
        onScrollNext={vi.fn()}
        onScrollPrev={vi.fn()}
        onStepClick={vi.fn()}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Creating' }).disabled).toBe(true);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('keeps the one-page submit button spinner-free while submitting', () => {
    const { container } = render(
      <OnePageFormLayoutView
        steps={steps}
        activeSection={0}
        sectionRefs={{ current: [] }}
        stepLabels={['Review']}
        onStepClick={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting
        creatingLabel="Creating"
        createButtonLabel="Create"
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Creating' }).disabled).toBe(true);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
