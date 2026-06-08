import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { EntitySearchBar, type FilterOption } from '@/features/shared/ui/ui/entity-search-bar';
import { RightBadge } from './RightBadge';
import { isRightType, RIGHT_TYPES, RIGHT_GRADIENTS } from './RightFilters';
import {
  GroupRelationshipDirectionSentence,
  GroupRelationshipConnector,
  GroupRelationshipNameTag,
  GroupRelationshipTypePreview,
} from './GroupRelationshipFields';
import { LinkGroupDialog } from './LinkGroupDialog';
import { WorkflowEditor } from './WorkflowEditor';
import { Pencil, Trash2, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useHierarchyLinkConflicts } from '../hooks/useHierarchyLinkConflicts';
import { HierarchyConflictDialog } from './HierarchyConflictDialog';
import { NetworkLinkStatusCell } from './NetworkLinkStatusCell';
import {
  getCanonicalMembershipModeLabel,
  getLegacySiblingMembershipMode,
} from '../logic/networkLinkDerived';
import type {
  CanonicalMembershipMode,
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  GroupedRelationshipSummary,
  NetworkGroupEntity,
  NormalizedGroupRelationship,
} from '../types/network.types';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type { DraftWorkflowStep } from '../hooks/useWorkflowEditor';
import { getCurrentGroupRelationshipDisplay } from '../logic/groupRelationshipDisplay';
import type { SiblingMembershipMode } from '../logic/groupRelationshipSentence';

interface ManageNetworkTabProps {
  showWorkflows?: boolean;
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
  // Workflow props
  workflows: WorkflowWithStepsRow[];
  workflowsLoading: boolean;
  isWorkflowEditorOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  workflowDraftName: string;
  onWorkflowDraftNameChange: (name: string) => void;
  workflowDraftDescription: string;
  onWorkflowDraftDescriptionChange: (description: string) => void;
  workflowDraftIsDefaultEntry: boolean;
  onWorkflowDraftIsDefaultEntryChange: (value: boolean) => void;
  workflowDraftSteps: DraftWorkflowStep[];
  availableGroups: {
    id: string;
    name: string | null;
    description?: unknown;
    member_count?: number | null;
    event_count?: number | null;
    amendment_count?: number | null;
  }[];
  availableWorkflows: {
    id: string;
    group_id: string;
    name: string | null;
  }[];
  onOpenNewWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowWithStepsRow) => void;
  onCloseWorkflowEditor: () => void;
  onAddWorkflowStep: (groupId: string, label: string | null) => void;
  onUpdateWorkflowStep: (index: number, patch: Partial<DraftWorkflowStep>) => void;
  onRemoveWorkflowStep: (index: number) => void;
  onMoveWorkflowStep: (fromIndex: number, toIndex: number) => void;
  onSaveWorkflow: () => void;
  onDeleteWorkflow: (workflowId: string) => void;
}

