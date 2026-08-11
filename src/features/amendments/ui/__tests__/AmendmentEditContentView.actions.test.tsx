/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmendmentEditContentView,
  type AmendmentEditContentViewProps,
} from '../AmendmentEditContentView';

const mocks = vi.hoisted(() => ({
  selectChange: undefined as undefined | ((value: string) => void),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlTextarea: (props: ComponentProps<'textarea'>) => <textarea {...props} />,
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormControlInput: (props: ComponentProps<'input'>) => <input {...props} />,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsTabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CreateReviewCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SummaryField: ({ label, value }: { label: string; value: string }) => (
    <div>{`${label}: ${value}`}</div>
  ),
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/features/shared/ui/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    ...props
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => {
    mocks.selectChange = onValueChange;
    return <div {...props}>{children}</div>;
  },
  SelectTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
    textValue: _textValue,
    ...props
  }: ComponentProps<'button'> & { value: string; textValue?: string }) => (
    <button type="button" {...props} onClick={() => mocks.selectChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/shared/ui/status', () => ({
  EditingModeMenuItems: () => <button type="button">workflow mode</button>,
}));

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({ MediaUpload: () => <div /> }));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => <div /> }));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({ VisibilityInput: () => <div /> }));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({ GeoAddressPicker: () => <div /> }));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: ({
    validator: _validator,
    onValueChange: _onValueChange,
    label: _label,
    ...props
  }: ComponentProps<'input'> & {
    validator?: unknown;
    onValueChange?: unknown;
    label?: string;
  }) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

function createProps(overrides: Partial<AmendmentEditContentViewProps> = {}) {
  return {
    amendmentId: 'amendment-1',
    amendment: { id: 'amendment-1' },
    currentUserId: 'user-1',
    isLoading: false,
    mode: 'edit',
    agendaItemId: null,
    isCreating: false,
    activeTab: 'workflow' as const,
    onTabChange: vi.fn(),
    navigate: vi.fn(),
    t: (key: string) => key,
    updateAmendment: vi.fn(),
    createAmendment: vi.fn(),
    commonActions: {},
    amendmentHashtags: [],
    allHashtags: [],
    formData: {
      title: 'A1',
      subtitle: '',
      code: '',
      hashtags: [],
      imageURL: '',
      videoURL: '',
      visibility: 'public',
      workflowStatus: 'view',
      internalCRVotingCloseTrigger: 'all_collaborators_voted',
      internalCRVotingDurationMinutes: 60,
      internalCRResolutionVisibility: 'immediate',
      locationName: '',
      locationAddress: '',
      locationLatitude: null,
      locationLongitude: null,
      locationShape: null,
    },
    setFormData: vi.fn(),
    workflowStatusOption: {
      label: 'View',
      description: 'Read only',
      colorClass: '',
      Icon: () => null,
    },
    workflowMenuValue: 'view',
    workflowModeDisabledReasons: {},
    controllingEvent: null,
    workflowBranchOptions: [{ id: 'branch-1', label: 'Branch One' }],
    selectedWorkflowBranchId: 'branch-1',
    selectedWorkflowBranchLabel: 'Branch One',
    selectedWorkflowBranchEditable: true,
    setSelectedWorkflowBranchId: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    showReview: false,
    setShowReview: vi.fn(),
    formRef: { current: null },
    initializedRef: { current: false },
    hashtagsInitializedRef: { current: false },
    handleWorkflowStatusChange: vi.fn(),
    handleRemoveImage: vi.fn(),
    handleLocationFieldChange: vi.fn(),
    handleLocationCoordinatesChange: vi.fn(),
    handleLocationShapeChange: vi.fn(),
    locationSummary: null,
    handleSubmit: vi.fn(),
    onFormSubmit: vi.fn(event => event.preventDefault()),
    confirmCreate: vi.fn(),
    ...overrides,
  } satisfies AmendmentEditContentViewProps;
}

afterEach(() => {
  cleanup();
  mocks.selectChange = undefined;
});

