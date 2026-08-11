/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  typeaheadProps: [] as Record<string, any>[],
  fieldProps: [] as Record<string, any>[],
  choiceProps: [] as Record<string, any>[],
  geoProps: [] as Record<string, any>[],
  summaryProps: undefined as Record<string, any> | undefined,
  controllerArgs: [] as Record<string, any>[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: Record<string, any>) => {
    mocks.typeaheadProps.push(props);
    return <div>Typeahead</div>;
  },
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  CreateTypeaheadField: (props: Record<string, any>) => {
    mocks.fieldProps.push(props);
    return <div>Typeahead field</div>;
  },
  TypeSelector: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('vote')}>
      Type selector
    </button>
  ),
  ChoiceCardField: (props: Record<string, any>) => {
    mocks.choiceProps.push(props);
    return (
      <div>
        {props.options?.map((option: any) => (
          <div key={option.value}>{option.content}</div>
        ))}
      </div>
    );
  },
  FormControlInput: (props: any) => <input {...props} />,
  SwitchField: (props: any) => (
    <button type="button" onClick={() => props.onCheckedChange(!props.checked)}>
      Switch
    </button>
  ),
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({
  GeoAddressPicker: (props: Record<string, any>) => {
    mocks.geoProps.push(props);
    return <div>Geo picker</div>;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => <div>Hashtags</div> }));
vi.mock('../inputs/VisibilityInput', () => ({ VisibilityInput: () => <div>Visibility</div> }));
vi.mock('../inputs/ChangeRequestVoteOrderInput', () => ({
  ChangeRequestVoteOrderInput: () => <div>Vote order</div>,
}));
vi.mock('../CreateSummaryStep', () => ({
  CreateSummaryStep: (props: Record<string, any>) => {
    mocks.summaryProps = props;
    return <div>{props.title}</div>;
  },
}));
vi.mock('@/features/network/ui/GroupRelationshipFields', () => ({
  GroupRelationshipRightSentenceList: () => <div>Rights</div>,
}));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  getCanonicalMembershipModeLabel: (mode: string) => `mode:${mode}`,
}));
vi.mock('../inputs/useRoleSearchInputController', () => ({
  useRoleSearchInputController: (args: Record<string, any>) => {
    mocks.controllerArgs.push(args);
    return { ...args, items: [], handleChange: vi.fn() };
  },
}));
vi.mock('../inputs/useEventSearchInputController', () => ({
  useEventSearchInputController: (args: Record<string, any>) => {
    mocks.controllerArgs.push(args);
    return { ...args, items: [], handleChange: vi.fn() };
  },
}));
vi.mock('../../hooks/useElectionSearchInputController', () => ({
  useElectionSearchInputController: (args: Record<string, any>) => {
    mocks.controllerArgs.push(args);
    return { items: [], handleChange: vi.fn() };
  },
}));
vi.mock('../inputs/useAmendmentSearchInputController', () => ({
  useAmendmentSearchInputController: (args: Record<string, any>) => {
    mocks.controllerArgs.push(args);
    return { ...args, items: [], handleChange: vi.fn() };
  },
}));

import { CreateCharacterCountNotice, CreateInlineNotice } from '../CreateInlineNotice';
import { CreateGroupSummaryStep } from '../CreateGroupSummaryStep';
import { AgendaDelegateAssignmentNotice } from '../inputs/AgendaDelegateAssignmentNotice';
import { AgendaDelegateTargetNotice } from '../inputs/AgendaDelegateTargetNotice';
import { EventSearchInputView } from '../inputs/EventSearchInputView';
import { RoleSearchInputView } from '../inputs/RoleSearchInputView';
import { ElectionSearchInputView } from '../inputs/ElectionSearchInputView';
import { AmendmentSearchInputView } from '../inputs/AmendmentSearchInputView';
import { AgendaTypeSelectorInput } from '../inputs/AgendaTypeSelectorInput';
import { RoleSearchInput } from '../inputs/RoleSearchInput';
import { EventSearchInput } from '../inputs/EventSearchInput';
import { ElectionSearchInput } from '../inputs/ElectionSearchInput';
import { AmendmentSearchInput } from '../inputs/AmendmentSearchInput';
import { AgendaTypeInput } from '../inputs/AgendaTypeInput';
import { GroupLocationInput } from '../inputs/GroupLocationInput';
import { AmendmentLocationInput } from '../inputs/AmendmentLocationInput';
import { EventSettingsInput } from '../inputs/EventSettingsInput';
import { DelegateAllocationInput } from '../inputs/DelegateAllocationInput';

const locationValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
  latitude: null,
  longitude: null,
};
const labels = {
  country: 'Country',
  region: 'Region',
  city: 'City',
  post_code: 'Post',
  street: 'Street',
  house_number: 'House',
};

beforeEach(() => {
  mocks.typeaheadProps = [];
  mocks.fieldProps = [];
  mocks.choiceProps = [];
  mocks.geoProps = [];
  mocks.summaryProps = undefined;
  mocks.controllerArgs = [];
});
afterEach(cleanup);