export function ManageNetworkTab({
  showWorkflows = true,
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
  workflows,
  workflowsLoading,
  isWorkflowEditorOpen,
  editingWorkflow,
  workflowDraftName,
  onWorkflowDraftNameChange,
  workflowDraftDescription,
  onWorkflowDraftDescriptionChange,
  workflowDraftIsDefaultEntry,
  onWorkflowDraftIsDefaultEntryChange,
  workflowDraftSteps,
  availableGroups,
  availableWorkflows,
  onOpenNewWorkflow,
  onOpenEditWorkflow,
  onCloseWorkflowEditor,
  onAddWorkflowStep,
  onUpdateWorkflowStep,
  onRemoveWorkflowStep,
  onMoveWorkflowStep,
  onSaveWorkflow,
  onDeleteWorkflow,
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
  const incomingRequestCount = incomingRequests.reduce(
    (total, entry) => total + entry.rels.length,
    0
  );
  const outgoingRequestCount = outgoingRequests.reduce(
    (total, entry) => total + entry.rels.length,
    0
  );

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
      getLegacySiblingMembershipMode(membershipMode)
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
      <Badge variant="outline" className="text-xs">
        {getCanonicalMembershipModeLabel(membershipMode)}
      </Badge>
    );
  };

  const renderRequestDescription = (
    partnerGroup: GroupedRelationshipRequest['group'],
    type: GroupedRelationshipRequest['type'],
    membershipMode?: CanonicalMembershipMode | null
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
      <span>{t('common.network.withRights')}</span>
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
      label: t('common.network.thisGroupAsSibling', 'Diese Gruppe als Geschwistergruppe'),
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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('common.actions.delete')}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('common.network.deleteRequestTitle', 'Anfrage löschen?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('common.network.deleteRequestDescription', {
              groupName: partnerGroupName,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {t('common.actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

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
                    {renderRequestDescription(req.group, req.type, req.membershipMode)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.network.relationship')}</TableHead>
                        <TableHead>{t('common.labels.rights')}</TableHead>
                        <TableHead>{t('common.network.requested')}</TableHead>
                        <TableHead>{t('common.network.linkPossible')}</TableHead>
                        {canManageRelationships ? (
                          <TableHead className="text-right">
                            {t('common.actions.actions')}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {req.rels.map(rel => {
                        const hasHierarchyCheck = isLinkCheckApplicable(rel);
                        const canLink = canActivateLink(rel);
                        const otherGroupName = req.group.name ?? t('common.unspecified');
                        const display = getCurrentGroupRelationshipDisplay(rel, groupId);
                        const right =
                          rel.with_right && isRightType(rel.with_right) ? rel.with_right : null;

                        return (
                          <TableRow key={rel.id}>
                            <TableCell>
                              {display && right ? (
                                <GroupRelationshipDirectionSentence
                                  direction={display.rightDirection}
                                  right={right}
                                  currentGroupName={currentGroupTagName}
                                  selectedGroupName={
                                    display.partnerGroup.name ?? t('common.unspecified')
                                  }
                                  currentGroupId={groupId}
                                  selectedGroupId={display.partnerGroup.id}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <RightBadge right={rel.with_right ?? ''} />
                            </TableCell>
                            <TableCell>
                              {rel.created_at ? new Date(rel.created_at).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell>
                              <NetworkLinkStatusCell
                                canLink={canLink}
                                hasHierarchyCheck={hasHierarchyCheck}
                                onWarningClick={
                                  canManageRelationships
                                    ? () => openManageDialog([rel], otherGroupName, req.group.id)
                                    : undefined
                                }
                              />
                            </TableCell>
                            {canManageRelationships ? (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canLink ? (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => onAcceptRequest([rel])}
                                    >
                                      {t('common.actions.confirm')}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() =>
                                        openManageDialog([rel], otherGroupName, req.group.id)
                                      }
                                    >
                                      {t('common.network.manage')}
                                    </Button>
                                  )}
                                  {display ? (
                                    <LinkGroupDialog
                                      currentGroupId={groupId}
                                      currentGroupName={groupName}
                                      initialTargetGroupId={display.partnerGroup.id}
                                      initialRelationshipType={display.relationshipType}
                                      initialRights={rel.with_right ? [rel.with_right] : []}
                                      trigger={
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <Pencil className="h-4 w-4" />
                                          <span className="sr-only">
                                            {t('common.network.editRelationship')}
                                          </span>
                                        </Button>
                                      }
                                      allRelationships={allRelationships}
                                    />
                                  ) : null}
                                  {renderRequestDeleteAction({
                                    partnerGroupName: otherGroupName,
                                    onDelete: () => onRejectRequest([rel]),
                                  })}
                                </div>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
                    {renderRequestDescription(req.group, req.type, req.membershipMode)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.network.relationship')}</TableHead>
                        <TableHead>{t('common.labels.rights')}</TableHead>
                        <TableHead>{t('common.network.requested')}</TableHead>
                        {canManageRelationships ? (
                          <TableHead className="text-right">
                            {t('common.actions.actions')}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {req.rels.map(rel => {
                        const display = getCurrentGroupRelationshipDisplay(rel, groupId);
                        const right =
                          rel.with_right && isRightType(rel.with_right) ? rel.with_right : null;
                        const otherGroupName = req.group.name ?? t('common.unspecified');

                        return (
                          <TableRow key={rel.id}>
                            <TableCell>
                              {display && right ? (
                                <GroupRelationshipDirectionSentence
                                  direction={display.rightDirection}
                                  right={right}
                                  currentGroupName={currentGroupTagName}
                                  selectedGroupName={
                                    display.partnerGroup.name ?? t('common.unspecified')
                                  }
                                  currentGroupId={groupId}
                                  selectedGroupId={display.partnerGroup.id}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <RightBadge right={rel.with_right ?? ''} />
                            </TableCell>
                            <TableCell>
                              {rel.created_at ? new Date(rel.created_at).toLocaleDateString() : '-'}
                            </TableCell>
                            {canManageRelationships ? (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {display ? (
                                    <LinkGroupDialog
                                      currentGroupId={groupId}
                                      currentGroupName={groupName}
                                      initialTargetGroupId={display.partnerGroup.id}
                                      initialRelationshipType={display.relationshipType}
                                      initialRights={rel.with_right ? [rel.with_right] : []}
                                      trigger={
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <Pencil className="h-4 w-4" />
                                          <span className="sr-only">
                                            {t('common.network.editRelationship')}
                                          </span>
                                        </Button>
                                      }
                                      allRelationships={allRelationships}
                                    />
                                  ) : null}
                                  {renderRequestDeleteAction({
                                    partnerGroupName: otherGroupName,
                                    onDelete: () => onRejectRequest([rel]),
                                  })}
                                </div>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.network.groupName')}</TableHead>
                  <TableHead>{t('common.network.relationship')}</TableHead>
                  <TableHead>{t('common.network.partnerGroup')}</TableHead>
                  <TableHead>{t('common.labels.rights')}</TableHead>
                  {canManageRelationships ? (
                    <TableHead className="text-right">{t('common.actions.actions')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRelationships.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageRelationships ? 5 : 4}
                      className="text-muted-foreground h-24 text-center"
                    >
                      {t('common.network.noRelationshipsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRelationships.map((rel, idx) => (
                    <TableRow key={`${rel.group.id}-${rel.type}-${idx}`}>
                      <TableCell>
                        <div className="max-w-[14rem]">
                          <GroupRelationshipNameTag
                            name={currentGroupTagName}
                            kind="current"
                            groupId={groupId}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <GroupRelationshipConnector
                          relationshipType={rel.type}
                          siblingMembershipMode={getDisplayedSiblingMembershipMode(
                            rel.type,
                            rel.group,
                            rel.membershipMode
                          )}
                        />
                        {renderMembershipBadge(rel.membershipMode)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[14rem]">
                          <GroupRelationshipNameTag
                            name={rel.group.name ?? t('common.unspecified')}
                            kind="selected"
                            groupId={rel.group.id}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(rel.rights)).map(r => (
                            <RightBadge key={r} right={r} />
                          ))}
                        </div>
                      </TableCell>
                      {canManageRelationships ? (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <LinkGroupDialog
                              currentGroupId={groupId}
                              currentGroupName={groupName}
                              initialTargetGroupId={rel.group.id}
                              initialRelationshipType={rel.type}
                              initialRights={rel.rights}
                              trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit relationship</span>
                                </Button>
                              }
                              allRelationships={allRelationships}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete relationship</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t('common.network.deleteAllRelationships')}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('common.network.deleteRelationshipDescription', {
                                      groupName: rel.group.name,
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t('common.actions.cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteRelationship(rel.group.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-white"
                                  >
                                    {t('common.actions.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Workflows Section */}
      {showWorkflows && canManageRelationships ? (
        <WorkflowEditor
          workflows={workflows}
          isLoading={workflowsLoading}
          isEditorOpen={isWorkflowEditorOpen}
          editingWorkflow={editingWorkflow}
          draftName={workflowDraftName}
          setDraftName={onWorkflowDraftNameChange}
          draftDescription={workflowDraftDescription}
          setDraftDescription={onWorkflowDraftDescriptionChange}
          draftIsDefaultEntry={workflowDraftIsDefaultEntry}
          setDraftIsDefaultEntry={onWorkflowDraftIsDefaultEntryChange}
          draftSteps={workflowDraftSteps}
          availableGroups={availableGroups}
          availableWorkflows={availableWorkflows}
          onOpenNew={onOpenNewWorkflow}
          onOpenEdit={onOpenEditWorkflow}
          onClose={onCloseWorkflowEditor}
          onAddStep={onAddWorkflowStep}
          onUpdateStep={onUpdateWorkflowStep}
          onRemoveStep={onRemoveWorkflowStep}
          onMoveStep={onMoveWorkflowStep}
          onSave={onSaveWorkflow}
          onDelete={onDeleteWorkflow}
        />
      ) : null}

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
