/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  GroupedRelationshipRequest,
  NormalizedGroupRelationship,
} from '../../types/network.types';
import {
  ManageNetworkTabContentView,
  type ManageNetworkTabContentViewProps,
} from '../ManageNetworkTabContentView';

const harness = vi.hoisted(() => ({
  activeSource: null as Record<string, any> | null,
  hierarchyProps: null as Record<string, any> | null,
  overlayProps: null as Record<string, any> | null,
  rejectSubmission: false,
  submissionError: null as unknown,
  submissionStatus: 'idle',
  emptyTranslations: false,
  zeroProps: [] as Record<string, any>[],
  reset: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: Record<string, unknown>) => {
    harness.overlayProps = props;
    return (
      <button data-testid="submission-retry" onClick={props.onRetry as () => void}>
        Retry
      </button>
    );
  },
  useActionSubmission: () => ({
    error: harness.submissionError,
    isActive: false,
    progressSteps: [],
    reset: harness.reset,
    retry: harness.retry,
    runActionWithSubmission: async (
      action: (context: object) => unknown,
      options: { onSuccess?: () => void }
    ) => {
      await action({ completeSuccess: vi.fn() });
      if (harness.rejectSubmission) throw new Error('approval failed');
      options.onSuccess?.();
    },
    status: harness.submissionStatus,
  }),
}));

vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: ({
    columns,
    data,
    getRowId,
  }: {
    columns: { id?: string; cell?: (args: { row: { original: any } }) => ReactNode }[];
    data: any[];
    getRowId?: (row: any, index: number) => string;
  }) => (
    <div data-testid="data-table">
      {data.flatMap((original, rowIndex) => {
        getRowId?.(original, rowIndex);
        return columns.map((column, columnIndex) => (
          <div key={`${rowIndex}-${column.id ?? columnIndex}`}>
            {column.cell?.({ row: { original } })}
          </div>
        ));
      })}
    </div>
  ),
  VirtualDataTable: ({ source }: { source: Record<string, unknown> }) => {
    harness.activeSource = source;
    return <div data-testid="virtual-data-table" />;
  },
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: Record<string, any>) => {
    harness.zeroProps.push(props);
    const id = props.context.direction === 'incoming' ? 'incoming-virtual' : 'outgoing-virtual';
    return (
      <div data-testid={`zero-list-${props.context.direction}`}>
        {props.renderRow({ id, updated_at: 1 })}
        {props.renderRow({ id: 'missing-request', updated_at: 2 })}
        {props.renderSkeleton(0)}
        {props.renderEmpty()}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  DangerConfirmDialog: ({ trigger, onConfirm }: { trigger: ReactNode; onConfirm: () => void }) => (
    <div>
      {trigger}
      <button data-testid="confirm-delete" onClick={onConfirm}>
        Confirm delete
      </button>
    </div>
  ),
}));

vi.mock('@/features/shared/ui/form', () => ({
  ManagementSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  ManagementToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button data-testid="direction-filter" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: ({
    onSearchQueryChange,
    onFilterToggle,
  }: {
    onSearchQueryChange: (value: string) => void;
    onFilterToggle: (value: string) => void;
  }) => (
    <div>
      <button data-testid="search-change" onClick={() => onSearchQueryChange('partner')}>
        Search
      </button>
      <button data-testid="right-filter" onClick={() => onFilterToggle('membership')}>
        Right
      </button>
    </div>
  ),
}));

vi.mock('@/features/shared/ui/status', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    RightBadge: ({ right }: { right: string }) => <span>{right}</span>,
    StatusBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  };
});

vi.mock('../GroupRelationshipFields', () => ({
  GroupRelationshipDirectionSentence: () => <span>Direction sentence</span>,
  GroupRelationshipConnector: () => <span>Connector</span>,
  GroupRelationshipNameTag: ({ name }: { name: string }) => <span>{name}</span>,
  GroupRelationshipTypePreview: () => <span>Type preview</span>,
}));

vi.mock('../LinkGroupDialog', () => ({
  LinkGroupDialog: ({ trigger }: { trigger?: ReactNode }) => <div>{trigger ?? 'Create link'}</div>,
}));

