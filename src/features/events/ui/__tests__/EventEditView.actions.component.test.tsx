/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventEditView, type EventEditViewProps } from '../EventEditView';

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

vi.mock('@/features/shared/ui/form', () => ({
  CreateReviewCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormControlLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  SettingsPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  SettingsPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SettingsTabs: ({ children, onValueChange }: any) => (
    <div>
      <button type="button" data-mock-action="tab" onClick={() => onValueChange('time-series')}>
        tab
      </button>
      {children}
    </div>
  ),
  SummaryField: ({ value }: { value: ReactNode }) => <span>{value}</span>,
  SwitchField: ({ id, onCheckedChange }: any) => (
    <button type="button" data-mock-action={`switch-${id}`} onClick={() => onCheckedChange(true)}>
      switch
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: ({ onChange }: any) => (
    <button type="button" data-mock-action="visibility" onClick={() => onChange('private')}>
      visibility
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/DelegateAllocationInput', () => ({
  DelegateAllocationInput: ({ onChange }: any) => (
    <button
      type="button"
      data-mock-action="delegate-allocation"
      onClick={() => onChange({ allocationMode: 'total', totalDelegates: 4, delegateRatio: 2 })}
    >
      allocation
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/ChangeRequestVoteOrderInput', () => ({
  ChangeRequestVoteOrderInput: ({ onChange }: any) => (
    <button type="button" data-mock-action="vote-order" onClick={() => onChange('before')}>
      vote order
    </button>
  ),
}));
vi.mock('@/features/elections/ui/ElectionModeInput', () => ({
  ElectionModeInput: ({ onChange }: any) => (
    <button type="button" data-mock-action="election-mode" onClick={() => onChange('single')}>
      election
    </button>
  ),
}));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: ({ onImageChange, onVideoChange, onImageRemove }: any) => (
    <div>
      <button type="button" data-mock-action="image" onClick={() => onImageChange('image.png')}>
        image
      </button>
      <button type="button" data-mock-action="video" onClick={() => onVideoChange('video.mp4')}>
        video
      </button>
      {onImageRemove ? (
        <button type="button" data-mock-action="remove-image" onClick={onImageRemove}>
          remove
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: ({ onChange }: any) => (
    <button type="button" data-mock-action="hashtags" onClick={() => onChange(['civic'])}>
      hashtags
    </button>
  ),
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  TypeaheadSearch: ({ onChange }: any) => (
    <div>
      <button
        type="button"
        data-mock-action="group-selected"
        onClick={() => onChange({ id: 'group-2' })}
      >
        group
      </button>
      <button type="button" data-mock-action="group-cleared" onClick={() => onChange(null)}>
        clear group
      </button>
    </div>
  ),
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({
  GeoAddressPicker: ({ onCoordinatesChange, onShapeChange, onFieldChange }: any) => (
    <div>
      <button
        type="button"
        data-mock-action="coordinates"
        onClick={() => {
          onCoordinatesChange({ latitude: 1, longitude: 2 });
          onCoordinatesChange(null);
        }}
      >
        coordinates
      </button>
      <button
        type="button"
        data-mock-action="shape"
        onClick={() => onShapeChange({ kind: 'point' })}
      >
        shape
      </button>
      {['country', 'region', 'city', 'post_code', 'street', 'house_number', 'unknown'].map(
        field => (
          <button
            type="button"
            key={field}
            data-mock-action={`geo-${field}`}
            onClick={() => onFieldChange(field, `value-${field}`)}
          >
            {field}
          </button>
        )
      )}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/form/MiniPlateEditor', () => ({
  MiniPlateEditor: ({ onChange }: any) => (
    <button type="button" data-mock-action="description" onClick={() => onChange([])}>
      description
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: ({ id, onChange, validator }: any) => {
    validator?.('');
    validator?.('valid-value');
    validator?.('2');
    return (
      <button type="button" data-mock-action={`input-${id}`} onClick={() => onChange('changed')}>
        {id}
      </button>
    );
  },
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

vi.mock('../CancelEventDialog', () => ({
  CancelEventDialog: ({ onOpenChange }: any) => (
    <button type="button" data-mock-action="cancel-dialog" onClick={() => onOpenChange(false)}>
      dialog
    </button>
  ),
}));
vi.mock('../EventTimeSeriesSection', () => ({
  EventTimeSeriesSection: (sectionProps: any) => (
    <button
      type="button"
      data-mock-action="time-series"
      onClick={() => {
        sectionProps.onDateTimeChange('startDate', '2026-08-01');
        sectionProps.onRecurrencePatternChange('weekly');
        sectionProps.onRecurrenceEndDateChange('2026-09-01');
        sectionProps.onRecurrenceIntervalChange(2);
        sectionProps.onRecurrenceWeekdaysChange([1]);
        sectionProps.deadlines.forEach((deadline: any) => deadline.onChange('2026-07-01'));
      }}
    >
      time series
    </button>
  ),
}));
vi.mock('../EventAttendanceModeSelector', () => ({
  EventAttendanceModeSelector: ({ onChange }: any) => (
    <button type="button" data-mock-action="attendance" onClick={() => onChange('hybrid')}>
      attendance
    </button>
  ),
}));

afterEach(cleanup);

const t = (key: string) => key;

function props(overrides: Partial<EventEditViewProps> = {}): EventEditViewProps {
  return {
    activeTab: 'basic',
    attendanceModeLabel: 'Online',
    attendanceModeLocked: false,
    can: vi.fn(),
    canDeleteEvent: true,
    cancelDialogOpen: false,
    confirmCreate: vi.fn(),
    event: { event_type: null, group_id: null, id: 'event-1' },
    eventId: 'event-1',
    formData: {
      attendanceMode: 'online',
      capacity: '',
      city: '',
      country: '',
      delegatesNominationDeadline: '',
      delegateAllocationMode: 'ratio',
      delegateElectionMode: 'list',
      delegateMembersPerSeat: '10',
      delegateTotalSeats: '',
      description: '',
      descriptionContent: [],
      endDate: '',
      endTime: '',
      eventStreamUrl: '',
      hashtags: [],
      imageURL: '',
      locationName: '',
      postCode: '',
      registrationDeadline: '',
      amendmentDeadline: '',
      candidacyDeadline: '',
      recurrenceEndDate: '',
      recurrenceInterval: '1',
      recurrencePattern: 'none',
      recurrenceWeekdays: [],
      startDate: '',
      startTime: '',
      street: '',
      houseNumber: '',
      streetNumber: '',
      tags: [],
      title: 'Covered event',
      videoURL: '',
      visibility: 'public',
      defaultFinalVoteDurationMinutes: '',
      genderQuotaEnabled: false,
      accreditationRequired: false,
      changeRequestVoteOrder: 'before_discussion',
      latitude: null,
      longitude: null,
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
    },
    formRef: createRef<HTMLFormElement>(),
    groupTypeaheadItems: [],
    groups: [],
    handleSubmit: vi.fn((event: { preventDefault(): void }) => event.preventDefault()),
    isCreating: false,
    isLoading: false,
    isSubmitting: false,
    locationSummary: 'Online',
    manageEventGroupIds: [],
    mode: 'edit',
    navigate: vi.fn(),
    onFormSubmit: vi.fn((event: { preventDefault(): void }) => event.preventDefault()),
    onTabChange: vi.fn(),
    removeImage: vi.fn(),
    selectableGroups: [],
    setCancelDialogOpen: vi.fn(),
    setFormData: vi.fn(),
    setShowReview: vi.fn(),
    showReview: false,
    t,
    timeSeriesValidationError: null,
    timeSeriesValidationMessage: null,
    updateDescriptionContent: vi.fn(),
    updateField: vi.fn(),
    visibilityLabel: 'Public',
    ...overrides,
  };
}

describe('EventEditView action contracts', () => {
  it('renders the loading state', () => {
    render(<EventEditView {...props({ isLoading: true })} />);
    expect(screen.getByTestId('page-skeleton')).toBeTruthy();
  });

  it('returns from missing events and saves or closes an editable event through stable actions', () => {
    const navigate = vi.fn();
    const missing = render(<EventEditView {...props({ event: null, navigate })} />);
    const back = screen.getByRole('button', { name: 'features.events.backToCalendar' });
    expect(back.getAttribute('data-action-id')).toBe('events.edit.back-to-calendar');
    fireEvent.click(back);
    expect(navigate).toHaveBeenCalledWith({ to: '/calendar' });
    missing.unmount();

    const onFormSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const setCancelDialogOpen = vi.fn();
    const updateField = vi.fn();
    const setFormData = vi.fn();
    const removeImage = vi.fn();
    render(
      <EventEditView
        {...props({
          navigate,
          onFormSubmit,
          setCancelDialogOpen,
          setFormData,
          updateField,
          removeImage,
        })}
      />
    );
    const form = document.querySelector('[data-action-id="events.edit.save.form-submit"]')!;
    const save = document.querySelector('[data-action-id="events.edit.save"]')!;
    const close = document.querySelector('[data-action-id="events.edit.close"]')!;
    const cancelEvent = document.querySelector('[data-action-id="events.edit.cancel-event.open"]')!;
    expect(save).not.toBeNull();
    fireEvent.submit(form);
    expect(onFormSubmit).toHaveBeenCalledOnce();
    fireEvent.click(close);
    expect(navigate).toHaveBeenLastCalledWith({ to: '/event/event-1' });
    fireEvent.click(cancelEvent);
    expect(setCancelDialogOpen).toHaveBeenCalledWith(true);
    for (const action of document.querySelectorAll<HTMLElement>('[data-mock-action]')) {
      fireEvent.click(action);
    }
    expect(updateField).toHaveBeenCalledWith('imageURL', 'image.png');
    expect(updateField).toHaveBeenCalledWith('videoURL', 'video.mp4');
    expect(updateField).toHaveBeenCalledWith('groupId', 'group-2');
    expect(updateField).toHaveBeenCalledWith('groupId', '');
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ tags: ['civic'] }));
    expect(removeImage).toHaveBeenCalled();
  });

  it('moves backward or confirms the create review without exposing the hidden form as an action', () => {
    const confirmCreate = vi.fn();
    const setShowReview = vi.fn();
    const { container } = render(
      <EventEditView
        {...props({ confirmCreate, isCreating: true, setShowReview, showReview: true })}
      />
    );
    const previous = container.querySelector('[data-action-id="events.edit.review.previous"]')!;
    const confirm = container.querySelector('[data-action-id="events.edit.review.confirm"]')!;
    fireEvent.click(previous);
    expect(setShowReview).toHaveBeenCalledWith(false);
    fireEvent.click(confirm);
    expect(confirmCreate).toHaveBeenCalledOnce();
    expect(container.querySelector('form.hidden [data-action-id]')).toBeNull();
  });

  it('renders a complete submitting hybrid review and all conditional summary fields', () => {
    render(
      <EventEditView
        {...props({
          isCreating: true,
          isSubmitting: true,
          showReview: true,
          locationSummary: 'Town hall, Berlin',
          formData: {
            ...props().formData,
            title: '',
            description: 'Description',
            tags: ['civic'],
            imageURL: 'image.png',
            videoURL: 'video.mp4',
            startDate: '2026-08-01',
            endDate: '2026-08-02',
            attendanceMode: 'hybrid',
            onlineLink: 'https://meet.example.test',
            streamUrl: 'https://stream.example.test',
            capacity: '20',
          },
        })}
      />
    );
    expect(screen.getByText('pages.create.common.creating')).toBeTruthy();
    expect(screen.getByText('Town hall, Berlin')).toBeTruthy();
    expect(screen.getByText('https://meet.example.test')).toBeTruthy();
  });

  it('covers general, delegate, location, create, and submitting edit variants', () => {
    const updateField = vi.fn();
    const navigate = vi.fn();
    const base = props({ updateField, navigate, canDeleteEvent: false });
    const completeForm = {
      ...base.formData,
      attendanceMode: 'hybrid',
      latitude: 1,
      longitude: 2,
      location_kind: 'point',
      location_place_id: 'place-1',
      location_boundary_source: 'manual',
      location_geometry: { type: 'Point', coordinates: [1, 2] },
      location_bounds: { south: 0, west: 0, north: 3, east: 3 },
      groupId: 'group-1',
    };
    const { rerender, container } = render(
      <EventEditView
        {...base}
        event={{ id: 'event-1', event_type: 'general_assembly' }}
        formData={completeForm}
      />
    );
    expect(container.textContent).toContain(
      'generated.inline.0488_all_active_members_of_the_linked_group_are_in_768156c8'
    );
    for (const action of container.querySelectorAll<HTMLElement>('[data-mock-action]')) {
      fireEvent.click(action);
    }
    for (const field of [
      'country',
      'region',
      'city',
      'postCode',
      'street',
      'houseNumber',
      'latitude',
      'longitude',
      'location_kind',
      'location_place_id',
      'location_boundary_source',
      'location_geometry',
      'location_bounds',
    ]) {
      expect(updateField.mock.calls.some(([calledField]) => calledField === field)).toBe(true);
    }

    rerender(
      <EventEditView
        {...base}
        event={{ id: 'event-1', event_type: 'delegate_assembly' }}
        formData={{
          ...completeForm,
          delegateTotalSeats: '8',
          delegateMembersPerSeat: '4',
        }}
      />
    );
    fireEvent.click(container.querySelector('[data-mock-action="delegate-allocation"]')!);
    fireEvent.click(container.querySelector('[data-mock-action="election-mode"]')!);
    fireEvent.click(
      container.querySelector('[data-mock-action="input-delegatesNominationDeadline"]')!
    );
    expect(updateField).toHaveBeenCalledWith('delegateAllocationMode', 'total');
    expect(updateField).toHaveBeenCalledWith('delegateElectionMode', 'single');
    expect(updateField).toHaveBeenCalledWith('delegatesNominationDeadline', 'changed');

    rerender(
      <EventEditView
        {...base}
        event={{ id: 'event-1', event_type: 'delegate_assembly' }}
        formData={{
          ...completeForm,
          attendanceMode: 'online',
          delegateTotalSeats: '',
          delegateMembersPerSeat: '',
        }}
      />
    );
    expect(container.querySelector('[data-mock-action="coordinates"]')).toBeNull();

    rerender(
      <EventEditView
        {...base}
        event={{ id: 'event-1', event_type: 'meeting' }}
        formData={{ ...completeForm, attendanceMode: 'offline', longitude: null }}
        isSubmitting
      />
    );
    expect(container.textContent).toContain('features.events.editPage.saving');
    expect(container.querySelector('[data-mock-action="visibility"]')).toBeTruthy();

    rerender(
      <EventEditView
        {...base}
        event={null}
        formData={{ ...completeForm, attendanceMode: 'online' }}
        isCreating
      />
    );
    fireEvent.click(container.querySelector('[data-action-id="events.edit.close"]')!);
    expect(navigate).toHaveBeenLastCalledWith({ to: '/create' });
    expect(container.querySelector('[data-mock-action="remove-image"]')).toBeNull();

    rerender(
      <EventEditView
        {...base}
        event={null}
        formData={{ ...completeForm, attendanceMode: 'online' }}
        isCreating
        isSubmitting
      />
    );
    expect(container.textContent).toContain('pages.create.common.creating');
  });
});