describe('simple create inputs', () => {
  it('renders inline notice and character warning variants', () => {
    const { rerender } = render(<CreateInlineNotice text="Text fallback" />);
    expect(screen.getByText('Text fallback')).toBeTruthy();
    rerender(<CreateInlineNotice text="ignored">Children</CreateInlineNotice>);
    expect(screen.getByText('Children')).toBeTruthy();
    rerender(<CreateCharacterCountNotice text="Warning" isWarning />);
    expect(screen.getByText('Warning').className).toContain('text-destructive');
    rerender(<CreateCharacterCountNotice text="Fine" isWarning={false} />);
    expect(screen.getByText('Fine').className).toContain('text-muted-foreground');
  });

  it('renders optional agenda notice metadata', () => {
    const { rerender } = render(
      <AgendaDelegateAssignmentNotice
        assignmentLabel="Assigned"
        assignmentModeLabel="Ratio"
        seatCount={3}
        seatLabel="seats"
        description="For"
        targetTitle="Council"
      />
    );
    expect(screen.getByText('Ratio')).toBeTruthy();
    rerender(
      <AgendaDelegateAssignmentNotice
        assignmentLabel="Assigned"
        seatCount={3}
        seatLabel="seats"
        description="For"
        targetTitle="Council"
      />
    );
    expect(screen.queryByText('Ratio')).toBeNull();
    rerender(
      <AgendaDelegateTargetNotice
        title="Target"
        descriptionPrefix="To"
        targetTitle="Council"
        descriptionSuffix="now"
        sourceGroupLabel="From "
        sourceGroupName="Group"
      />
    );
    expect(screen.getByText('Group')).toBeTruthy();
    rerender(
      <AgendaDelegateTargetNotice
        title="Target"
        descriptionPrefix="To"
        targetTitle="Council"
        descriptionSuffix="now"
      />
    );
    expect(screen.queryByText('Group')).toBeNull();
  });

  it('renders search view label and value variants', () => {
    const common = {
      value: 'id',
      onChange: vi.fn(),
      label: 'Label',
      placeholder: 'Search',
      items: [],
      handleChange: vi.fn(),
    };
    const { rerender } = render(
      <EventSearchInputView {...(common as any)} filterByGroupId={null} events={[]} />
    );
    rerender(
      <EventSearchInputView {...(common as any)} label="" filterByGroupId={null} events={[]} />
    );
    rerender(<AmendmentSearchInputView {...(common as any)} amendments={[]} />);
    rerender(<AmendmentSearchInputView {...(common as any)} label="" amendments={[]} />);
    rerender(
      <RoleSearchInputView
        {...(common as any)}
        hint="Hint"
        groupIds={[]}
        required
        roles={[]}
        filteredRoles={[]}
      />
    );
    rerender(
      <RoleSearchInputView
        {...(common as any)}
        value=""
        hint="Hint"
        groupIds={[]}
        required
        roles={[]}
        filteredRoles={[]}
      />
    );
    rerender(<ElectionSearchInputView items={[]} value="id" onChange={vi.fn()} />);
    rerender(<ElectionSearchInputView items={[]} value="" onChange={vi.fn()} />);
    expect(mocks.typeaheadProps).toHaveLength(4);
    expect(mocks.fieldProps.map(item => item.value)).toEqual(['id', undefined, 'id', undefined]);
  });

  it('renders locked and editable agenda type selectors', () => {
    const onTypeChange = vi.fn();
    const { rerender } = render(
      <AgendaTypeSelectorInput
        delegateAssignment
        type="vote"
        lockedTitle="Locked"
        lockedDescription="Fixed"
        onTypeChange={onTypeChange}
      />
    );
    expect(screen.getByText('Locked')).toBeTruthy();
    rerender(
      <AgendaTypeSelectorInput
        delegateAssignment={false}
        type="vote"
        lockedTitle="Locked"
        lockedDescription="Fixed"
        onTypeChange={onTypeChange}
      />
    );
    fireEvent.click(screen.getByText('Type selector'));
    expect(onTypeChange).toHaveBeenCalledWith('vote');
  });

  it('forwards wrapper defaults and explicit placeholders', () => {
    const wrappers = [
      <RoleSearchInput key="role" value="" onChange={vi.fn()} />,
      <EventSearchInput key="event" value="" onChange={vi.fn()} />,
      <ElectionSearchInput key="election" value="" onChange={vi.fn()} />,
      <AmendmentSearchInput key="amendment" value="" onChange={vi.fn()} />,
    ];
    const { rerender } = render(<>{wrappers}</>);
    expect(mocks.controllerArgs.map(item => item.placeholder)).toEqual([
      'generated.inline.0043_search_for_a_role_8a23a3a3',
      'generated.inline.0042_search_for_an_event_2c0dc7bd',
      undefined,
      'generated.inline.0040_search_for_an_amendment_5231be40',
    ]);
    mocks.controllerArgs = [];
    rerender(
      <>
        <RoleSearchInput value="" onChange={vi.fn()} placeholder="Role" />
        <EventSearchInput value="" onChange={vi.fn()} placeholder="Event" />
        <ElectionSearchInput value="" onChange={vi.fn()} placeholder="Election" />
        <AmendmentSearchInput value="" onChange={vi.fn()} placeholder="Amendment" />
      </>
    );
    expect(mocks.controllerArgs.map(item => item.placeholder)).toEqual([
      'Role',
      'Event',
      undefined,
      'Amendment',
    ]);
  });

  it('uses default and explicit agenda labels', () => {
    const { rerender } = render(<AgendaTypeInput value="vote" onChange={vi.fn()} />);
    expect(mocks.choiceProps.at(-1)?.label).toBe('Type');
    rerender(<AgendaTypeInput value="vote" onChange={vi.fn()} label="Agenda kind" />);
    expect(mocks.choiceProps.at(-1)?.label).toBe('Agenda kind');
  });

  it.each([
    ['group', GroupLocationInput],
    ['amendment', AmendmentLocationInput],
  ] as const)('projects %s coordinates and field callbacks', (_name, Component) => {
    const onFieldChange = vi.fn();
    const baseProps = {
      hint: 'Hint',
      labels,
      placeholders: labels,
      onFieldChange,
      onCoordinatesChange: vi.fn(),
    };
    const { rerender } = render(<Component {...(baseProps as any)} values={locationValues} />);
    expect(mocks.geoProps.at(-1)?.coordinates).toBeNull();
    rerender(
      <Component
        {...(baseProps as any)}
        values={{ ...locationValues, latitude: 1, longitude: null }}
      />
    );
    expect(mocks.geoProps.at(-1)?.coordinates).toBeNull();
    rerender(
      <Component
        {...(baseProps as any)}
        values={{ ...locationValues, latitude: 1, longitude: 2 }}
      />
    );
    expect(mocks.geoProps.at(-1)?.coordinates).toEqual({ latitude: 1, longitude: 2 });
    mocks.geoProps.at(-1)?.onFieldChange('city', 'Berlin');
    expect(onFieldChange).toHaveBeenCalledWith('city', 'Berlin');
  });

  it('renders all event settings and optional omissions', () => {
    const quota = vi.fn();
    const common = {
      visibility: 'public',
      hashtags: [],
      hashtagPlaceholder: 'Tags',
      onVisibilityChange: vi.fn(),
      onHashtagsChange: vi.fn(),
    };
    const { rerender } = render(
      <EventSettingsInput
        {...(common as any)}
        showVisibility
        onGenderQuotaEnabledChange={quota}
        onChangeRequestVoteOrderChange={vi.fn()}
      />
    );
    expect(screen.getByText('Visibility')).toBeTruthy();
    fireEvent.click(screen.getByText('Switch'));
    expect(quota).toHaveBeenCalledWith(true);
    expect(screen.getByText('Vote order')).toBeTruthy();
    rerender(<EventSettingsInput {...(common as any)} showVisibility={false} />);
    expect(screen.queryByText('Visibility')).toBeNull();
    expect(screen.queryByText('Switch')).toBeNull();
    expect(screen.queryByText('Vote order')).toBeNull();
  });

  it('updates ratio and total delegate allocations with numeric fallbacks', () => {
    const onChange = vi.fn();
    const { rerender, container } = render(
      <DelegateAllocationInput
        value={{ allocationMode: 'ratio', totalDelegates: 10, delegateRatio: 2 }}
        onChange={onChange}
      />
    );
    let input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ delegateRatio: 5 }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ delegateRatio: 1 }));
    mocks.choiceProps.at(-1)?.onValueChange('total');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ allocationMode: 'total' }));
    rerender(
      <DelegateAllocationInput
        value={{ allocationMode: 'total', totalDelegates: 10, delegateRatio: 2 }}
        onChange={onChange}
      />
    );
    input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ totalDelegates: 7 }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ totalDelegates: 1 }));
  });

  it('builds group summaries with linked, empty, rights, and filtered sections', () => {
    const common = {
      badge: 'Group',
      secondaryBadge: 'Review',
      title: 'Summary',
      groupLinksTitle: 'Links',
      currentGroupName: 'Current',
      currentGroupId: 'current',
    };
    const linked = [
      {
        id: 'linked',
        groupName: 'Linked',
        relationshipLabel: 'Parent',
        membershipMode: 'auto',
        rights: ['vote'],
        rightDirections: {},
      },
      {
        id: 'plain',
        groupName: 'Plain',
        relationshipLabel: 'Child',
        membershipMode: 'manual',
        rights: [],
        rightDirections: {},
      },
    ];
    const { rerender } = render(
      <CreateGroupSummaryStep
        {...(common as any)}
        sections={[{ title: 'Base' }, {}]}
        linkedGroupReviewData={linked}
      />
    );
    expect(mocks.summaryProps?.sections).toHaveLength(2);
    render(mocks.summaryProps?.sections[1].content);
    expect(screen.getByText('Rights')).toBeTruthy();
    rerender(
      <CreateGroupSummaryStep
        {...(common as any)}
        groupLinksTitle=""
        sections={[{ fields: ['one'] }, { content: <span>Content</span> }, {}]}
        linkedGroupReviewData={[]}
      />
    );
    expect(mocks.summaryProps?.sections).toHaveLength(2);
  });
});