vi.mock('../HierarchyConflictDialog', () => ({
  HierarchyConflictDialog: (props: Record<string, unknown>) => {
    harness.hierarchyProps = props;
    return <div data-testid="hierarchy-dialog" />;
  },
}));

vi.mock('../GroupConnectionStatusCell', () => ({
  GroupConnectionStatusCell: ({ onWarningClick }: { onWarningClick?: () => void }) => (
    <button data-testid="warning" onClick={onWarningClick}>
      Warning
    </button>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (harness.emptyTranslations ? '' : (fallback ?? key)),
  }),
}));

vi.mock('@/features/groups/ui/RoleTag', () => ({
  RoleTag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(() => {
  cleanup();
  harness.activeSource = null;
  harness.hierarchyProps = null;
  harness.overlayProps = null;
  harness.rejectSubmission = false;
  harness.submissionError = null;
  harness.submissionStatus = 'idle';
  harness.emptyTranslations = false;
  harness.zeroProps = [];
  vi.clearAllMocks();
});

function relationship(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    connection_id: 'connection-1',
    grant_id: 'grant-1',
    connection_request_id: `request-${id}`,
    membership_request_id: null,
    request_item_kind: 'right',
    group_id: 'partner-group',
    related_group_id: 'current-group',
    relationship_type: 'parent',
    connection_type: 'hierarchy',
    parent_group_id: 'partner-group',
    child_group_id: 'current-group',
    with_right: 'informationRight',
    status: 'requested',
    initiator_group_id: 'partner-group',
    created_at: 1,
    member_source_group_id: null,
    member_target_group_id: null,
    membership_mode: 'none',
    required_source_role_id: null,
    required_source_role: null,
    eligible_origin_group_ids: [],
    group: {
      id: 'partner-group',
      name: 'Partner Group',
      group_type: 'base',
      sibling_membership_mode: null,
    },
    related_group: {
      id: 'current-group',
      name: 'Current Group',
      group_type: 'base',
      sibling_membership_mode: null,
    },
    ...overrides,
  } as unknown as NormalizedGroupRelationship;
}

function grouped(
  requestId: string,
  rels: NormalizedGroupRelationship[],
  overrides: Record<string, unknown> = {}
) {
  const membershipRels = rels.filter(rel => rel.request_item_kind === 'membership');
  const rightRels = rels.filter(rel => rel.request_item_kind === 'right');
  const structureRel = rels.find(rel => rel.request_item_kind === 'structure') ?? null;
  return {
    group: rels[0].group,
    requestId,
    allRels: rels,
    membershipRels,
    rightRels,
    structureRel,
    rels: [...membershipRels, ...rightRels],
    type: 'parent',
    membershipMode: membershipRels[0]?.membership_mode,
    ...overrides,
  } as unknown as GroupedRelationshipRequest;
}

function props(overrides: Partial<ManageNetworkTabContentViewProps> = {}) {
  return {
    canManageRelationships: true,
    groupId: 'current-group',
    groupName: '',
    currentGroupType: 'base' as const,
    currentGroupSiblingMembershipMode: null,
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    directionFilter: 'all' as const,
    onDirectionFilterChange: vi.fn(),
    manageRightFilter: new Set<string>(),
    onToggleRightFilter: vi.fn(),
    incomingRequests: [],
    outgoingRequests: [],
    filteredRelationships: [],
    allRelationships: [],
    onAcceptRequest: vi.fn().mockResolvedValue(undefined),
    onRejectRequest: vi.fn().mockResolvedValue(undefined),
    onDeleteRelationship: vi.fn(),
    manageDialog: null,
    setManageDialog: vi.fn(),
    canActivateLink: (rel: NormalizedGroupRelationship) => !rel.id.includes('blocked'),
    isLinkCheckApplicable: () => true,
    manageDialogAffectedUsers: [],
    manageDialogPartnerUsers: [],
    manageDialogCanAccept: true,
    ...overrides,
  } satisfies ManageNetworkTabContentViewProps;
}

describe('ManageNetworkTabContentView branch harness', () => {
  it('renders every request row kind and executes management actions', async () => {
    const right = relationship('right', {
      group: {
        id: 'partner-group',
        name: null,
        group_type: 'base',
        sibling_membership_mode: null,
      },
    });
    const invalidRight = relationship('blocked-invalid', {
      group_id: 'foreign-a',
      related_group_id: 'foreign-b',
      with_right: null,
      created_at: null,
      group: { id: 'foreign-a', name: null, group_type: 'base', sibling_membership_mode: null },
      related_group: {
        id: 'foreign-b',
        name: null,
        group_type: 'base',
        sibling_membership_mode: null,
      },
    });
    const roleMembership = relationship('membership-role', {
      request_item_kind: 'membership',
      with_right: null,
      membership_mode: 'role_members',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      group: {
        id: 'partner-group',
        name: null,
        group_type: 'base',
        sibling_membership_mode: null,
      },
      related_group: {
        id: 'current-group',
        name: null,
        group_type: 'base',
        sibling_membership_mode: null,
      },
    });
    const sourceMembership = relationship('blocked-membership-source', {
      request_item_kind: 'membership',
      with_right: null,
      membership_mode: 'selected_source_groups',
      member_source_group_id: 'unknown-group',
      member_target_group_id: null,
    });
    const allMembership = relationship('membership-all', {
      request_item_kind: 'membership',
      with_right: null,
      membership_mode: 'all_members',
      member_source_group_id: 'partner-group',
      member_target_group_id: 'current-group',
      group: {
        id: 'partner-group',
        name: null,
        group_type: 'base',
        sibling_membership_mode: null,
      },
    });
    const structure = relationship('structure', {
      request_item_kind: 'structure',
      with_right: null,
      grant_id: null,
    });

    const incoming = [
      grouped('incoming-right', [right]),
      grouped('incoming-invalid', [invalidRight]),
      grouped('incoming-role', [roleMembership]),
      grouped('incoming-source', [sourceMembership]),
      grouped('incoming-structure', [structure], { rels: [] }),
      grouped(null as never, [right]),
    ];
    const outgoing = [
      grouped('outgoing-all', [allMembership]),
      grouped(null as never, [allMembership]),
    ];
    const active = [
      {
        group: right.group,
        rights: ['informationRight', 'informationRight'],
        type: 'sibling',
        membershipMode: 'role_members',
        requiredSourceRoleId: null,
        requiredSourceRoleName: null,
      },
      {
        group: { ...right.group, id: 'plain-sibling', sibling_membership_mode: null },
        rights: [],
        type: 'sibling',
        membershipMode: undefined,
      },
      {
        group: { ...right.group, id: 'non-sibling', name: null },
        rights: [],
        type: 'parent',
        membershipMode: null,
      },
    ];
    const onRejectRequest = vi.fn().mockResolvedValue(undefined);
    const onDeleteRelationship = vi.fn();
    const setManageDialog = vi.fn();
    const viewProps = props({
      incomingRequests: incoming,
      outgoingRequests: outgoing,
      filteredRelationships: active as never,
      allRelationships: [
        right,
        invalidRight,
        roleMembership,
        sourceMembership,
        allMembership,
        structure,
      ],
      onRejectRequest,
      onDeleteRelationship,
      setManageDialog,
      manageDialog: {
        rels: [right],
        otherGroupName: 'Partner Group',
        otherGroupId: 'partner-group',
      },
    });
    render(<ManageNetworkTabContentView {...viewProps} />);

    for (const button of screen.getAllByTestId('direction-filter')) fireEvent.click(button);
    fireEvent.click(screen.getByTestId('search-change'));
    fireEvent.click(screen.getByTestId('right-filter'));
    for (const button of screen.getAllByTestId('warning')) fireEvent.click(button);
    for (const button of screen.getAllByTestId('confirm-delete')) fireEvent.click(button);

    const approveButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[data-action-id="network.relationship.request.approve"]'
      )
    );
    for (const approveButton of approveButtons) fireEvent.click(approveButton);
    await waitFor(() => expect(viewProps.onAcceptRequest).toHaveBeenCalled());
    const acceptRequestMock = viewProps.onAcceptRequest as ReturnType<typeof vi.fn>;
    const successfulApprovals = acceptRequestMock.mock.calls.length;
    harness.rejectSubmission = true;
    fireEvent.click(approveButtons[0]);
    await waitFor(() =>
      expect(viewProps.onAcceptRequest).toHaveBeenCalledTimes(successfulApprovals + 1)
    );
    harness.rejectSubmission = false;

    act(() => harness.hierarchyProps!.onOpenChange(true));
    act(() => harness.hierarchyProps!.onOpenChange(false));
    await act(async () => harness.hierarchyProps!.onAccept());
    await act(async () => harness.hierarchyProps!.onReject());
    fireEvent.click(screen.getByTestId('submission-retry'));

    expect(setManageDialog).toHaveBeenCalled();
    expect(onRejectRequest).toHaveBeenCalled();
    expect(onDeleteRelationship).toHaveBeenCalled();
    expect(harness.retry).toHaveBeenCalled();
  });

  it('executes virtual request and active-source contracts for settled and live reads', () => {
    const incomingRel = relationship('incoming-virtual');
    const outgoingRel = relationship('outgoing-virtual');
    const summary = {
      group: incomingRel.group,
      rights: ['informationRight'],
      type: 'sibling',
    };
    render(
      <ManageNetworkTabContentView
        {...props({
          virtualize: true,
          incomingRequests: [grouped('incoming-virtual', [incomingRel])],
          outgoingRequests: [grouped('outgoing-virtual', [outgoingRel])],
          filteredRelationships: [summary] as never,
          allRelationships: [incomingRel, outgoingRel],
          currentGroupType: 'sibling',
          currentGroupSiblingMembershipMode: 'open',
        })}
      />
    );

    for (const source of harness.zeroProps) {
      source.getRowKey({ id: 'request-row' });
      source.toStartRow({ id: 'request-row', updated_at: 10 });
      source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false });
      source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true });
      source.getSingleQuery({ id: 'request-row', settled: false });
      source.getSingleQuery({ id: 'request-row', settled: true });
    }

    const activeSource = harness.activeSource!;
    activeSource.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false });
    activeSource.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true });
    activeSource.getSingleQuery({ id: 'row', settled: false });
    activeSource.getSingleQuery({ id: 'row', settled: true });
    activeSource.getRowKey({ _virtualId: 'virtual', id: 'real' });
    activeSource.getRowKey({ id: 'real' });
    activeSource.toStartRow({ id: 'row', updated_at: 11 });
    expect(
      activeSource.mapRow({
        id: 'mapped',
        group_a_id: 'current-group',
        group_b_id: 'partner-group',
      })._virtualId
    ).toBe('mapped');
    activeSource.mapRow({ id: 'unmapped', group_a_id: 'current-group', group_b_id: 'missing' });
    activeSource.mapRow({ id: 'no-partner', group_a_id: null, group_b_id: 'current-group' });

    cleanup();
    render(
      <ManageNetworkTabContentView
        {...props({
          filteredRelationships: [summary] as never,
          allRelationships: [incomingRel],
          currentGroupType: 'sibling',
          currentGroupSiblingMembershipMode: 'open',
        })}
      />
    );
  });

  it('selects partner and terminal sibling display modes and all error preview variants', () => {
    harness.emptyTranslations = true;
    const sibling = relationship('sibling-active');
    const base = props({
      filteredRelationships: [
        {
          group: {
            ...sibling.group,
            group_type: 'sibling',
            sibling_membership_mode: 'elected',
          },
          rights: [],
          type: 'sibling',
          membershipMode: undefined,
        },
      ] as never,
      allRelationships: [sibling],
    });
    const { rerender } = render(<ManageNetworkTabContentView {...base} />);

    harness.submissionStatus = 'error';
    harness.submissionError = new Error('hierarchy member conflict');
    rerender(<ManageNetworkTabContentView {...base} />);
    harness.submissionError = 'hierarchy_member_overlap';
    rerender(<ManageNetworkTabContentView {...base} />);
    harness.submissionError = { message: 'other' };
    rerender(<ManageNetworkTabContentView {...base} />);

    expect(harness.overlayProps).toBeTruthy();
  });
});