describe('AmendmentEditContentView actions', () => {
  it('dispatches workflow selections, policy choices, cancellation, and submission', () => {
    const props = createProps();
    const { container } = render(<AmendmentEditContentView {...props} />);

    fireEvent.click(
      container.querySelector('[data-action-id="amendments.edit.select.workflow-branch-option"]')!
    );
    expect(props.setSelectedWorkflowBranchId).toHaveBeenCalledWith('branch-1');

    fireEvent.click(
      container.querySelector('[data-action-id="amendments.edit.open.workflow-status"]')!
    );
    for (const actionId of [
      'amendments.edit.select.cr-voting-close-trigger',
      'amendments.edit.select.cr-resolution-visibility',
    ]) {
      const choices = container.querySelectorAll(`[data-action-id="${actionId}"]`);
      expect(choices.length).toBeGreaterThan(0);
      fireEvent.click(choices[0]);
    }
    expect(props.setFormData).toHaveBeenCalled();

    fireEvent.click(container.querySelector('[data-action-id="amendments.edit.cancel.form"]')!);
    expect(props.navigate).toHaveBeenCalled();
    fireEvent.submit(container.querySelector('[data-action-id="amendments.edit.submit.form"]')!);
    expect(props.onFormSubmit).toHaveBeenCalledOnce();
  });

  it('dispatches not-found and create-review actions with deterministic disabled state', () => {
    const navigate = vi.fn();
    const { container, rerender } = render(
      <AmendmentEditContentView {...createProps({ amendment: null, navigate })} />
    );
    fireEvent.click(container.querySelector('[data-action-id="amendments.edit.navigate.home"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/' });

    const review = createProps({
      isCreating: true,
      showReview: true,
      amendment: null,
      isSubmitting: false,
    });
    rerender(<AmendmentEditContentView {...review} />);
    fireEvent.click(container.querySelector('[data-action-id="amendments.edit.review.previous"]')!);
    fireEvent.click(container.querySelector('[data-action-id="amendments.edit.review.confirm"]')!);
    expect(review.setShowReview).toHaveBeenCalledWith(false);
    expect(review.confirmCreate).toHaveBeenCalledOnce();

    rerender(<AmendmentEditContentView {...review} isSubmitting />);
    expect(
      (
        container.querySelector(
          '[data-action-id="amendments.edit.review.confirm"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('renders loading and every populated create-review variant', () => {
    const { container, rerender } = render(
      <AmendmentEditContentView {...createProps({ isLoading: true })} />
    );
    expect(container.textContent).toContain('features.amendments.editContent.loading');

    const shortCode = createProps({
      isCreating: true,
      showReview: true,
      amendment: null,
      locationSummary: 'Berlin',
      formData: {
        ...createProps().formData,
        title: '',
        subtitle: 'Subtitle',
        code: 'Short code',
        imageURL: 'image.png',
        videoURL: 'video.mp4',
      },
    });
    rerender(<AmendmentEditContentView {...shortCode} />);
    expect(container.textContent).toContain('Short code');
    expect(container.textContent).toContain('Berlin');

    rerender(
      <AmendmentEditContentView
        {...shortCode}
        formData={{ ...shortCode.formData, title: 'Title', code: 'x'.repeat(201) }}
      />
    );
    expect(container.textContent).toContain('…');
  });

  it('renders create mode defaults, routes cancellation, and covers submitting labels', () => {
    const navigate = vi.fn();
    const create = createProps({
      isCreating: true,
      amendment: null,
      navigate,
      workflowBranchOptions: [],
      selectedWorkflowBranchId: null,
      selectedWorkflowBranchLabel: null,
    });
    const { container, rerender } = render(<AmendmentEditContentView {...create} />);
    fireEvent.click(container.querySelector('[data-action-id="amendments.edit.cancel.form"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/create' });
    expect(container.textContent).toContain('pages.create.next');

    rerender(<AmendmentEditContentView {...create} isSubmitting />);
    expect(container.textContent).toContain('pages.create.common.creating');

    rerender(
      <AmendmentEditContentView
        {...create}
        isCreating={false}
        amendment={{ id: 'a' }}
        isSubmitting
      />
    );
    expect(container.textContent).toContain('features.amendments.editContent.saving');
  });

  it('covers workflow fallbacks, event state, disabled states, and duration parsing', () => {
    const setFormData = vi.fn();
    const base = createProps({
      setFormData,
      workflowBranchOptions: [],
      selectedWorkflowBranchId: null,
      selectedWorkflowBranchLabel: null,
      selectedWorkflowBranchEditable: false,
      controllingEvent: { title: 'Council' },
      formData: {
        ...createProps().formData,
        workflowStatus: 'suggest_event',
        internalCRVotingCloseTrigger: 'after_minutes',
        internalCRVotingDurationMinutes: 5,
        internalCRResolutionVisibility: 'collaborators',
        latitude: null,
        longitude: 13,
      },
    });
    const { container, rerender } = render(<AmendmentEditContentView {...base} />);
    expect(container.textContent).toContain('features.amendments.editContent.eventPhaseWarning');
    expect(
      (
        container.querySelector(
          '[data-action-id="amendments.edit.open.workflow-status"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    const duration = container.querySelector('#internalCRVotingDurationMinutes')!;
    fireEvent.change(duration, { target: { value: '12' } });
    fireEvent.change(duration, { target: { value: 'invalid' } });
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ internalCRVotingDurationMinutes: 12 })
    );
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ internalCRVotingDurationMinutes: 1 })
    );

    rerender(
      <AmendmentEditContentView
        {...base}
        selectedWorkflowBranchEditable
        workflowBranchOptions={[{ id: 'branch', label: 'Branch' }]}
        formData={{
          ...base.formData,
          workflowStatus: 'passed',
          internalCRVotingCloseTrigger: 'unknown',
          internalCRResolutionVisibility: 'unknown',
          latitude: 52,
          longitude: null,
        }}
      />
    );
    expect(
      (
        container.querySelector(
          '[data-action-id="amendments.edit.open.workflow-status"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
