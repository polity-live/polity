/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  calendars: [] as Record<string, any>[],
  typeahead: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children }: { children: any }) => <label>{children}</label>,
  FileUploadTrigger: ({ children }: { children: any }) => <button type="button">{children}</button>,
  CreateInputField: (props: Record<string, any>) => <input aria-label={props.label} />,
  CreateTypeaheadField: (props: Record<string, any>) => {
    captured.typeahead = props;
    return <div data-testid="create-typeahead" />;
  },
}));
vi.mock('@/features/shared/ui/ui/calendar', () => ({
  Calendar: (props: Record<string, any>) => {
    captured.calendars.push(props);
    return <div data-testid="calendar" />;
  },
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: any }) => <span>{children}</span>,
  RightBadge: ({ right }: { right: string }) => <span>{right}</span>,
  RIGHT_GRADIENTS: { informationRight: 'right-gradient' },
  getRelationshipBadgeClassName: (type: string) => `relationship-${type}`,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild: _asChild, loading: _loading, ...props }: Record<string, any>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: any }) => <div>{children}</div>,
  CardContent: ({ children }: { children: any }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: any }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: any }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: any }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/accordion', () => ({
  Accordion: ({ children }: { children: any }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: any }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: any }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: any }) => <button type="button">{children}</button>,
}));
vi.mock('@/features/shared/ui/data-table', () => ({ DataTable: () => <div /> }));
vi.mock('../UserSearchInput', () => ({ UserSearchInput: () => <div /> }));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: () => <div />,
}));
vi.mock('@/features/network/ui/GroupConnectionComposer', () => ({
  GroupConnectionComposer: () => <div />,
}));
vi.mock('@/features/network/ui/GroupRelationshipFields', () => ({
  getCurrentGroupRelationshipLabel: ({ relationshipType }: { relationshipType: string }) =>
    `label-${relationshipType}`,
  GroupRelationshipRightSentenceList: () => <div />,
}));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  getCanonicalMembershipModeLabel: (mode: string) => mode,
  getSiblingMembershipKind: (mode: string) => (mode === 'sibling-valid' ? 'shared' : null),
}));

import { DateTimeRangeInput } from '../DateTimeRangeInput';
import { GroupConnectionsInput } from '../GroupConnectionsInput';
import { GroupInvitePeopleInput } from '../GroupInvitePeopleInput';
import { GroupRelationshipsInputView } from '../GroupRelationshipsInputView';
import { UserSearchInputView } from '../UserSearchInputView';

beforeEach(() => {
  captured.calendars = [];
  captured.typeahead = undefined;
});
afterEach(cleanup);

const inviteProps = {
  hint: 'Hint',
  searchLabel: 'Search',
  searchPlaceholder: 'Search',
  invitedUserIds: ['user-1'],
  onInvitedUserIdsChange: vi.fn(),
  csvGuideTitle: 'Guide',
  csvGuideDescription: 'Description',
  csvGuideTrigger: 'Format',
  csvGuideFootnote: 'Footnote',
  csvGuideColumns: [],
  csvGuideRows: [],
  csvUploadLabel: 'Upload',
  csvLabel: 'CSV',
  onCsvUpload: vi.fn(),
  invitedCountLabel: 'invited',
  csvLabels: {
    summaryTitle: 'Summary',
    summaryDescription: 'Description',
    foundCount: '1 found',
    notFoundCount: '1 missing',
    ambiguousCount: '1 ambiguous',
    foundNames: 'Found',
    notFoundNames: 'Missing',
    ambiguousNames: 'Ambiguous',
    invalidRows: 'Invalid',
  },
};

