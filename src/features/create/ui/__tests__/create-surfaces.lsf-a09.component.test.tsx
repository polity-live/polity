/* @vitest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calendarProps: [] as any[],
  inputFieldProps: [] as any[],
  segmentedProps: [] as any[],
  choiceProps: [] as any[],
  dashboardProps: undefined as any,
  carouselProps: undefined as any,
  richTextProps: undefined as any,
  relationshipsProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FieldGrid: ({ children }: any) => <div>{children}</div>,
  FieldList: ({ children }: any) => <div>{children}</div>,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  FormControlInput: (props: any) => <input {...props} />,
  CreateInputField: (props: any) => {
    mocks.inputFieldProps.push(props);
    return <div data-input-label={props.label} />;
  },
  SegmentedChoiceField: (props: any) => {
    mocks.segmentedProps.push(props);
    return <div />;
  },
  ChoiceCardField: (props: any) => {
    mocks.choiceProps.push(props);
    return <div />;
  },
  FileUploadTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form/MiniPlateEditor', () => ({
  MiniPlateEditor: (props: any) => {
    mocks.richTextProps = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: (props: any) => {
    mocks.calendarProps.push(props);
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({ GeoAddressPicker: () => <div /> }));
vi.mock('../CarouselFormLayoutView', () => ({
  CarouselFormLayoutView: (props: any) => {
    mocks.carouselProps = props;
    return <div />;
  },
}));
vi.mock('../../hooks/useCarouselFormLayoutController', () => ({
  useCarouselFormLayoutController: () => ({ canGoNext: true }),
}));
vi.mock('../CreateDashboardView', () => ({
  CreateDashboardView: (props: any) => {
    mocks.dashboardProps = props;
    return <div />;
  },
}));
vi.mock('../CreateTextDescriptorField', () => ({ CreateTextDescriptorField: () => <div /> }));
vi.mock('../CreateTypeaheadDescriptorField', () => ({
  CreateTypeaheadDescriptorField: () => <div />,
}));
vi.mock('../../ui/inputs/DelegateAllocationInput', () => ({
  DelegateAllocationInput: () => <div />,
}));
vi.mock('@/features/elections/ui/ElectionModeInput', () => ({ ElectionModeInput: () => <div /> }));
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({ MediaUpload: () => <div /> }));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => <div /> }));
vi.mock('../inputs/VisibilityInput', () => ({ VisibilityInput: () => <div /> }));
vi.mock('../../hooks/useGroupRelationshipsInputController', () => ({
  useGroupRelationshipsInputController: () => ({
    groupItems: [],
    selectedGroupId: '',
    relationshipType: 'isParent',
    selectedRights: [],
    rightKeys: [],
    handleGroupChange: vi.fn(),
    setRelationshipType: vi.fn(),
    toggleRight: vi.fn(),
    handleAdd: vi.fn(),
    handleRemove: vi.fn(),
  }),
}));
vi.mock('../inputs/GroupRelationshipsInputView', () => ({
  GroupRelationshipsInputView: (props: any) => {
    mocks.relationshipsProps = props;
    return <div />;
  },
}));
vi.mock('../inputs/UserSearchInput', () => ({ UserSearchInput: () => <div /> }));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    if (props.data[0]) props.getRowId(props.data[0]);
    return <div />;
  },
}));
vi.mock('@/features/shared/ui/ui/accordion', () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <button>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

import { CarouselFormLayout } from '../CarouselFormLayout';
import { CreateDashboard } from '../CreateDashboard';
import { CreateStepRendererView } from '../CreateStepRendererView';
import { AgendaDelegateSeatNotice } from '../inputs/AgendaDelegateSeatNotice';
import { CreateRichTextField } from '../inputs/CreateRichTextField';
import { DateTimeRangeInput } from '../inputs/DateTimeRangeInput';
import { DeadlinesInput } from '../inputs/DeadlinesInput';
import { DirectionInput } from '../inputs/DirectionInput';
import { EventDelegateAllocationSettingsInput } from '../inputs/EventDelegateAllocationSettingsInput';
import { EventLocationInput } from '../inputs/EventLocationInput';
import { EventTypeInput } from '../inputs/EventTypeInput';
import { GroupInvitePeopleInput } from '../inputs/GroupInvitePeopleInput';
import { GroupMediaSettingsInput } from '../inputs/GroupMediaSettingsInput';
import { GroupRelationshipsInput } from '../inputs/GroupRelationshipsInput';
import { PriorityInput } from '../inputs/PriorityInput';

beforeEach(() => {
  mocks.calendarProps.length = 0;
  mocks.inputFieldProps.length = 0;
  mocks.segmentedProps.length = 0;
  mocks.choiceProps.length = 0;
});

it('renders create layout wrappers and basic inputs', () => {
  render(
    <CarouselFormLayout
      steps={[]}
      currentStep={0}
      onStepChange={vi.fn()}
      onSubmit={vi.fn()}
      isSubmitting={false}
    />
  );
  expect(mocks.carouselProps.canGoNext).toBe(true);
  render(<CreateDashboard />);
  expect(mocks.dashboardProps.sections).toHaveLength(3);
  render(
    <CreateStepRendererView
      step={{
        label: 'Step',
        isValid: () => true,
        fields: [{ key: 'custom', kind: 'custom', node: <span>Custom</span> }],
      }}
    />
  );
  render(
    <CreateStepRendererView
      step={{
        label: 'Section step',
        isValid: () => true,
        sections: [
          {
            key: 'section',
            fields: [{ key: 'section-custom', kind: 'custom', node: <span>Section</span> }],
          },
        ],
      }}
    />
  );
  render(<AgendaDelegateSeatNotice prefix="P" seatCount={2} seatLabel="seats" suffix="S" />);
  const onRichChange = vi.fn();
  render(
    <CreateRichTextField
      label="Rich"
      description="Description"
      value={[]}
      onChange={onRichChange}
    />
  );
  mocks.richTextProps.onChange([]);
  render(<DirectionInput value="income" onChange={vi.fn()} />);
  render(
    <EventDelegateAllocationSettingsInput
      delegateConfig={{} as never}
      delegateElectionMode="single"
      electionModeLabel="Mode"
      electionModeHint="Hint"
      electionModeDescriptions={{ list: 'List', single: 'Single' }}
      onDelegateConfigChange={vi.fn()}
      onDelegateElectionModeChange={vi.fn()}
    />
  );
  render(<EventTypeInput value="open" onChange={vi.fn()} />);
  render(
    <GroupMediaSettingsInput
      imageURL=""
      videoURL=""
      groupId="group"
      imageLabel="Image"
      imageDescription="Description"
      visibility="public"
      hashtags={[]}
      hashtagPlaceholder="Tags"
      onImageChange={vi.fn()}
      onVideoChange={vi.fn()}
      onVisibilityChange={vi.fn()}
      onHashtagsChange={vi.fn()}
    />
  );
  render(<GroupRelationshipsInput value={[]} onChange={vi.fn()} />);
  render(<PriorityInput value="medium" onChange={vi.fn()} />);
  expect(mocks.relationshipsProps.value).toEqual([]);
  expect(mocks.segmentedProps).toHaveLength(2);
  expect(mocks.choiceProps[0].options).toHaveLength(5);
});

it('executes every date-time and deadline change handler', () => {
  const onChange = vi.fn();
  const view = render(
    <DateTimeRangeInput
      startDate="2026-08-09"
      startTime="10:00"
      endDate="2026-08-10"
      endTime="11:00"
      minDate="2026-08-08"
      maxDate="2026-08-11"
      onChange={onChange}
    />
  );
  fireEvent.click(
    view.container.querySelector('[data-action-id="create.date-time.start-date.clear"]')!
  );
  fireEvent.click(
    view.container.querySelector('[data-action-id="create.date-time.end-date.clear"]')!
  );
  mocks.calendarProps[0].onSelect(new Date(2026, 7, 9));
  mocks.calendarProps[1].onSelect(new Date(2026, 7, 10));
  mocks.inputFieldProps.find(props => props.type === 'time').onValueChange('12:00');
  mocks.inputFieldProps.filter(props => props.type === 'time')[1].onValueChange('13:00');

  const deadlines = render(
    <DeadlinesInput
      delegateNomination={{ date: '', time: '' }}
      proposalSubmission={{ date: '', time: '' }}
      amendmentCutoff={{ date: '', time: '' }}
      onChange={onChange}
    />
  );
  deadlines.container
    .querySelectorAll('input')
    .forEach((input, index) =>
      fireEvent.change(input, { target: { value: index % 2 ? '12:00' : '2026-08-09' } })
    );
  expect(onChange).toHaveBeenCalled();
});

it('executes event-location field handlers', () => {
  const onValueChange = vi.fn();
  const values = {
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
  const labels = Object.fromEntries(
    [
      'attendanceMode',
      'online',
      'hybrid',
      'offline',
      'venueName',
      'venueNameHint',
      'venueNamePlaceholder',
      'meetingLink',
      'meetingLinkHint',
      'meetingLinkPlaceholder',
      'streamUrl',
      'streamUrlHint',
      'streamUrlPlaceholder',
      'streamUrlInvalid',
      'capacity',
      'capacityHint',
      'capacityPlaceholder',
      'country',
      'region',
      'city',
      'postCode',
      'street',
      'houseNumber',
    ].map(key => [key, key])
  ) as never;
  render(
    <EventLocationInput
      attendanceMode="hybrid"
      values={values}
      showCapacity
      labels={labels}
      onAttendanceModeChange={vi.fn()}
      onValueChange={onValueChange}
    />
  );
  for (const props of mocks.inputFieldProps) props.onValueChange?.('changed');
  expect(onValueChange).toHaveBeenCalledWith('onlineLink', 'changed');
  expect(onValueChange).toHaveBeenCalledWith('streamUrl', 'changed');
});

it('executes the CSV guide row identity callback', () => {
  render(
    <GroupInvitePeopleInput
      hint="Hint"
      searchLabel="Search"
      searchPlaceholder="Search"
      invitedUserIds={[]}
      onInvitedUserIdsChange={vi.fn()}
      csvGuideTitle="Guide"
      csvGuideDescription="Description"
      csvGuideTrigger="Open"
      csvGuideFootnote="Footnote"
      csvGuideColumns={[]}
      csvGuideRows={[{ firstName: 'Ada', lastName: 'Lovelace' }]}
      csvUploadLabel="Upload"
      csvLabel="CSV"
      onCsvUpload={vi.fn()}
      csvInviteSummary={null}
      csvLabels={{}}
      invitedCountLabel="invited"
    />
  );
});
