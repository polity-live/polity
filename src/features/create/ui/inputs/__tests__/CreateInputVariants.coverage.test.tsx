/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fields: [] as Record<string, any>[],
  geo: undefined as Record<string, any> | undefined,
  choice: undefined as Record<string, any> | undefined,
  segmented: undefined as Record<string, any> | undefined,
  calendar: undefined as Record<string, any> | undefined,
  toggle: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  CreateInputField: (props: Record<string, any>) => {
    mocks.fields.push(props);
    return <div data-testid="field">{props.label}</div>;
  },
  FormControlInput: (props: any) => <input {...props} />,
  FormControlSwitch: (props: any) => (
    <button
      type="button"
      data-testid="switch"
      onClick={() => props.onCheckedChange(!props.checked)}
    >
      Switch
    </button>
  ),
  ChoiceCardField: (props: Record<string, any>) => {
    mocks.choice = props;
    return <div>Choices</div>;
  },
  SegmentedChoiceField: (props: Record<string, any>) => {
    mocks.segmented = props;
    return <div>Weekdays</div>;
  },
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({
  GeoAddressPicker: (props: Record<string, any>) => {
    mocks.geo = props;
    return <div>Geo</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: (props: Record<string, any>) => {
    mocks.calendar = props;
    return <div>Calendar</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterToggleGroupItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: (props: Record<string, any>) => {
    mocks.toggle = props;
    return <div>{props.children}</div>;
  },
}));

import { EventLocationInput } from '../EventLocationInput';
import { RecurringPatternInput } from '../RecurringPatternInput';
import { EventMeetingSettingsInput } from '../EventMeetingSettingsInput';
import { LocationTypeInput } from '../LocationTypeInput';
import { StatementSurveyInput } from '../StatementSurveyInput';
import { PaymentEntityTypeInput } from '../PaymentEntityTypeInput';
import { ConstitutionalEventInput } from '../ConstitutionalEventInput';
import { ConstitutionalEventToggleInput } from '../ConstitutionalEventToggleInput';
import { ChangeRequestVoteOrderInput } from '../ChangeRequestVoteOrderInput';

beforeEach(() => {
  mocks.fields = [];
  mocks.geo = undefined;
  mocks.choice = undefined;
  mocks.segmented = undefined;
  mocks.calendar = undefined;
  mocks.toggle = undefined;
});
afterEach(cleanup);

const locationLabels = {
  attendanceMode: 'Mode',
  online: 'Online',
  hybrid: 'Hybrid',
  offline: 'Offline',
  venueName: 'Venue',
  venueNameHint: 'Venue hint',
  venueNamePlaceholder: 'Venue placeholder',
  meetingLink: 'Link',
  meetingLinkHint: 'Link hint',
  meetingLinkPlaceholder: 'Link placeholder',
  streamUrl: 'Stream',
  streamUrlHint: 'Stream hint',
  streamUrlPlaceholder: 'Stream placeholder',
  streamUrlInvalid: 'Invalid stream',
  capacity: 'Capacity',
  capacityHint: 'Capacity hint',
  capacityPlaceholder: 'Capacity placeholder',
  country: 'Country',
  region: 'Region',
  city: 'City',
  postCode: 'Post',
  street: 'Street',
  houseNumber: 'House',
};
const locationValues = {
  locationName: '',
  onlineLink: '',
  streamUrl: '',
  country: '',
  region: '',
  postCode: '',
  city: '',
  street: '',
  houseNumber: '',
  latitude: null,
  longitude: null,
  capacity: '',
};

describe('create input variants', () => {
  it('covers online, hybrid, offline, coordinates, fields, and stream validation', () => {
    const onMode = vi.fn();
    const onValue = vi.fn();
    const common = {
      values: locationValues,
      labels: locationLabels,
      onAttendanceModeChange: onMode,
      onValueChange: onValue,
    };
    const { rerender, container } = render(
      <EventLocationInput {...common} attendanceMode="online" showCapacity={false} />
    );
    expect(screen.queryByText('Venue')).toBeNull();
    expect(screen.getByText('Link')).toBeTruthy();
    for (const button of container.querySelectorAll(
      '[data-action-id="create.event-location.attendance.select"]'
    ))
      fireEvent.click(button);
    expect(onMode.mock.calls.map(call => call[0])).toEqual(['online', 'hybrid', 'offline']);
    const stream = mocks.fields.find(field => field.label === 'Stream')!;
    expect(stream.validator('')).toBeNull();
    expect(stream.validator('https://youtube.com/watch?v=abc')).toBeNull();
    expect(stream.validator('bad url')).toBe('Invalid stream');
    rerender(
      <EventLocationInput
        {...common}
        attendanceMode="hybrid"
        showCapacity
        values={{ ...locationValues, latitude: 1, longitude: 2 }}
      />
    );
    expect(mocks.geo?.coordinates).toEqual({ latitude: 1, longitude: 2 });
    mocks.geo?.onCoordinatesChange({ latitude: 3, longitude: 4 });
    mocks.geo?.onCoordinatesChange(null);
    mocks.geo?.onFieldChange('post_code', '10115');
    mocks.fields.find(field => field.label === 'Venue')?.onValueChange('Hall');
    mocks.fields.find(field => field.label === 'Capacity')?.onValueChange('10');
    expect(onValue).toHaveBeenCalledWith('latitude', 3);
    expect(onValue).toHaveBeenCalledWith('longitude', null);
    expect(onValue).toHaveBeenCalledWith('postCode', '10115');
    rerender(
      <EventLocationInput
        {...common}
        attendanceMode="offline"
        showCapacity={false}
        values={{ ...locationValues, latitude: 1, longitude: null }}
      />
    );
    expect(mocks.geo?.coordinates).toBeNull();
    expect(screen.queryByText('Link')).toBeNull();
  });

  it('covers recurring options, intervals, weekdays, and end dates', () => {
    const onChange = vi.fn();
    const onInterval = vi.fn();
    const onWeekdays = vi.fn();
    const onEnd = vi.fn();
    const { rerender, container } = render(
      <RecurringPatternInput value="none" onChange={onChange} />
    );
    expect(screen.queryByText('Weekdays')).toBeNull();
    expect(mocks.choice?.options).toHaveLength(6);
    mocks.choice?.onValueChange('daily');
    expect(onChange).toHaveBeenCalledWith('daily');
    rerender(
      <RecurringPatternInput
        value="weekly"
        onChange={onChange}
        interval={2}
        onIntervalChange={onInterval}
        weekdays={[1]}
        onWeekdaysChange={onWeekdays}
        endDate="2026-08-10"
        onEndDateChange={onEnd}
        allowedPatterns={['none', 'weekly']}
      />
    );
    expect(mocks.choice?.options).toHaveLength(2);
    expect(screen.getByText('Weekdays')).toBeTruthy();
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(onInterval).toHaveBeenCalledWith(3);
    expect(onInterval).toHaveBeenCalledWith(1);
    expect(mocks.segmented?.isOptionSelected({ value: '1' })).toBe(true);
    expect(mocks.segmented?.isOptionSelected({ value: '2' })).toBe(false);
    mocks.segmented?.onValueChange('1');
    mocks.segmented?.onValueChange('2');
    expect(onWeekdays).toHaveBeenNthCalledWith(1, []);
    expect(onWeekdays).toHaveBeenNthCalledWith(2, [1, 2]);
    fireEvent.click(container.querySelector('[data-action-id="create.recurring.end-date.clear"]')!);
    mocks.calendar?.onSelect(new Date(2026, 7, 11));
    expect(onEnd).toHaveBeenCalledWith('');
    expect(onEnd).toHaveBeenCalledWith('2026-08-11');
    rerender(<RecurringPatternInput value="daily" onChange={onChange} onEndDateChange={onEnd} />);
    expect(
      container.querySelector('[data-action-id="create.recurring.end-date.clear"]')
    ).toBeNull();
  });

  it('covers both meeting types and callbacks', () => {
    const onType = vi.fn();
    const onMax = vi.fn();
    const labels = {
      format: 'Format',
      oneOnOne: 'One',
      publicMeeting: 'Public',
      oneOnOneDescription: 'One desc',
      publicMeetingDescription: 'Public desc',
      oneOnOneLimit: 'One limit',
      bookingLimit: 'Limit',
      bookingLimitHint: 'Hint',
      bookingLimitPlaceholder: 'Placeholder',
    };
    const { rerender, container } = render(
      <EventMeetingSettingsInput
        meetingType="one-on-one"
        meetingMaxBookings=""
        labels={labels}
        onMeetingTypeChange={onType}
        onMeetingMaxBookingsChange={onMax}
      />
    );
    expect(screen.getByText('One desc')).toBeTruthy();
    expect(screen.getByText('One limit')).toBeTruthy();
    fireEvent.click(
      container.querySelector('[data-action-id="create.event-meeting.select.one-on-one"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="create.event-meeting.select.public"]')!
    );
    expect(onType).toHaveBeenCalledWith('one-on-one');
    expect(onType).toHaveBeenCalledWith('public-meeting');
    rerender(
      <EventMeetingSettingsInput
        meetingType="public-meeting"
        meetingMaxBookings="5"
        labels={labels}
        onMeetingTypeChange={onType}
        onMeetingMaxBookingsChange={onMax}
      />
    );
    expect(screen.getByText('Public desc')).toBeTruthy();
    mocks.fields.at(-1)?.onValueChange('6');
    expect(onMax).toHaveBeenCalledWith('6');
  });

  it('covers empty, online, and physical location types and field updates', () => {
    const onChange = vi.fn();
    const value = {
      locationType: '' as const,
      onlineMeetingLink: '',
      meetingCode: '',
      locationName: '',
      country: '',
      region: '',
      street: '',
      houseNumber: '',
      postalCode: '',
      city: '',
    };
    const { rerender, container } = render(<LocationTypeInput value={value} onChange={onChange} />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    fireEvent.click(
      container.querySelector('[data-action-id="create.location-type.select.online"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="create.location-type.select.physical"]')!
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locationType: 'online' }));
    rerender(
      <LocationTypeInput value={{ ...value, locationType: 'online' }} onChange={onChange} />
    );
    for (const input of container.querySelectorAll('input'))
      fireEvent.change(input, { target: { value: 'updated' } });
    rerender(
      <LocationTypeInput value={{ ...value, locationType: 'physical' }} onChange={onChange} />
    );
    expect(container.querySelectorAll('input')).toHaveLength(7);
    for (const input of container.querySelectorAll('input'))
      fireEvent.change(input, { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ city: 'updated' }));
  });

  it('covers survey option limits, editing, addition, and duration fallback', () => {
    const onOptions = vi.fn();
    const onDuration = vi.fn();
    const common = {
      title: 'Survey',
      questionLabel: 'Question',
      optionLabel: 'Option',
      durationLabel: 'Duration',
      addOptionLabel: 'Add',
      surveyQuestion: '',
      onSurveyQuestionChange: vi.fn(),
      onSurveyOptionsChange: onOptions,
      surveyDurationHours: 24,
      onSurveyDurationHoursChange: onDuration,
    };
    const { rerender, container } = render(
      <StatementSurveyInput {...common} surveyOptions={['A']} />
    );
    mocks.fields.find(field => field.label === 'Option 1')?.onValueChange('B');
    fireEvent.click(
      container.querySelector('[data-action-id="create.statement-survey.option.add"]')!
    );
    expect(onOptions).toHaveBeenCalledWith(['B']);
    expect(onOptions).toHaveBeenCalledWith(['A', '']);
    const duration = mocks.fields.find(field => field.label === 'Duration')!;
    duration.onValueChange('12');
    duration.onValueChange('');
    expect(onDuration).toHaveBeenCalledWith(12);
    expect(onDuration).toHaveBeenCalledWith(1);
    rerender(<StatementSurveyInput {...common} surveyOptions={['A', 'B', 'C', 'D']} />);
    expect(
      container.querySelector('[data-action-id="create.statement-survey.option.add"]')
    ).toBeNull();
  });

  it('covers payment entity variants and clearing', () => {
    const onType = vi.fn();
    const clearUser = vi.fn();
    const clearGroup = vi.fn();
    const { rerender, container } = render(
      <PaymentEntityTypeInput
        label="Pay"
        userLabel="User"
        groupLabel="Group"
        entityType="user"
        onEntityTypeChange={onType}
        onClearUser={clearUser}
        onClearGroup={clearGroup}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="create.payment-entity.select.user"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="create.payment-entity.select.group"]')!
    );
    expect(onType).toHaveBeenCalledWith('user');
    expect(onType).toHaveBeenCalledWith('group');
    expect(clearGroup).toHaveBeenCalled();
    expect(clearUser).toHaveBeenCalled();
    rerender(
      <PaymentEntityTypeInput
        label="Pay"
        userLabel="User"
        groupLabel="Group"
        entityType="group"
        onEntityTypeChange={onType}
        onClearUser={clearUser}
        onClearGroup={clearGroup}
      />
    );
  });

  it('covers disabled and enabled constitutional event details and toggle notice', () => {
    const onChange = vi.fn();
    const value = {
      enabled: false,
      eventName: '',
      eventLocation: '',
      eventStartDate: '',
      eventStartTime: '',
    };
    const { rerender, container } = render(
      <ConstitutionalEventInput value={value} onChange={onChange} />
    );
    expect(container.querySelectorAll('input')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('switch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    rerender(<ConstitutionalEventInput value={{ ...value, enabled: true }} onChange={onChange} />);
    for (const input of container.querySelectorAll('input')) {
      const nextValue =
        input.type === 'date' ? '2026-08-10' : input.type === 'time' ? '10:00' : 'updated';
      fireEvent.change(input, { target: { value: nextValue } });
    }
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ eventStartTime: '10:00' }));
    rerender(
      <ConstitutionalEventToggleInput
        hint="Hint"
        label="Label"
        description="Description"
        checked
        onCheckedChange={vi.fn()}
      />
    );
    expect(screen.getByText('Description')).toBeTruthy();
    rerender(
      <ConstitutionalEventToggleInput
        hint="Hint"
        label="Label"
        description="Description"
        checked={false}
        onCheckedChange={vi.fn()}
      />
    );
    expect(screen.queryByText('Description')).toBeNull();
  });

  it('covers default, null, empty, and valid change-request ordering', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChangeRequestVoteOrderInput onChange={onChange} />);
    mocks.toggle?.onValueChange('');
    expect(onChange).not.toHaveBeenCalled();
    mocks.toggle?.onValueChange('cr_number');
    expect(onChange).toHaveBeenCalledWith('cr_number');
    rerender(<ChangeRequestVoteOrderInput value={null} onChange={onChange} className="custom" />);
    expect(mocks.toggle?.value).toBeTruthy();
  });
});