describe('remaining create input branches', () => {
  it('renders populated and empty CSV summary groups plus invited counts', () => {
    const { rerender } = render(
      <GroupInvitePeopleInput
        {...inviteProps}
        csvInviteSummary={{
          matchedNames: ['Ada'],
          notFoundNames: ['Nobody'],
          ambiguousNames: [{ fullName: 'Alex Kim', candidatesLabel: 'Two users' }],
          invalidRows: ['Row 4'],
        }}
      />
    );
    expect(screen.getByText('Alex Kim')).toBeTruthy();
    expect(screen.getByText('1 invited')).toBeTruthy();

    rerender(
      <GroupInvitePeopleInput
        {...inviteProps}
        invitedUserIds={[]}
        csvInviteSummary={{
          matchedNames: [],
          notFoundNames: [],
          ambiguousNames: [],
          invalidRows: [],
        }}
      />
    );
    expect(screen.queryByText('1 invited')).toBeNull();
  });

  it('renders inactive and active relationship controls and child links', () => {
    const props = {
      value: [
        { groupId: 'child', groupName: 'Child', relationshipType: 'isChild', rights: [] },
      ] as any,
      groupItems: [],
      selectedGroupId: 'child',
      relationshipType: 'isChild' as const,
      selectedRights: new Set<any>(),
      rightKeys: ['informationRight'] as any,
      onGroupChange: vi.fn(),
      onRelationshipTypeChange: vi.fn(),
      onToggleRight: vi.fn(),
      onAdd: vi.fn(),
      onRemove: vi.fn(),
    };
    const { rerender } = render(<GroupRelationshipsInputView {...props} />);
    expect(screen.getByText('pages.create.group.child')).toBeTruthy();
    expect(screen.queryByText('pages.create.group.addGroupLink')).toBeTruthy();
    rerender(
      <GroupRelationshipsInputView
        {...props}
        value={[]}
        selectedGroupId=""
        relationshipType="isParent"
      />
    );
    expect(screen.queryByText('pages.create.group.addGroupLink')).toBeNull();
  });

  it('renders loading and all non-parent connection relationship variants', () => {
    render(
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
        existingRightStatuses={{}}
        preflight={{ isLoading: true }}
        groupSelectorLabel="Group"
        linkedGroups={[
          {
            type: 'child',
            groupId: 'child',
            groupName: 'Child',
            membershipMode: 'all',
            rightDirections: {},
          },
          {
            type: 'sibling',
            groupId: 's1',
            groupName: 'Sibling one',
            membershipMode: 'sibling-valid',
            rightDirections: {},
          },
          {
            type: 'sibling',
            groupId: 's2',
            groupName: 'Sibling two',
            membershipMode: 'unknown',
            rightDirections: {},
          },
        ]}
        addDisabled={false}
        onActiveTabChange={vi.fn()}
        onValueChange={vi.fn()}
        onAdd={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
        getSelectedRights={() => []}
        t={(key: string) => key}
      />
    );
    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.getByText('pages.create.group.child')).toBeTruthy();
    expect(screen.getAllByText('common.network.sibling')).toHaveLength(2);
  });

  it('checks both scheduling boundaries and start-date ordering', () => {
    render(
      <DateTimeRangeInput
        startDate="2026-08-10"
        startTime="10:00"
        endDate="2026-08-11"
        endTime="11:00"
        minDate="2026-08-09"
        maxDate="2026-08-12"
        onChange={vi.fn()}
      />
    );
    const startDisabled = captured.calendars[0].disabled;
    const endDisabled = captured.calendars[1].disabled;
    expect(startDisabled(new Date(2026, 7, 8))).toBe(true);
    expect(startDisabled(new Date(2026, 7, 13))).toBe(true);
    expect(startDisabled(new Date(2026, 7, 10))).toBe(false);
    expect(endDisabled(new Date(2026, 7, 8))).toBe(true);
    expect(endDisabled(new Date(2026, 7, 9))).toBe(true);
    expect(endDisabled(new Date(2026, 7, 11))).toBe(false);

    cleanup();
    captured.calendars = [];
    render(<DateTimeRangeInput startDate="" startTime="" onChange={vi.fn()} />);
    expect(captured.calendars[1].disabled(new Date(2026, 7, 11))).toBe(false);
  });

  it('adapts multi and single user selections including clearing', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <UserSearchInputView items={[]} value={['one']} onChange={onChange} />
    );
    expect(captured.typeahead?.multiple).toBe(true);
    rerender(<UserSearchInputView items={[]} value={[]} onChange={onChange} multi={false} />);
    expect(captured.typeahead?.value).toBeUndefined();
    captured.typeahead?.onChange({ id: 'two' });
    captured.typeahead?.onChange(null);
    expect(onChange.mock.calls.slice(-2)).toEqual([[['two']], [[]]]);
  });
});
