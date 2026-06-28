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

  it('shows the carousel invalid reason as an alert beside a disabled submit button', () => {
    render(
      <CarouselFormLayoutView
        steps={steps}
        currentStep={0}
        onSubmit={vi.fn()}
        isSubmitting={false}
        canScrollNext={false}
        canScrollPrev={false}
        currentStepValid={false}
        currentStepInvalidReason="Choose an associated group"
        emblaRef={vi.fn()}
        isLastStep
        labels={{
          creating: 'Creating',
          createButton: 'Create',
          next: 'Next',
          previous: 'Previous',
        }}
        stepLabels={['Review']}
        validSteps={[false]}
        onScrollNext={vi.fn()}
        onScrollPrev={vi.fn()}
        onStepClick={vi.fn()}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Choose an associated group');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(true);
  });

  it('keeps the one-page submit button spinner-free while submitting', () => {
    const { container } = render(
      <OnePageFormLayoutView
        steps={steps}
        activeSection={0}
        allStepsValid
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

  it('shows the one-page invalid reason as an alert above a disabled submit button', () => {
    render(
      <OnePageFormLayoutView
        steps={steps}
        activeSection={0}
        allStepsValid={false}
        invalidReason="Complete the required fields"
        sectionRefs={{ current: [] }}
        stepLabels={['Review']}
        onStepClick={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
        creatingLabel="Creating"
        createButtonLabel="Create"
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Complete the required fields');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(true);
  });
});
