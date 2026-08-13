/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgendaMajorityTypeInput } from '../AgendaMajorityTypeInput';
import { AmendmentEvaluationModeInput } from '../AmendmentEvaluationModeInput';
import { ChangeRequestVoteOrderInput } from '../ChangeRequestVoteOrderInput';
import { ConstitutionalEventInput } from '../ConstitutionalEventInput';
import { ConstitutionalEventToggleInput } from '../ConstitutionalEventToggleInput';
import { CurrencyInput } from '../CurrencyInput';
import { DateTimeRangeInput } from '../DateTimeRangeInput';
import { EventLocationInput } from '../EventLocationInput';
import { EventMeetingSettingsInput } from '../EventMeetingSettingsInput';
import { GroupConnectionsInput } from '../GroupConnectionsInput';
import { GroupInvitePeopleInput } from '../GroupInvitePeopleInput';
import { GroupRelationshipsInputView } from '../GroupRelationshipsInputView';
import { GroupTypeInput } from '../GroupTypeInput';
import { LocationTypeInput } from '../LocationTypeInput';
import { PaymentEntityTypeInput } from '../PaymentEntityTypeInput';
import { PaymentTypeInput } from '../PaymentTypeInput';
import { RecurringPatternInput } from '../RecurringPatternInput';
import { StatementStoryToggle } from '../StatementStoryToggle';
import { StatementSurveyInput } from '../StatementSurveyInput';
import { StatusInput } from '../StatusInput';

const toggleState = vi.hoisted(() => ({
  onValueChange: undefined as undefined | ((value: string) => void),
}));

vi.mock('@/features/shared/ui/form', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/form')>();
  const { createContext, useContext } = await import('react');
  const SelectContext = createContext<(value: string) => void>(() => undefined);
  const RadioContext = createContext<(value: string) => void>(() => undefined);
  return {
    ...actual,
    FormControlSelect: ({ children, onValueChange, value: _value, ...props }: any) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({ children, value, ...props }: any) => {
      const onValueChange = useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: any) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => null,
    FormControlSwitch: ({ checked, onCheckedChange, ...props }: any) => (
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onCheckedChange(event.target.checked)}
        {...props}
      />
    ),
    FormControlRadioGroup: ({ children, onValueChange, value: _value }: any) => (
      <RadioContext.Provider value={onValueChange}>{children}</RadioContext.Provider>
    ),
    FormControlRadioGroupItem: ({ value, ...props }: any) => {
      const onValueChange = useContext(RadioContext);
      return <input type="radio" onChange={() => onValueChange(value)} {...props} />;
    },
    FileUploadTrigger: ({
      children,
      inputProps,
      variant: _variant,
      size: _size,
      ...props
    }: any) => (
      <label>
        <span role="button" tabIndex={0} {...props}>
          {children}
        </span>
        <input type="file" {...inputProps} />
      </label>
    ),
  };
});

vi.mock('@/features/shared/ui/form/CurrencySelect', () => ({
  CurrencySelect: ({ onChange, ...props }: any) => (
    <button type="button" onClick={() => onChange('EUR')} {...props}>
      Currency
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: ({ children, onValueChange }: any) => {
    toggleState.onValueChange = onValueChange;
    return <div>{children}</div>;
  },
}));

vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterToggleGroupItem: ({ children, value, ...props }: any) => (
    <button type="button" onClick={() => toggleState.onValueChange?.(value)} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onCheckedChange(event.target.checked)}
      {...props}
    />
  ),
}));

vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({ GeoAddressPicker: () => null }));
vi.mock('@/features/network/ui/GroupConnectionComposer', () => ({
  GroupConnectionComposer: () => null,
}));
vi.mock('@/features/network/ui/GroupRelationshipFields', () => ({
  getCurrentGroupRelationshipLabel: () => 'Relationship',
  GroupRelationshipRightSentenceList: () => null,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: () => null,
}));
vi.mock('@/features/shared/ui/data-table', () => ({ DataTable: () => <div>CSV example</div> }));
vi.mock('../UserSearchInput', () => ({ UserSearchInput: () => null }));
vi.mock('@/features/shared/ui/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const action = (id: string) => document.querySelector(`[data-action-id="${id}"]`) as HTMLElement;
const actions = (id: string) =>
  Array.from(document.querySelectorAll(`[data-action-id="${id}"]`)) as HTMLElement[];

describe('create input action contracts', () => {
  it('dispatches decision-table selections with exact domain values', () => {
    const majorityChange = vi.fn();
    const evaluationChange = vi.fn();
    const orderChange = vi.fn();
    const constitutionalChange = vi.fn();
    const toggleChange = vi.fn();
    const currencyChange = vi.fn();
    const groupTypeChange = vi.fn();
    const paymentTypeChange = vi.fn();
    const storyChange = vi.fn();
    const surveyOptionsChange = vi.fn();
    const statusChange = vi.fn();
    render(
      <>
        <AgendaMajorityTypeInput
          value="simple"
          label="Majority"
          options={{ simple: 'Simple', absolute: 'Absolute', twoThirds: 'Two thirds' }}
          onChange={majorityChange}
        />
        <AmendmentEvaluationModeInput
          label="Evaluation"
          value="none"
          options={[
            { value: 'none', label: 'None' },
            { value: 'fixed_date', label: 'Fixed date' },
          ]}
          onChange={evaluationChange}
        />
        <ChangeRequestVoteOrderInput value="text_position" onChange={orderChange} />
        <ConstitutionalEventInput
          value={{
            enabled: false,
            eventName: '',
            eventLocation: '',
            eventStartDate: '',
            eventStartTime: '',
          }}
          onChange={constitutionalChange}
        />
        <ConstitutionalEventToggleInput
          hint="Hint"
          label="Constitutional event"
          description="Description"
          checked={false}
          onCheckedChange={toggleChange}
        />
        <CurrencyInput value="USD" onChange={currencyChange} />
        <GroupTypeInput
          value="base"
          label="Group type"
          options={{
            base: { label: 'Base', description: 'Base group' },
            hierarchical: { label: 'Hierarchy', description: 'Hierarchy group' },
          }}
          onChange={groupTypeChange}
        />
        <PaymentTypeInput value="membership_fee" onChange={paymentTypeChange} />
        <StatementStoryToggle
          checked={false}
          description="Description"
          label="Story"
          onCheckedChange={storyChange}
        />
        <StatementSurveyInput
          title="Survey"
          questionLabel="Question"
          optionLabel="Option"
          durationLabel="Duration"
          addOptionLabel="Add option"
          surveyQuestion="Question"
          surveyOptions={['Yes', 'No']}
          surveyDurationHours={24}
          onSurveyQuestionChange={vi.fn()}
          onSurveyOptionsChange={surveyOptionsChange}
          onSurveyDurationHoursChange={vi.fn()}
        />
        <StatusInput value="pending" onChange={statusChange} />
      </>
    );

    expect(screen.getByLabelText('Constitutional event').getAttribute('data-action-id')).toBe(
      'create.constitutional-event-toggle.change'
    );

    fireEvent.click(action('create.agenda-majority.option.absolute'));
    fireEvent.click(actions('create.amendment-evaluation.select')[1]);
    for (const id of [
      'create.change-request-order.select.text-position',
      'create.change-request-order.select.changed-character-count',
      'create.change-request-order.select.cr-number',
    ])
      fireEvent.click(action(id));
    fireEvent.click(action('create.constitutional-event.toggle'));
    fireEvent.click(action('create.constitutional-event-toggle.change'));
    fireEvent.click(action('create.currency.select'));
    fireEvent.click(actions('create.group-type.select')[1]);
    fireEvent.click(actions('create.payment-type.option')[1]);
    fireEvent.click(action('create.statement-story.toggle'));
    fireEvent.click(action('create.statement-survey.option.add'));
    fireEvent.click(actions('create.todo-status.select')[2]);

    expect(majorityChange).toHaveBeenCalledWith('absolute');
    expect(evaluationChange).toHaveBeenCalledWith('fixed_date');
    expect(orderChange.mock.calls.map(([value]) => value)).toEqual([
      'text_position',
      'changed_character_count',
      'cr_number',
    ]);
    expect(constitutionalChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(toggleChange).toHaveBeenCalledWith(true);
    expect(currencyChange).toHaveBeenCalledWith('EUR');
    expect(groupTypeChange).toHaveBeenCalledWith('hierarchical');
    expect(paymentTypeChange).toHaveBeenCalledWith('donation');
    expect(storyChange).toHaveBeenCalledWith(true);
    expect(surveyOptionsChange).toHaveBeenCalledWith(['Yes', 'No', '']);
    expect(statusChange).toHaveBeenCalledWith('completed');
    expect(actions('create.agenda-majority.select')).not.toHaveLength(0);
    expect(actions('create.payment-type.select')).not.toHaveLength(0);
  });

  it('dispatches event mode, date clearing, meeting, location, and recurrence effects', () => {
    const dateChange = vi.fn();
    const attendanceChange = vi.fn();
    const meetingChange = vi.fn();
    const locationChange = vi.fn();
    const endDateChange = vi.fn();
    render(
      <>
        <DateTimeRangeInput
          startDate="2026-08-02"
          startTime="10:00"
          endDate="2026-08-02"
          endTime="12:00"
          onChange={dateChange}
        />
        <EventLocationInput
          attendanceMode="hybrid"
          values={{
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
          }}
          showCapacity
          labels={{
            attendanceMode: 'Attendance',
            online: 'Online',
            hybrid: 'Hybrid',
            offline: 'Offline',
            venueName: 'Venue',
            venueNameHint: '',
            venueNamePlaceholder: '',
            meetingLink: 'Link',
            meetingLinkHint: '',
            meetingLinkPlaceholder: '',
            streamUrl: 'Stream',
            streamUrlHint: '',
            streamUrlPlaceholder: '',
            streamUrlInvalid: 'Invalid',
            capacity: 'Capacity',
            capacityHint: '',
            capacityPlaceholder: '',
            country: 'Country',
            region: 'Region',
            city: 'City',
            postCode: 'Post code',
            street: 'Street',
            houseNumber: 'House number',
          }}
          onAttendanceModeChange={attendanceChange}
          onValueChange={vi.fn()}
        />
        <EventMeetingSettingsInput
          meetingType="one-on-one"
          meetingMaxBookings="1"
          labels={{
            format: 'Format',
            oneOnOne: 'One on one',
            publicMeeting: 'Public',
            oneOnOneDescription: '',
            publicMeetingDescription: '',
            oneOnOneLimit: '',
            bookingLimit: 'Limit',
            bookingLimitHint: '',
            bookingLimitPlaceholder: '',
          }}
          onMeetingTypeChange={meetingChange}
          onMeetingMaxBookingsChange={vi.fn()}
        />
        <LocationTypeInput
          value={{
            locationType: '',
            onlineMeetingLink: '',
            meetingCode: '',
            locationName: '',
            country: '',
            region: '',
            street: '',
            houseNumber: '',
            postalCode: '',
            city: '',
          }}
          onChange={locationChange}
        />
        <RecurringPatternInput
          value="weekly"
          onChange={vi.fn()}
          endDate="2026-09-01"
          onEndDateChange={endDateChange}
          weekdays={[1]}
          onWeekdaysChange={vi.fn()}
        />
      </>
    );

    fireEvent.click(action('create.date-time.start-date.clear'));
    fireEvent.click(action('create.date-time.end-date.clear'));
    actions('create.event-location.attendance.select').forEach(element => fireEvent.click(element));
    fireEvent.click(action('create.event-meeting.select.one-on-one'));
    fireEvent.click(action('create.event-meeting.select.public'));
    fireEvent.click(action('create.location-type.select.online'));
    fireEvent.click(action('create.location-type.select.physical'));
    fireEvent.click(action('create.recurring.end-date.clear'));

    expect(dateChange).toHaveBeenCalledWith('startDate', '');
    expect(dateChange).toHaveBeenCalledWith('endDate', '');
    expect(attendanceChange.mock.calls.map(([value]) => value)).toEqual([
      'online',
      'hybrid',
      'offline',
    ]);
    expect(meetingChange.mock.calls.map(([value]) => value)).toEqual([
      'one-on-one',
      'public-meeting',
    ]);
    expect(locationChange).toHaveBeenCalledWith(
      expect.objectContaining({ locationType: 'online' })
    );
    expect(locationChange).toHaveBeenCalledWith(
      expect.objectContaining({ locationType: 'physical' })
    );
    expect(endDateChange).toHaveBeenCalledWith('');
  });

  it('dispatches payment counterpart selection and clearing atomically', () => {
    const onEntityTypeChange = vi.fn();
    const onClearUser = vi.fn();
    const onClearGroup = vi.fn();
    render(
      <PaymentEntityTypeInput
        label="Counterpart"
        userLabel="User"
        groupLabel="Group"
        entityType="user"
        onEntityTypeChange={onEntityTypeChange}
        onClearUser={onClearUser}
        onClearGroup={onClearGroup}
      />
    );
    fireEvent.click(action('create.payment-entity.select.user'));
    fireEvent.click(action('create.payment-entity.select.group'));
    expect(onEntityTypeChange.mock.calls.map(([value]) => value)).toEqual(['user', 'group']);
    expect(onClearGroup).toHaveBeenCalledOnce();
    expect(onClearUser).toHaveBeenCalledOnce();
  });

  it('dispatches group connection, relationship, guide, and CSV upload effects', () => {
    const onAddConnection = vi.fn();
    const onCancelConnection = vi.fn();
    const onRemoveConnection = vi.fn();
    const onCsvUpload = vi.fn();
    const onRelationshipTypeChange = vi.fn();
    const onToggleRight = vi.fn();
    const onAddRelationship = vi.fn();
    const onRemoveRelationship = vi.fn();
    const { container } = render(
      <>
        <GroupConnectionsInput
          label="Connections"
          hint="Hint"
          linkedGroupsLabel="Linked"
          addLabel="Add"
          cancelLabel="Cancel"
          checkingLabel="Checking"
          currentGroupId="current"
          currentGroupName="Current"
          activeTab="preset"
          value={{}}
          availableGroups={[]}
          selectableRolesByDirection={{}}
          existingRightStatuses={new Map()}
          preflight={{ isLoading: false }}
          groupSelectorLabel="Group"
          linkedGroups={[
            {
              type: 'parent',
              groupId: 'group-2',
              groupName: 'Partner',
              membershipMode: 'all_members',
              rightDirections: {},
            },
          ]}
          addDisabled={false}
          onActiveTabChange={vi.fn()}
          onValueChange={vi.fn()}
          onAdd={onAddConnection}
          onCancel={onCancelConnection}
          onRemove={onRemoveConnection}
          getSelectedRights={() => []}
          t={(key: string) => key}
        />
        <GroupInvitePeopleInput
          hint="Hint"
          searchLabel="Search"
          searchPlaceholder="Search"
          invitedUserIds={[]}
          onInvitedUserIdsChange={vi.fn()}
          csvGuideTitle="Guide"
          csvGuideDescription="Description"
          csvGuideTrigger="Show format"
          csvGuideFootnote="Footnote"
          csvGuideColumns={[]}
          csvGuideRows={[]}
          csvUploadLabel="Upload"
          csvLabel="CSV"
          onCsvUpload={onCsvUpload}
          csvInviteSummary={null}
          csvLabels={{}}
          invitedCountLabel="invited"
        />
        <GroupRelationshipsInputView
          value={
            [
              {
                groupId: 'group-3',
                groupName: 'Partner',
                relationshipType: 'isParent',
                rights: ['informationRight'],
              },
            ] as any
          }
          groupItems={[]}
          selectedGroupId="group-3"
          relationshipType="isParent"
          selectedRights={new Set(['informationRight'])}
          rightKeys={['informationRight']}
          onGroupChange={vi.fn()}
          onRelationshipTypeChange={onRelationshipTypeChange}
          onToggleRight={onToggleRight}
          onAdd={onAddRelationship}
          onRemove={onRemoveRelationship}
        />
      </>
    );

    fireEvent.click(action('create.group-connections.add'));
    fireEvent.click(action('create.group-connections.cancel'));
    fireEvent.click(action('create.group-connections.remove'));
    fireEvent.click(action('create.group-invite.csv-guide.toggle'));
    const csvInput = container.querySelector('input[accept=".csv"]') as HTMLInputElement;
    const csv = new File(['firstName,lastName'], 'people.csv', { type: 'text/csv' });
    fireEvent.change(csvInput, { target: { files: [csv] } });
    fireEvent.click(action('create.group-relationships.type.parent'));
    fireEvent.click(action('create.group-relationships.type.child'));
    fireEvent.click(action('create.group-relationships.right.toggle'));
    fireEvent.click(action('create.group-relationships.add'));
    fireEvent.click(action('create.group-relationships.remove'));

    expect(onAddConnection).toHaveBeenCalledOnce();
    expect(onCancelConnection).toHaveBeenCalledOnce();
    expect(onRemoveConnection).toHaveBeenCalledWith('group-2');
    expect(onCsvUpload).toHaveBeenCalledOnce();
    expect(onRelationshipTypeChange.mock.calls.map(([value]) => value)).toEqual([
      'isParent',
      'isChild',
    ]);
    expect(onToggleRight).toHaveBeenCalledWith('informationRight');
    expect(onAddRelationship).toHaveBeenCalledOnce();
    expect(onRemoveRelationship).toHaveBeenCalledWith('group-3');
    expect(action('create.group-invite.csv.upload')).toBeTruthy();
  });
});
