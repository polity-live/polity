/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnePageFormLayout } from '../OnePageFormLayout';
import type { CreateFormStep } from '../../types/create-form.types';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'pages.create.summary.createButton'
        ? 'Create'
        : key === 'pages.create.creating'
          ? 'Creating...'
          : key === 'pages.create.progress.stepOf'
            ? `Step ${values?.current} of ${values?.total}`
            : key,
  }),
}));

describe('OnePageFormLayout', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    class MockIntersectionObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('disables create when a required step is invalid', () => {
    const onSubmit = vi.fn();
    const steps: CreateFormStep[] = [
      {
        label: 'Required',
        isValid: () => false,
        fields: [],
      },
    ];

    render(
      <OnePageFormLayout
        steps={steps}
        currentStep={0}
        onStepChange={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );

    const createButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Create' });
    expect(createButton.disabled).toBe(true);

    fireEvent.click(createButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows create when only optional steps are invalid', () => {
    const onSubmit = vi.fn();
    const steps: CreateFormStep[] = [
      {
        label: 'Optional',
        isValid: () => false,
        optional: true,
        fields: [],
      },
    ];

    render(
      <OnePageFormLayout
        steps={steps}
        currentStep={0}
        onStepChange={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );

    const createButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Create' });
    expect(createButton.disabled).toBe(false);

    fireEvent.click(createButton);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
