/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, unknown>) => {
      if (key === 'pages.create.progress.label') return 'Create flow';
      if (key === 'pages.create.progress.stepOf') {
        return `Step ${args?.current} of ${args?.total}`;
      }
      return key;
    },
  }),
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(cleanup);

import { CreateProgressIndicator } from '../CreateProgressIndicator';

describe('CreateProgressIndicator', () => {
  it('uses the shared flow topbar design and preserves valid-step click rules', () => {
    const onStepClick = vi.fn();

    const { container } = render(
      <CreateProgressIndicator
        currentStep={1}
        totalSteps={4}
        stepLabels={['Basics', 'Details', 'Options', 'Review']}
        validSteps={[true, true, false, false]}
        onStepClick={onStepClick}
      />
    );

    expect(container.querySelector('[data-slot="section-progress-topbar"]')).toBeTruthy();
    expect(screen.getByText('Create flow')).toBeTruthy();
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-current')).toBe(
      'step'
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Options' }).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Basics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));

    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
