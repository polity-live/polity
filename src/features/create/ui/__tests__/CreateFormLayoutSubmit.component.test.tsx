/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const focus = vi.hoisted(() => vi.fn());
vi.mock('../../logic/createFormFocus', () => ({ focusCreateSection: focus }));

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
  it('returns to the first invalid section and does not advance or submit an incomplete form', () => {
    const submit = vi.fn(),
      next = vi.fn(),
      select = vi.fn();
    const props = {
      steps: [{ ...steps[0], isValid: () => false }],
      currentStep: 0,
      onSubmit: submit,
      isSubmitting: false,
      canScrollNext: true,
      canScrollPrev: false,
      currentStepValid: false,
      emblaRef: vi.fn(),
      isLastStep: false,
      labels: { creating: 'Creating', createButton: 'Create', next: 'Next', previous: 'Previous' },
      stepLabels: ['Review'],
      validSteps: [false],
      onScrollNext: next,
      onScrollPrev: vi.fn(),
      onStepClick: select,
    };
    const view = render(
      <div data-create-flow>
        <CarouselFormLayoutView {...props} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(next).not.toHaveBeenCalled();
    view.rerender(<CarouselFormLayoutView {...props} canScrollNext={false} currentStepValid />);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    view.rerender(
      <div data-create-flow>
        <CarouselFormLayoutView {...props} isLastStep />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(select).toHaveBeenLastCalledWith(0);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(<CarouselFormLayoutView {...props} steps={steps} isLastStep />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(select).toHaveBeenCalledTimes(2);
    expect(submit).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith(expect.any(HTMLElement), 0);
  });
  it('dispatches carousel and one-page navigation and submit actions through stable intents', () => {
    const onScrollPrev = vi.fn();
    const onScrollNext = vi.fn();
    const onCarouselSubmit = vi.fn();
    const { rerender } = render(
      <CarouselFormLayoutView
        steps={steps}
        currentStep={0}
        onSubmit={onCarouselSubmit}
        isSubmitting={false}
        canScrollNext
        canScrollPrev
        currentStepValid
        emblaRef={vi.fn()}
        isLastStep={false}
        labels={{
          creating: 'Creating',
          createButton: 'Create',
          next: 'Next',
          previous: 'Previous',
        }}
        stepLabels={['Review']}
        validSteps={[true]}
        onScrollNext={onScrollNext}
        onScrollPrev={onScrollPrev}
        onStepClick={vi.fn()}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="create.carousel.previous"]')!);
    fireEvent.click(document.querySelector('[data-action-id="create.carousel.next"]')!);
    expect(onScrollPrev).toHaveBeenCalledOnce();
    expect(onScrollNext).toHaveBeenCalledOnce();

    rerender(
      <CarouselFormLayoutView
        steps={steps}
        currentStep={0}
        onSubmit={onCarouselSubmit}
        isSubmitting={false}
        canScrollNext={false}
        canScrollPrev
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
        onScrollNext={onScrollNext}
        onScrollPrev={onScrollPrev}
        onStepClick={vi.fn()}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="create.carousel.submit"]')!);
    expect(onCarouselSubmit).toHaveBeenCalledOnce();

    const onOnePageSubmit = vi.fn();
    rerender(
      <OnePageFormLayoutView
        steps={steps}
        activeSection={0}
        allStepsValid
        sectionRefs={{ current: [] }}
        stepLabels={['Review']}
        onStepClick={vi.fn()}
        onSubmit={onOnePageSubmit}
        isSubmitting={false}
        creatingLabel="Creating"
        createButtonLabel="Create"
      />
    );
    const submit = document.querySelector(
      '[data-action-id="create.one-page.submit"]'
    ) as HTMLElement;
    submit.focus();
    expect(document.activeElement).toBe(submit);
    fireEvent.click(submit);
    expect(onOnePageSubmit).toHaveBeenCalledOnce();
  });

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

  it('shows the carousel invalid reason as an alert beside an actionable submit button', () => {
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
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(false);
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

  it('shows the one-page invalid reason as an alert above an actionable submit button', () => {
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
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(false);
  });
});
