import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { EntitySearchBar, type FilterOption } from '@/features/shared/ui/ui/entity-search-bar';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { DangerConfirmDialog } from '@/features/shared/ui/dialog';
import { StatusBadge } from '@/features/shared/ui/status';
import { RightBadge } from './RightBadge';
import { isRightType, RIGHT_TYPES, RIGHT_GRADIENTS } from './RightFilters';
import {
  GroupRelationshipDirectionSentence,
  GroupRelationshipConnector,
  GroupRelationshipNameTag,
  GroupRelationshipTypePreview,
} from './GroupRelationshipFields';
import { LinkGroupDialog } from './LinkGroupDialog';
import { Pencil, Trash2, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useHierarchyLinkConflicts } from '../hooks/useHierarchyLinkConflicts';
import { HierarchyConflictDialog } from './HierarchyConflictDialog';
import { GroupConnectionStatusCell } from './GroupConnectionStatusCell';
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

interface ManageNetworkTabProps {
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
  onAcceptRequest: (rels: NormalizedGroupRelationship[]) => Promise<void>;
  onRejectRequest: (rels: NormalizedGroupRelationship[]) => Promise<void>;
  onDeleteRelationship: (targetGroupId: string) => void;
}

export function ManageNetworkTab({
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
}: ManageNetworkTabProps) {
  const { t } = useTranslation();
  const [manageDialog, setManageDialog] = useState<{
    rels: NormalizedGroupRelationship[];
    otherGroupName: string;
    otherGroupId: string;
  } | null>(null);

  const activePartnerGroupId = useMemo(() => {
    return manageDialog?.otherGroupId;
  }, [manageDialog]);

  const {
    canActivateLink,
    getConflictUserIds,
    resolveConflictUsers,
    resolvePartnerUsers,
    isLinkCheckApplicable,
  } = useHierarchyLinkConflicts(groupId, allRelationships, activePartnerGroupId);

  const openManageDialog = (
    rels: NormalizedGroupRelationship[],
    otherGroupName: string,
    otherGroupId: string
  ) => {
    setManageDialog({ rels, otherGroupName, otherGroupId });
  };

  const manageDialogConflictUsers = manageDialog
    ? resolveConflictUsers([...new Set(manageDialog.rels.flatMap(rel => getConflictUserIds(rel)))])
    : [];

  const manageDialogCanAccept = manageDialog
    ? manageDialog.rels.every(rel => canActivateLink(rel))
    : false;

  const manageDialogAffectedUsers = useMemo(
    () => manageDialogConflictUsers.filter(user => user.membershipIdInCurrentGroup),
    [manageDialogConflictUsers]
  );

  const manageDialogPartnerUsers = useMemo(() => {
    if (!activePartnerGroupId) {
      return [];
    }

    return resolvePartnerUsers();
  }, [activePartnerGroupId, resolvePartnerUsers]);

  const currentGroupTagName = groupName || '';
  const incomingRequestCount = incomingRequests.length;
  const outgoingRequestCount = outgoingRequests.length;

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

  const renderMembershipBadge = (membershipMode?: CanonicalMembershipMode | null) => {
    if (!membershipMode) {
      return null;
    }

    return (
      <StatusBadge status={membershipMode} tone="outline" className="text-xs">
        {getCanonicalMembershipModeLabel(membershipMode)}
      </StatusBadge>
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

  const filterOptions: FilterOption[] = RIGHT_TYPES.map(right => ({
    label:
      t(
        `common.rights.${right === 'informationRight' ? 'information' : right === 'amendmentRight' ? 'amendment' : right === 'rightToSpeak' ? 'speak' : right === 'activeVotingRight' ? 'activeVoting' : 'passiveVoting'}`
      ) || right,
    value: right,
    active: manageRightFilter.has(right),
    gradient: RIGHT_GRADIENTS[right as keyof typeof RIGHT_GRADIENTS],
  }));

  const directionOptions: {
    value: GroupRelationshipFilter;
    label: string;
    activeClassName?: string;
  }[] = [
    {
      value: 'all',
      label: t('common.network.allDirectionOptions'),
    },
    {
      value: 'parent',
      label: t('common.network.thisGroupAsParent'),
      activeClassName:
        'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90',
    },
    {
      value: 'child',
      label: t('common.network.thisGroupAsChild'),
      activeClassName:
        'border-0 bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:opacity-90',
    },
    {
      value: 'sibling',
      label: t('common.network.thisGroupAsSibling'),
      activeClassName:
        'border-0 bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white hover:opacity-90',
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
    if (request.rightRels.length === 0 && request.structureRel) {
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

    return request.rightRels.map(rel => ({
      id: rel.id,
      request,
      rel,
      rels: [rel],
      isStructure: false,
    }));
  };

  const renderRequestRelationshipCell = (row: RequestTableRow) => {
    if (row.isStructure) {
      return renderRequestFallbackRelationshipCell();
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

  const renderIncomingRequestActions = (row: RequestTableRow) => {
    const otherGroupName = row.request.group.name ?? t('common.unspecified');
    const canLink = row.rels.every(rel => canActivateLink(rel));

    return (
      <div className="flex items-center justify-end gap-1">
        {canLink ? (
          <Button size="sm" variant="default" onClick={() => onAcceptRequest(row.rels)}>
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
          {renderMembershipBadge(row.original.membershipMode)}
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

  return (
    <div className="space-y-6">
      {/* Link Group Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('common.network.groupRelationships')}</h3>
          <p className="text-muted-foreground text-sm">
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
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('common.network.activeRelationships')}</CardTitle>
          <CardDescription>{t('common.network.groupRelationshipsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            placeholder={t('common.network.searchByGroupName')}
            filterOptions={filterOptions}
            filterLabel={t('common.labels.filterByRights')}
            onFilterToggle={onToggleRightFilter}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('common.network.directionFilterLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {directionOptions.map(option => {
                const isActive = directionFilter === option.value;

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    className={
                      isActive && option.activeClassName ? option.activeClassName : undefined
                    }
                    onClick={() => onDirectionFilterChange(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Clock className="h-5 w-5" />
            {t('common.network.incomingRequests')} ({incomingRequestCount})
          </h2>
          <div className="space-y-4">
            {incomingRequests.map(req => (
              <Card key={req.group.id} className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{req.group.name}</CardTitle>
                  <CardDescription>
                    {renderRequestDescription(
                      req.group,
                      req.type,
                      req.membershipMode,
                      req.rightRels.length > 0
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={incomingRequestColumns}
                    data={getRequestRows(req)}
                    getRowId={row => row.id}
                    enablePagination={false}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">
            {t('common.network.outgoingRequests')} ({outgoingRequestCount})
          </h2>
          <div className="space-y-4">
            {outgoingRequests.map(req => (
              <Card key={req.group.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{req.group.name}</CardTitle>
                  <CardDescription>
                    {renderRequestDescription(
                      req.group,
                      req.type,
                      req.membershipMode,
                      req.rightRels.length > 0
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={outgoingRequestColumns}
                    data={getRequestRows(req)}
                    getRowId={row => row.id}
                    enablePagination={false}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Relationships — Search, Filters & Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('common.network.activeRelationships')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

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
            await onAcceptRequest(manageDialog.rels);
          }}
          onReject={async () => {
            await onRejectRequest(manageDialog.rels);
          }}
        />
      ) : null}
    </div>
  );
}
