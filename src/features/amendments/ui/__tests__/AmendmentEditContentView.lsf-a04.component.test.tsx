/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hashtags: undefined as any,
  media: undefined as any,
  textarea: undefined as any,
  validated: [] as any[],
  visibility: undefined as any,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlTextarea: (props: any) => {
    mocks.textarea = props;
    return <textarea />;
  },
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
  FormControlInput: (props: any) => <input {...props} />,
  SettingsActionBar: ({ children }: any) => <div>{children}</div>,
  SettingsPage: ({ children }: any) => <div>{children}</div>,
  SettingsTabs: ({ children }: any) => <div>{children}</div>,
  CreateReviewCard: ({ children }: any) => <div>{children}</div>,
  SummaryField: () => null,
}));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: (props: any) => {
    mocks.validated.push(props);
    return <input />;
  },
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children, value }: any) =>
    value === 'general' ? <section>{children}</section> : null,
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: (props: any) => {
    mocks.media = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: (props: any) => {
    mocks.hashtags = props;
    return <div />;
  },
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: (props: any) => {
    mocks.visibility = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({ GeoAddressPicker: () => null }));
vi.mock('@/features/shared/ui/status', () => ({ EditingModeMenuItems: () => null }));

import { AmendmentEditContentView } from '../AmendmentEditContentView';

afterEach(() => {
  cleanup();
  mocks.validated = [];
});

describe('AmendmentEditContentView LSF field adapters', () => {
  it('maps every general field and validator callback into form state', () => {
    const setFormData = vi.fn();
    const formData = {
      title: 'Title',
      subtitle: 'Subtitle',
      code: 'Code',
      hashtags: [],
      imageURL: '',
      videoURL: '',
      visibility: 'public',
    };
    render(
      <AmendmentEditContentView
        {...({
          amendmentId: 'a',
          amendment: { id: 'a' },
          isLoading: false,
          isCreating: false,
          activeTab: 'general',
          onTabChange: vi.fn(),
          navigate: vi.fn(),
          t: (key: string) => key,
          formData,
          setFormData,
          workflowStatusOption: {},
          workflowMenuValue: 'view',
          workflowModeDisabledReasons: {},
          controllingEvent: null,
          workflowBranchOptions: [],
          selectedWorkflowBranchId: null,
          selectedWorkflowBranchLabel: '',
          selectedWorkflowBranchEditable: false,
          setSelectedWorkflowBranchId: vi.fn(),
          isSubmitting: false,
          showReview: false,
          setShowReview: vi.fn(),
          formRef: { current: null },
          handleWorkflowStatusChange: vi.fn(),
          handleRemoveImage: vi.fn(),
          handleLocationFieldChange: vi.fn(),
          handleLocationCoordinatesChange: vi.fn(),
          handleLocationShapeChange: vi.fn(),
          locationSummary: null,
          handleSubmit: vi.fn(),
          onFormSubmit: vi.fn(),
          confirmCreate: vi.fn(),
        } as any)}
      />
    );

    mocks.media.onImageChange('/image.png');
    mocks.media.onVideoChange('/video.mp4');
    const [title, subtitle] = mocks.validated;
    title.onChange('New title');
    subtitle.onChange('New subtitle');
    expect(title.validator('valid')).toBe(true);
    expect(subtitle.validator('')).toBe(true);
    mocks.textarea.onChange({ target: { value: 'New code' } });
    mocks.visibility.onChange('private');
    mocks.hashtags.onChange(['tag']);
    expect(setFormData).toHaveBeenCalledTimes(7);
  });
});
