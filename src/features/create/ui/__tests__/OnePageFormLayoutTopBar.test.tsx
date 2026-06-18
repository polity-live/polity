/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateFormStep } from '../../types/create-form.types';

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

vi.mock('../CreateStepRenderer', () => ({
  CreateStepRenderer: () => <div data-testid="step-renderer" />,
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(cleanup);

import { OnePageFormLayoutView } from '../OnePageFormLayoutView';

const steps: CreateFormStep[] = [
  { label: 'Basics', isValid: () => true, fields: [] },
  { label: 'Details', isValid: () => true, fields: [] },
  { label: 'Review', isValid: () => true, fields: [] },
];

describe('OnePageFormLayoutView topbar', () => {
  it('uses the active section and lets users jump to any section', () => {
    const onStepClick = vi.fn();

    render(
      <OnePageFormLayoutView
        steps={steps}
        activeSection={1}
        allStepsValid
        sectionRefs={{ current: [] }}
        stepLabels={steps.map(step => step.label)}
        onStepClick={onStepClick}
        onSubmit={vi.fn()}
        isSubmitting={false}
        creatingLabel="Creating"
        createButtonLabel="Create"
      />
    );

    expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-current')).toBe(
      'step'
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Review' }).disabled).toBe(false);
    expect(screen.getAllByTestId('one-page-create-section')).toHaveLength(steps.length);

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(onStepClick).toHaveBeenCalledWith(2);
  });
});
