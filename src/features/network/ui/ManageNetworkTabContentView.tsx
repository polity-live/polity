import { useMemo, useState } from 'react';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import { Button } from '@/features/shared/ui/ui/button';
import { ManagementSection, ManagementToolbar } from '@/features/shared/ui/form';
import { FilterButton } from '@/features/shared/ui/filter-controls';
import {
  ActionSubmissionOverlay,
  useActionSubmission,
  type ActionSubmissionContext,
  type ActionSubmissionStep,
} from '@/features/shared/ui/action-submission';
import { EntitySearchBar, type FilterOption } from '@/features/shared/ui/typeahead';
import { DataTable, VirtualDataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';
import { DangerConfirmDialog } from '@/features/shared/ui/dialog';
import {
  MEMBERSHIP_FLOW_RIGHT,
  NETWORK_FLOW_FILTER_TYPES,
  RIGHT_GRADIENTS,
  RightBadge,
  StatusBadge,
  getRightLabel,
  isRightType,
} from '@/features/shared/ui/status';
import {
  GroupRelationshipDirectionSentence,
  GroupRelationshipConnector,
  GroupRelationshipNameTag,
  GroupRelationshipTypePreview,
} from '../ui/GroupRelationshipFields';
import { LinkGroupDialog } from '../ui/LinkGroupDialog';
import { Network, Pencil, Trash2, Clock } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { HierarchyConflictDialog } from '../ui/HierarchyConflictDialog';
import { GroupConnectionStatusCell } from '../ui/GroupConnectionStatusCell';
import {
  getCanonicalMembershipModeLabel,
  getSiblingMembershipKind,
} from '../logic/groupConnectionDerived';
import type {
  CanonicalMembershipMode,
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  GroupedRelationshipSummary,
  NetworkGroupEntity,
  NormalizedGroupRelationship,
} from '../types/network.types';
import { getCurrentGroupRelationshipDisplay } from '../logic/groupRelationshipDisplay';
import type { SiblingMembershipMode } from '../logic/groupRelationshipSentence';

export interface ManageNetworkTabProps {
  canManageRelationships: boolean;
  groupId: string;
  groupName: string;
  currentGroupType?: NetworkGroupEntity['group_type'] | null;
  currentGroupSiblingMembershipMode?: NetworkGroupEntity['sibling_membership_mode'] | null;
  // Search & filters
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  directionFilter: GroupRelationshipFilter;
  onDirectionFilterChange: (value: GroupRelationshipFilter) => void;
  manageRightFilter: Set<string>;
  onToggleRightFilter: (right: string) => void;
  // Requests
  incomingRequests: GroupedRelationshipRequest[];
  outgoingRequests: GroupedRelationshipRequest[];
  // Active relationships
  filteredRelationships: GroupedRelationshipSummary[];
  allRelationships: NormalizedGroupRelationship[];
  // Handlers
  onAcceptRequest: (
    rels: NormalizedGroupRelationship[],
    submissionContext?: ActionSubmissionContext
  ) => Promise<void>;
  onRejectRequest: (rels: NormalizedGroupRelationship[]) => Promise<void>;
  onDeleteRelationship: (targetGroupId: string) => void;
  virtualize?: boolean;
}

export interface ManageNetworkTabContentViewProps extends ManageNetworkTabProps {
  manageDialog: {
    rels: NormalizedGroupRelationship[];
    otherGroupName: string;
    otherGroupId: string;
  } | null;
  setManageDialog: (dialog: ManageNetworkTabContentViewProps['manageDialog']) => void;
  canActivateLink: (relationship: NormalizedGroupRelationship) => boolean;
  isLinkCheckApplicable: (relationship: NormalizedGroupRelationship) => boolean;
  manageDialogAffectedUsers: any[];
  manageDialogPartnerUsers: any[];
  manageDialogCanAccept: boolean;
}

const GROUP_LINK_APPROVAL_STEPS: ActionSubmissionStep[] = [
  { key: 'prepare', label: 'Verbindung prüfen', status: 'pending' },
  { key: 'commit', label: 'Link aktivieren', status: 'pending' },
  { key: 'sync', label: 'Netzwerkfolgen synchronisieren', status: 'pending' },
];

export function ManageNetworkTabContentView({
  canManageRelationships,
  groupId,
  groupName,
  currentGroupType,
  currentGroupSiblingMembershipMode,
  searchQuery,
  onSearchQueryChange,
  directionFilter,
  onDirectionFilterChange,
  manageRightFilter,
  onToggleRightFilter,
  incomingRequests,
  outgoingRequests,
  filteredRelationships,
  allRelationships,
  onAcceptRequest,
  onRejectRequest,
  onDeleteRelationship,
  virtualize = false,
  manageDialog,
  setManageDialog,
  canActivateLink,
  isLinkCheckApplicable,
  manageDialogAffectedUsers,
  manageDialogPartnerUsers,
  manageDialogCanAccept,
}: ManageNetworkTabContentViewProps) {
  const { t } = useTranslation();
  const linkSubmission = useActionSubmission('link', GROUP_LINK_APPROVAL_STEPS);
  const [linkPreview, setLinkPreview] = useState<{
    title: string;
    path: string[];
    badges: string[];
  } | null>(null);

  const currentGroupTagName = groupName || '';
  const incomingRequestCount = incomingRequests.length;
  const outgoingRequestCount = outgoingRequests.length;
  const openManageDialog = (
    rels: NormalizedGroupRelationship[],
    otherGroupName: string,
    otherGroupId: string
  ) => {
    setManageDialog({ rels, otherGroupName, otherGroupId });
  };

  const normalizeSiblingMembershipMode = (
    mode: string | null | undefined
  ): SiblingMembershipMode | null => {
    switch (mode) {
      case 'open':
      case 'elected':
      case 'parliament':
        return mode;
      default:
        return null;
    }
  };

  const getDisplayedSiblingMembershipMode = (
    relationshipType: GroupedRelationshipRequest['type'] | GroupedRelationshipSummary['type'],
    partnerGroup: NetworkGroupEntity,
    membershipMode?: CanonicalMembershipMode | null
  ): SiblingMembershipMode | null => {
    const canonicalSiblingMembershipMode = normalizeSiblingMembershipMode(
      getSiblingMembershipKind(membershipMode)
    );
    const currentSiblingMembershipMode = normalizeSiblingMembershipMode(
      currentGroupSiblingMembershipMode
    );
    const partnerSiblingMembershipMode = normalizeSiblingMembershipMode(
      partnerGroup.sibling_membership_mode
    );

    if (relationshipType !== 'sibling') {
      return null;
    }

    if (canonicalSiblingMembershipMode) {
      return canonicalSiblingMembershipMode;
    }

    if (currentGroupType === 'sibling' && currentSiblingMembershipMode) {
      return currentSiblingMembershipMode;
    }

    if (partnerGroup.group_type === 'sibling' && partnerSiblingMembershipMode) {
      return partnerSiblingMembershipMode;
    }

    return currentSiblingMembershipMode ?? partnerSiblingMembershipMode ?? null;
  };

  const renderMembershipBadge = (
    membershipMode?: CanonicalMembershipMode | null,
    requiredSourceRoleId?: string | null,
    requiredSourceRoleName?: string | null,
    showRoleTag = false
  ) => {
    if (!membershipMode) {
      return null;
    }

    const roleName =
      requiredSourceRoleName ?? t('common.network.selectedRole', 'ausgewählte Rolle');

    return (
      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={membershipMode} tone="outline" className="text-xs">
          {getCanonicalMembershipModeLabel(membershipMode)}
        </StatusBadge>
        {showRoleTag && membershipMode === 'role_members' ? (
          <RoleTag
            roleId={requiredSourceRoleId}
            roleName={requiredSourceRoleName ?? null}
            fallbackKey="active-relationship-membership-role"
          >
            {roleName}
          </RoleTag>
        ) : null}
      </div>
    );
  };

  const renderRequestDescription = (
    partnerGroup: GroupedRelationshipRequest['group'],
    type: GroupedRelationshipRequest['type'],
    membershipMode?: CanonicalMembershipMode | null,
    hasRights = true
  ) => (
    <div className="flex flex-wrap items-center gap-2 leading-tight">
      <GroupRelationshipTypePreview
        relationshipType={type}
        currentGroupName={currentGroupTagName}
        selectedGroupName={partnerGroup.name ?? t('common.unspecified')}
        siblingMembershipMode={getDisplayedSiblingMembershipMode(
          type,
          partnerGroup,
          membershipMode
        )}
        currentGroupId={groupId}
        selectedGroupId={partnerGroup.id}
      />
      {renderMembershipBadge(membershipMode)}
      <span>
        {hasRights ? t('common.network.withRights') : t('common.network.structureMembershipChange')}
      </span>
    </div>
  );

  const filterOptions: FilterOption[] = NETWORK_FLOW_FILTER_TYPES.map(right => ({
    label:
      right === MEMBERSHIP_FLOW_RIGHT
        ? getRightLabel(right, (key, fallback) => t(key) || fallback || key)
        : t(
            `common.rights.${right === 'informationRight' ? 'information' : right === 'amendmentRight' ? 'amendment' : right === 'rightToSpeak' ? 'speak' : right === 'activeVotingRight' ? 'activeVoting' : 'passiveVoting'}`
          ) || right,
    value: right,
    active: manageRightFilter.has(right),
    gradient: RIGHT_GRADIENTS[right as keyof typeof RIGHT_GRADIENTS],
  }));

  const directionOptions: {
    value: GroupRelationshipFilter;
    label: string;
  }[] = [
    {
      value: 'all',
      label: t('common.network.allDirectionOptions'),
    },
    {
      value: 'parent',
      label: t('common.network.thisGroupAsParent'),
    },
    {
      value: 'child',
      label: t('common.network.thisGroupAsChild'),
    },
    {
      value: 'sibling',
      label: t('common.network.thisGroupAsSibling'),
    },
  ];

  const renderRequestDeleteAction = ({
    partnerGroupName,
    onDelete,
  }: {
    partnerGroupName: string;
    onDelete: () => void;
  }) => (
    <DangerConfirmDialog
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('common.actions.delete')}</span>
        </Button>
      }
      title={t('common.network.deleteRequestTitle')}
      description={t('common.network.deleteRequestDescription', {
        groupName: partnerGroupName,
      })}
      cancelLabel={t('common.actions.cancel')}
      confirmLabel={t('common.actions.delete')}
      onConfirm={onDelete}
    />
  );

  const renderRequestFallbackRelationshipCell = () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status="structure-membership-change" tone="outline">
        {t('common.network.structureMembershipChange')}
      </StatusBadge>
    </div>
  );

  interface RequestTableRow {
    id: string;
    request: GroupedRelationshipRequest;
    rel: NormalizedGroupRelationship;
    rels: NormalizedGroupRelationship[];
    isStructure: boolean;
  }

  const getRequestRows = (request: GroupedRelationshipRequest): RequestTableRow[] => {
    const actionableRels = [...request.membershipRels, ...request.rightRels];

    if (actionableRels.length === 0 && request.structureRel) {
      return [
        {
          id: request.structureRel.id,
          request,
          rel: request.structureRel,
          rels: request.allRels,
          isStructure: true,
        },
      ];
    }

    return actionableRels.map(rel => ({
      id: rel.id,
      request,
      rel,
      rels: [rel],
      isStructure: false,
    }));
  };

  const getRequestEndpoint = (rel: NormalizedGroupRelationship, endpointGroupId: string | null) => {
    if (!endpointGroupId) {
      return { id: null, name: t('common.unspecified') };
    }
    if (rel.group_id === endpointGroupId) {
      return { id: endpointGroupId, name: rel.group?.name ?? endpointGroupId };
    }
    if (rel.related_group_id === endpointGroupId) {
      return { id: endpointGroupId, name: rel.related_group?.name ?? endpointGroupId };
    }
    return { id: endpointGroupId, name: endpointGroupId };
  };

  const renderMembershipGroupTag = (endpoint: { id: string | null; name: string }) => {
    return (
      <GroupRelationshipNameTag
        name={endpoint.name}
        kind={endpoint.id === groupId ? 'current' : 'selected'}
        caseStyle="embedded"
        groupId={endpoint.id ?? undefined}
        displayMode="name-only"
      />
    );
  };

  const renderMembershipRequestRelationshipCell = (rel: NormalizedGroupRelationship) => {
    const sourceGroup = getRequestEndpoint(rel, rel.member_source_group_id);
    const targetGroup = getRequestEndpoint(rel, rel.member_target_group_id);
    const roleName =
      rel.required_source_role?.name ?? t('common.network.selectedRole', 'ausgewählte Rolle');

    if (rel.membership_mode === 'role_members') {
      return (
        <div className="flex flex-wrap items-center gap-1.5 leading-tight">
          <span>{t('common.network.membersOf', 'Mitglieder von')}</span>
          {renderMembershipGroupTag(sourceGroup)}
          <span>{t('common.network.withRole', 'mit Rolle')}</span>
          <RoleTag
            roleId={rel.required_source_role_id}
            roleName={rel.required_source_role?.name ?? null}
            fallbackKey={`membership-request-role-${rel.id}`}
          >
            {roleName}
          </RoleTag>
          <span>{t('common.network.areAddedTo', 'werden')}</span>
          {renderMembershipGroupTag(targetGroup)}
          <span>{t('common.network.added', 'hinzugefügt')}</span>
        </div>
      );
    }

    if (rel.membership_mode === 'selected_source_groups') {
      return (
        <div className="flex flex-wrap items-center gap-1.5 leading-tight">
          <span>
            {t(
              'common.network.membersFromSelectedSourcesOf',
              'Mitglieder aus ausgewählten Quellen von'
            )}
          </span>
          {renderMembershipGroupTag(sourceGroup)}
          <span>{t('common.network.areAddedTo', 'werden')}</span>
          {renderMembershipGroupTag(targetGroup)}
          <span>{t('common.network.added', 'hinzugefügt')}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5 leading-tight">
        <span>{t('common.network.allMembersOf', 'Alle Mitglieder von')}</span>
        {renderMembershipGroupTag(sourceGroup)}
        <span>{t('common.network.areAddedTo', 'werden')}</span>
        {renderMembershipGroupTag(targetGroup)}
        <span>{t('common.network.added', 'hinzugefügt')}</span>
      </div>
    );
  };

  const renderRequestRelationshipCell = (row: RequestTableRow) => {
    if (row.isStructure) {
      return renderRequestFallbackRelationshipCell();
    }

    if (row.rel.request_item_kind === 'membership') {
      return renderMembershipRequestRelationshipCell(row.rel);
    }

    const display = getCurrentGroupRelationshipDisplay(row.rel, groupId);
    const right = row.rel.with_right && isRightType(row.rel.with_right) ? row.rel.with_right : null;

    return display && right ? (
      <GroupRelationshipDirectionSentence
        direction={display.rightDirection}
        right={right}
        currentGroupName={currentGroupTagName}
        selectedGroupName={display.partnerGroup.name ?? t('common.unspecified')}
        currentGroupId={groupId}
        selectedGroupId={display.partnerGroup.id}
      />
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  };

  const renderRequestRightsCell = (row: RequestTableRow) =>
    row.isStructure ? (
      <StatusBadge status="structure-membership" tone="outline">
        {t('common.network.structureMembership')}
      </StatusBadge>
    ) : row.rel.request_item_kind === 'membership' ? (
      <RightBadge right={MEMBERSHIP_FLOW_RIGHT} />
    ) : (
      <RightBadge right={row.rel.with_right ?? ''} />
    );

  const renderRequestDateCell = (row: RequestTableRow) =>
    row.rel.created_at ? new Date(row.rel.created_at).toLocaleDateString() : '-';

  const renderRequestEditAction = (row: RequestTableRow) => {
    const display = getCurrentGroupRelationshipDisplay(row.rel, groupId);

    if (!display) {
      return null;
    }

    return (
      <LinkGroupDialog
        currentGroupId={groupId}
        currentGroupName={groupName}
        initialTargetGroupId={display.partnerGroup.id}
        initialRelationshipType={display.relationshipType}
        initialRights={row.isStructure || !row.rel.with_right ? [] : [row.rel.with_right]}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">{t('common.network.editRelationship')}</span>
          </Button>
        }
        allRelationships={allRelationships}
      />
    );
  };

  const handleAcceptLinkRequest = (rels: NormalizedGroupRelationship[], otherGroupName: string) => {
    setLinkPreview({
      title: otherGroupName,
      path: [groupName || groupId, otherGroupName],
      badges: rels
        .map(rel =>
          rel.request_item_kind === 'membership' ? MEMBERSHIP_FLOW_RIGHT : rel.with_right
        )
        .filter((right): right is string => Boolean(right)),
    });

    return linkSubmission.runActionWithSubmission(async context => onAcceptRequest(rels, context), {
      onSuccess: () => {
        linkSubmission.reset();
        setManageDialog(null);
      },
    });
  };

  const linkSubmissionErrorMessage =
    linkSubmission.error instanceof Error
      ? linkSubmission.error.message
      : typeof linkSubmission.error === 'string'
        ? linkSubmission.error
        : '';
  const linkSubmissionPreviewDescription =
    linkSubmission.status === 'error' &&
    (linkSubmissionErrorMessage.toLowerCase().includes('hierarchy member conflict') ||
      linkSubmissionErrorMessage.includes('hierarchy_member_overlap'))
      ? t('common.network.linkAcceptBlocked')
      : undefined;

  const renderIncomingRequestActions = (row: RequestTableRow) => {
    const otherGroupName = row.request.group.name ?? t('common.unspecified');
    const canLink = row.rels.every(rel => canActivateLink(rel));

    return (
      <div className="flex items-center justify-end gap-1">
        {canLink ? (
          <Button
            size="sm"
            variant="default"
            disabled={linkSubmission.isActive}
            onClick={() =>
              void handleAcceptLinkRequest(row.rels, otherGroupName).catch(() => undefined)
            }
          >
            {t('common.actions.confirm')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={() => openManageDialog(row.rels, otherGroupName, row.request.group.id)}
          >
            {t('common.network.manage')}
          </Button>
        )}
        {renderRequestEditAction(row)}
        {renderRequestDeleteAction({
          partnerGroupName: otherGroupName,
          onDelete: () => onRejectRequest(row.rels),
        })}
      </div>
    );
  };

  const renderOutgoingRequestActions = (row: RequestTableRow) => {
    const otherGroupName = row.request.group.name ?? t('common.unspecified');

    return (
      <div className="flex items-center justify-end gap-1">
        {renderRequestEditAction(row)}
        {renderRequestDeleteAction({
          partnerGroupName: otherGroupName,
          onDelete: () => onRejectRequest(row.rels),
        })}
      </div>
    );
  };

  const incomingRequestColumns: ColumnDef<RequestTableRow>[] = [
    {
      id: 'relationship',
      header: t('common.network.relationship'),
      cell: ({ row }) => renderRequestRelationshipCell(row.original),
    },
    {
      id: 'rights',
      header: t('common.labels.rights'),
      cell: ({ row }) => renderRequestRightsCell(row.original),
    },
    {
      id: 'requested',
      header: t('common.network.requested'),
      cell: ({ row }) => renderRequestDateCell(row.original),
    },
    {
      id: 'link-possible',
      header: t('common.network.linkPossible'),
      cell: ({ row }) => {
        const hasHierarchyCheck = isLinkCheckApplicable(row.original.rel);
        const canLink = row.original.rels.every(rel => canActivateLink(rel));
        const otherGroupName = row.original.request.group.name ?? t('common.unspecified');

        return (
          <GroupConnectionStatusCell
            canLink={canLink}
            hasHierarchyCheck={hasHierarchyCheck}
            onWarningClick={
              canManageRelationships
                ? () =>
                    openManageDialog(
                      row.original.rels,
                      otherGroupName,
                      row.original.request.group.id
                    )
                : undefined
            }
          />
        );
      },
    },
    ...(canManageRelationships
      ? [
          {
            id: 'actions',
            header: t('common.actions.actions'),
            meta: {
              headerClassName: 'text-right',
              cellClassName: 'text-right',
            },
            cell: ({ row }) => renderIncomingRequestActions(row.original),
          } satisfies ColumnDef<RequestTableRow>,
        ]
      : []),
  ];

  const outgoingRequestColumns: ColumnDef<RequestTableRow>[] = [
    {
      id: 'relationship',
      header: t('common.network.relationship'),
      cell: ({ row }) => renderRequestRelationshipCell(row.original),
    },
    {
      id: 'rights',
      header: t('common.labels.rights'),
      cell: ({ row }) => renderRequestRightsCell(row.original),
    },
    {
      id: 'requested',
      header: t('common.network.requested'),
      cell: ({ row }) => renderRequestDateCell(row.original),
    },
    ...(canManageRelationships
      ? [
          {
            id: 'actions',
            header: t('common.actions.actions'),
            meta: {
              headerClassName: 'text-right',
              cellClassName: 'text-right',
            },
            cell: ({ row }) => renderOutgoingRequestActions(row.original),
          } satisfies ColumnDef<RequestTableRow>,
        ]
      : []),
  ];

  const activeRelationshipColumns: ColumnDef<GroupedRelationshipSummary>[] = [
    {
      id: 'group-name',
      header: t('common.network.groupName'),
      cell: () => (
        <div className="max-w-[14rem]">
          <GroupRelationshipNameTag name={currentGroupTagName} kind="current" groupId={groupId} />
        </div>
      ),
    },
    {
      id: 'relationship',
      header: t('common.network.relationship'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <GroupRelationshipConnector
            relationshipType={row.original.type}
            siblingMembershipMode={getDisplayedSiblingMembershipMode(
              row.original.type,
              row.original.group,
              row.original.membershipMode
            )}
          />
          {renderMembershipBadge(
            row.original.membershipMode,
            row.original.requiredSourceRoleId,
            row.original.requiredSourceRoleName,
            true
          )}
        </div>
      ),
    },
    {
      id: 'partner-group',
      header: t('common.network.partnerGroup'),
      cell: ({ row }) => (
        <div className="max-w-[14rem]">
          <GroupRelationshipNameTag
            name={row.original.group.name ?? t('common.unspecified')}
            kind="selected"
            groupId={row.original.group.id}
          />
        </div>
      ),
    },
    {
      id: 'rights',
      header: t('common.labels.rights'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set(row.original.rights)).map(right => (
            <RightBadge key={right} right={right} />
          ))}
        </div>
      ),
    },
    ...(canManageRelationships
      ? [
          {
            id: 'actions',
            header: t('common.actions.actions'),
            meta: {
              headerClassName: 'text-right',
              cellClassName: 'text-right',
            },
            cell: ({ row }) => (
              <div className="flex items-center justify-end gap-1">
                <LinkGroupDialog
                  currentGroupId={groupId}
                  currentGroupName={groupName}
                  initialTargetGroupId={row.original.group.id}
                  initialRelationshipType={row.original.type}
                  initialRights={row.original.rights}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">
                        {translateText('generated.inline.0801_edit_relationship_e03de7d7')}
                      </span>
                    </Button>
                  }
                  allRelationships={allRelationships}
                />
                <DangerConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">
                        {translateText('generated.inline.0802_delete_relationship_98af16bc')}
                      </span>
                    </Button>
                  }
                  title={t('common.network.deleteAllRelationships')}
                  description={t('common.network.deleteRelationshipDescription', {
                    groupName: row.original.group.name,
                  })}
                  cancelLabel={t('common.actions.cancel')}
                  confirmLabel={t('common.actions.delete')}
                  onConfirm={() => onDeleteRelationship(row.original.group.id)}
                />
              </div>
            ),
          } satisfies ColumnDef<GroupedRelationshipSummary>,
        ]
      : []),
  ];

  const relationshipRowsByPartnerId = useMemo(
    () => new Map(filteredRelationships.map(relationship => [relationship.group.id, relationship])),
    [filteredRelationships]
  );
  const activeRelationshipSource = useMemo(
    () => ({
      context: {
        groupId,
        status: 'active',
        relationshipType: directionFilter,
        rights: [...manageRightFilter].sort(),
        query: searchQuery,
      },
      historyKey: `group-${groupId}-network-active`,
      getPageQuery: ({ limit, start, dir, settled }: any) => ({
        query: queries.network.groupConnectionPage({
          groupId,
          status: 'active',
          relationshipType: directionFilter,
          rights: [...manageRightFilter],
          query: searchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getSingleQuery: ({ id, settled }: any) => ({
        query: queries.network.groupConnectionById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      getRowKey: (row: any) => row._virtualId ?? row.id,
      toStartRow: (row: any) => ({ updated_at: row.updated_at, id: row.id }),
      mapRow: (row: any) => {
        const partnerId = [row.group_a_id, row.group_b_id, row.from_group_id, row.to_group_id].find(
          id => id && id !== groupId
        );
        const summary = partnerId ? relationshipRowsByPartnerId.get(partnerId) : undefined;
        return summary ? { ...summary, _virtualId: row.id } : row;
      },
    }),
    [directionFilter, groupId, manageRightFilter, relationshipRowsByPartnerId, searchQuery]
  );

  const requestList = (
    direction: 'incoming' | 'outgoing',
    requests: GroupedRelationshipRequest[],
    columns: ColumnDef<RequestTableRow>[]
  ) => (
    <PolityZeroListView<any, { updated_at: number; id: string }, any>
      context={{ groupId, direction, query: searchQuery }}
      historyKey={`group-${groupId}-network-${direction}`}
      estimateSize={190}
      getRowKey={row => row.id}
      toStartRow={row => ({ updated_at: row.updated_at, id: row.id })}
      getPageQuery={({ limit, start, dir, settled }) => ({
        query: queries.network.groupConnectionRequestPage({
          groupId,
          direction,
          query: searchQuery,
          limit,
          start,
          dir,
        }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      })}
      getSingleQuery={({ id, settled }) => ({
        query: queries.network.groupConnectionRequestById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      })}
      renderRow={row => {
        const request = requests.find(item => item.requestId === row.id);
        if (!request) return null;
        return (
          <div className="space-y-3">
            <div className="space-y-1 px-3 sm:px-4">
              <h3 className="text-sm font-semibold">{request.group.name}</h3>
              <div className="text-muted-foreground text-sm">
                {renderRequestDescription(
                  request.group,
                  request.type,
                  request.membershipMode,
                  request.rels.length > 0
                )}
              </div>
            </div>
            <DataTable
              columns={columns}
              data={getRequestRows(request)}
              getRowId={requestRow => requestRow.id}
              enablePagination={false}
            />
          </div>
        );
      }}
      renderSkeleton={index => <Skeleton key={index} className="h-40 w-full" />}
      renderEmpty={() => null}
      className="max-h-[42rem] overflow-auto"
      contentClassName="space-y-5"
    />
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 px-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {t('common.network.groupRelationships')}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('common.network.groupRelationshipsDescription')}
          </p>
        </div>
        {canManageRelationships ? (
          <LinkGroupDialog
            currentGroupId={groupId}
            currentGroupName={groupName}
            allRelationships={allRelationships}
          />
        ) : null}
      </header>

      <ManagementToolbar className="items-stretch md:items-end">
        <div className="min-w-0 flex-1">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            placeholder={t('common.network.searchByGroupName')}
            filterOptions={filterOptions}
            filterLabel={t('common.labels.filterByRights')}
            onFilterToggle={onToggleRightFilter}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('common.network.directionFilterLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {directionOptions.map(option => {
              const isActive = directionFilter === option.value;

              return (
                <FilterButton
                  key={option.value}
                  active={isActive}
                  onClick={() => onDirectionFilterChange(option.value)}
                >
                  {option.label}
                </FilterButton>
              );
            })}
          </div>
        </div>
      </ManagementToolbar>

      {incomingRequests.length > 0 && (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{t('common.network.incomingRequests')}</span>
              <StatusBadge status="incoming" tone="outline">
                {incomingRequestCount}
              </StatusBadge>
            </span>
          }
          description={t('common.network.incomingRequestsDescription')}
        >
          {virtualize ? (
            requestList('incoming', incomingRequests, incomingRequestColumns)
          ) : (
            <div className="space-y-5">
              {incomingRequests.map(request => (
                <div key={request.requestId ?? request.group.id} className="space-y-3">
                  <div className="space-y-1 px-3 sm:px-4">
                    <h3 className="text-sm font-semibold">{request.group.name}</h3>
                    <div className="text-muted-foreground text-sm">
                      {renderRequestDescription(
                        request.group,
                        request.type,
                        request.membershipMode,
                        request.rels.length > 0
                      )}
                    </div>
                  </div>
                  <DataTable
                    columns={incomingRequestColumns}
                    data={getRequestRows(request)}
                    getRowId={row => row.id}
                    enablePagination={false}
                  />
                </div>
              ))}
            </div>
          )}
        </ManagementSection>
      )}

      {outgoingRequests.length > 0 && (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{t('common.network.outgoingRequests')}</span>
              <StatusBadge status="outgoing" tone="outline">
                {outgoingRequestCount}
              </StatusBadge>
            </span>
          }
          description={t('common.network.outgoingRequestsDescription')}
        >
          {virtualize ? (
            requestList('outgoing', outgoingRequests, outgoingRequestColumns)
          ) : (
            <div className="space-y-5">
              {outgoingRequests.map(request => (
                <div key={request.requestId ?? request.group.id} className="space-y-3">
                  <div className="space-y-1 px-3 sm:px-4">
                    <h3 className="text-sm font-semibold">{request.group.name}</h3>
                    <div className="text-muted-foreground text-sm">
                      {renderRequestDescription(
                        request.group,
                        request.type,
                        request.membershipMode,
                        request.rels.length > 0
                      )}
                    </div>
                  </div>
                  <DataTable
                    columns={outgoingRequestColumns}
                    data={getRequestRows(request)}
                    getRowId={row => row.id}
                    enablePagination={false}
                  />
                </div>
              ))}
            </div>
          )}
        </ManagementSection>
      )}

      <ManagementSection
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Network className="h-4 w-4" />
            <span>{t('common.network.activeRelationships')}</span>
            <StatusBadge status="active" tone="outline">
              {filteredRelationships.length}
            </StatusBadge>
          </span>
        }
        description={t('common.network.activeRelationshipsDescription')}
      >
        {virtualize ? (
          <VirtualDataTable
            columns={activeRelationshipColumns as ColumnDef<any>[]}
            source={activeRelationshipSource}
            emptyTitle={t('common.network.activeRelationships')}
          />
        ) : (
          <DataTable
            columns={activeRelationshipColumns}
            data={filteredRelationships}
            getRowId={(relationship, index) =>
              `${relationship.group.id}-${relationship.type}-${index}`
            }
            enablePagination={false}
            emptyTitle={t('common.network.activeRelationships')}
            emptyDescription={t('common.network.noRelationshipsFound')}
          />
        )}
      </ManagementSection>

      {canManageRelationships && manageDialog ? (
        <HierarchyConflictDialog
          open
          onOpenChange={open => {
            if (!open) {
              setManageDialog(null);
            }
          }}
          groupName={groupName}
          otherGroupName={manageDialog.otherGroupName}
          relationships={manageDialog.rels}
          affectedUsers={manageDialogAffectedUsers}
          partnerUsers={manageDialogPartnerUsers}
          canAccept={manageDialogCanAccept}
          onAccept={async () => {
            await handleAcceptLinkRequest(manageDialog.rels, manageDialog.otherGroupName);
          }}
          onReject={async () => {
            await onRejectRequest(manageDialog.rels);
          }}
        />
      ) : null}
      <ActionSubmissionOverlay
        kind="link"
        status={linkSubmission.status}
        steps={linkSubmission.progressSteps}
        error={linkSubmission.error}
        preview={{
          entityLabel: t('common.network.relationship'),
          title: linkPreview?.title ?? t('common.network.groupNetwork'),
          description: linkSubmissionPreviewDescription,
          path: linkPreview?.path,
          badges: linkPreview?.badges,
        }}
        target={{ label: t('common.done', 'Fertig'), onClick: linkSubmission.reset }}
        onBack={linkSubmission.reset}
        onRetry={() => void linkSubmission.retry()}
      />
    </div>
  );
}
