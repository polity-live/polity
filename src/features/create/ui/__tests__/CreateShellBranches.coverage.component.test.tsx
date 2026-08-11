/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  typeahead: undefined as Record<string, unknown> | undefined,
  review: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  PageHeader: ({ title }: { title: unknown }) => (
    <div data-testid="page-header">{String(title)}</div>
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  CreateReviewCard: (props: Record<string, unknown>) => {
    captured.review = props;
    return <div data-testid="review-card" />;
  },
}));

vi.mock('@/features/create/hooks/useCreateDescriptorFieldState', () => ({
  useCreateDescriptorFieldState: () => ({
    isInvalid: false,
    isValid: true,
    hintText: 'hint',
    markInteracted: vi.fn(),
  }),
}));

vi.mock('../CreateTypeaheadDescriptorFieldView', () => ({
  CreateTypeaheadDescriptorFieldView: (props: Record<string, unknown>) => {
    captured.typeahead = props;
    return <div data-testid="typeahead" />;
  },
}));

vi.mock('../FormStyleSelector', () => ({ FormStyleSelector: () => <div /> }));
vi.mock('../CarouselFormLayout', () => ({ CarouselFormLayout: () => <div>carousel</div> }));
vi.mock('../OnePageFormLayout', () => ({ OnePageFormLayout: () => <div>one page</div> }));
vi.mock('../CreateSubmissionOverlay', () => ({ CreateSubmissionOverlay: () => <div /> }));
vi.mock('../../logic/createReviewPreview', () => ({ getCreateReviewPreview: () => undefined }));
vi.mock('motion/react', () => ({ LayoutGroup: ({ children }: { children: any }) => children }));

import { CreateFlowFrame } from '../CreateFlowFrame';
import { CreateFormShellView } from '../CreateFormShellView';
import { CreateProgressIndicator } from '../CreateProgressIndicator';
import { CreateSummaryStep } from '../CreateSummaryStep';
import { CreateTypeaheadDescriptorField } from '../CreateTypeaheadDescriptorField';

afterEach(() => {
  cleanup();
  captured.typeahead = undefined;
  captured.review = undefined;
});

describe('remaining create shell branches', () => {
  it('renders both flow-frame alignments, layout modes, and optional actions', () => {
    const { rerender, getByTestId, queryByText } = render(
      <CreateFlowFrame title="Plain" isCarouselLayout={false}>
        content
      </CreateFlowFrame>
    );

    expect(queryByText('Plain')).toBeTruthy();
    expect(getByTestId('create-flow-frame').className).toContain('max-w-6xl');

    rerender(
      <CreateFlowFrame
        title="Aligned"
        action={<button type="button">action</button>}
        isCarouselLayout
        settingsAligned
      >
        content
      </CreateFlowFrame>
    );
    expect(getByTestId('page-header')).toBeTruthy();
    expect(getByTestId('create-flow-frame').className).toContain('max-w-5xl');
  });

  it('handles zero progress without a click callback', () => {
    const { container, rerender } = render(
      <CreateProgressIndicator currentStep={0} totalSteps={0} stepLabels={[]} />
    );

    expect(container.querySelector('[data-slot="section-progress-topbar"]')).toBeTruthy();
    rerender(<CreateProgressIndicator currentStep={0} totalSteps={3} stepLabels={['One']} />);
  });

  it('uses each settings-aligned entity operand', () => {
    const baseProps = {
      title: 'Create',
      isCarouselLayout: false,
      selectedFormStyle: 'one_page' as const,
      steps: [],
      currentStep: 0,
      isSubmitting: false,
      onFormStyleChange: vi.fn(),
      onStepChange: vi.fn(),
      onSubmit: vi.fn().mockResolvedValue(undefined),
      submission: {
        status: 'idle' as const,
        target: null,
        error: null,
        progressSteps: [],
        onBack: vi.fn(),
        onRetry: vi.fn(),
      },
    };
    const { rerender } = render(<CreateFormShellView {...baseProps} entityType="amendment" />);
    rerender(<CreateFormShellView {...baseProps} entityType="event" />);
    rerender(<CreateFormShellView {...baseProps} entityType="statement" />);
  });

  it('derives multi-value descriptor state and honors explicit validity', () => {
    render(
      <CreateTypeaheadDescriptorField
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            invalid: true,
            props: { multiple: true, values: ['one', 'two'], onValuesChange: vi.fn() },
          } as any
        }
      />
    );

    expect(captured.typeahead).toMatchObject({ multiple: true, invalid: true, isValid: true });
  });

  it('leaves summary sections undefined when both section forms are empty', () => {
    render(
      <CreateSummaryStep
        entityType="statement"
        badge="Statement"
        title="Empty"
        sections={[]}
        fields={[]}
      />
    );

    expect(captured.review?.sections).toBeUndefined();
  });
});
