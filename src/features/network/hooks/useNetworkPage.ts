import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGroupNetwork } from './useGroupNetwork';
import { useGroupData } from '@/features/groups/hooks/useGroupData';
import { useGroupConnectionActions, useWorkflowActions } from '@/zero/network';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { useAuth } from '@/providers/auth-provider';
import { MEMBERSHIP_FLOW_RIGHT, NETWORK_FLOW_FILTER_TYPES } from '@/features/shared/ui/status';
import { useWorkflowEditor } from './useWorkflowEditor';
import { useHierarchyLinkConflicts } from './useHierarchyLinkConflicts';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { getRelationshipTypeForGroup } from '../logic/groupRelationshipOrientation';
import { buildActiveRelationshipSummaries } from '../logic/relationshipSummaryHelpers';
import {
  trackServerFinalization,
  waitForClientApply,
  type MutationResultLike,
} from '@/zero/mutate-with-server-check';
import type { ActionSubmissionContext } from '@/features/shared/ui/action-submission';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type {
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  NetworkTab,
  NormalizedGroupRelationship,
} from '../types/network.types';
import { localizeAppError, toAppError } from '@/features/shared/errors/app-error';

function isRequestRightRelationship(rel: NormalizedGroupRelationship) {
  return rel.request_item_kind === 'right' || Boolean(rel.grant_id && rel.with_right);
}

function isRequestMembershipRelationship(rel: NormalizedGroupRelationship) {
  return rel.request_item_kind === 'membership';
}

function isRequestStructureRelationship(rel: NormalizedGroupRelationship) {
  return rel.request_item_kind === 'structure' || (!rel.grant_id && !rel.membership_request_id);
}

function getActionableRequestRels(entry: GroupedRelationshipRequest) {
  return [...entry.rightRels, ...entry.membershipRels];
}

function filterGroupedRequestItems(
  entry: GroupedRelationshipRequest,
  manageRightFilter: Set<string>,
  hasRightFilter: boolean
): GroupedRelationshipRequest {
  const rightRels = hasRightFilter
    ? entry.rightRels.filter(rel => manageRightFilter.has(rel.with_right ?? ''))
    : entry.rightRels;
  const membershipRels = hasRightFilter
    ? entry.membershipRels.filter(() => manageRightFilter.has(MEMBERSHIP_FLOW_RIGHT))
    : entry.membershipRels;

  return {
    ...entry,
    rightRels,
    membershipRels,
    rels: [...membershipRels, ...rightRels],
  };
}

function groupRequestRelationships(
  requests: readonly NormalizedGroupRelationship[],
  groupId: string
) {
  const groups = new Map<string, GroupedRelationshipRequest>();

  requests.forEach(rel => {
    const otherGroup = rel.group?.id === groupId ? rel.related_group : rel.group;
    const relationshipType = getRelationshipTypeForGroup(rel, groupId);
    if (!otherGroup || !relationshipType) {
      return;
    }

    const requestId = rel.connection_request_id ?? null;
    const key = requestId ?? `${otherGroup.id}:${rel.id}`;
    let entry = groups.get(key);

    if (!entry) {
      entry = {
        group: otherGroup,
        requestId,
        allRels: [],
        rightRels: [],
        membershipRels: [],
        structureRel: null,
        rels: [],
        type: relationshipType,
        membershipMode: rel.membership_mode ?? null,
      };
      groups.set(key, entry);
    }

    entry.allRels.push(rel);

    if (isRequestRightRelationship(rel)) {
      entry.rightRels.push(rel);
      entry.rels.push(rel);
    } else if (isRequestMembershipRelationship(rel)) {
      entry.membershipRels.push(rel);
      entry.rels.push(rel);
    } else if (!entry.structureRel) {
      entry.structureRel = rel;
    }

    if (
      (!entry.membershipMode || entry.membershipMode === 'none') &&
      rel.membership_mode !== 'none'
    ) {
      entry.membershipMode = rel.membership_mode;
    }
  });

  return Array.from(groups.values());
}

function countGroupedRequestHeaders(entries: readonly GroupedRelationshipRequest[]) {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    ids.add(entry.requestId ?? `${entry.group.id}:${index}`);
  });
  return ids.size;
}

function toServerFinalizationError(error: unknown) {
  return toAppError(error, 'mutation_server_failed');
}

function trackSubmissionServerFinalization(
  results: MutationResultLike[],
  onError: (error: Error) => void
) {
  if (results.length === 0) {
    return;
  }

  void Promise.all(results.map(result => result.server))
    .then(serverResults => {
      const failed = serverResults.find(serverResult => serverResult.type === 'error');
      if (failed?.type === 'error') {
        onError(
          new Error(
            failed.error?.message ?? 'Die Synchronisierung konnte nicht abgeschlossen werden.'
          )
        );
        return;
      }
    })
    .catch(error => {
      onError(toServerFinalizationError(error));
    });
}

export function useNetworkPage(groupId: string, initialTab?: NetworkTab) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { group } = useGroupData(groupId);
  const { approveGroupConnectionRequest, rejectGroupConnectionRequest, deleteGroupConnection } =
    useGroupConnectionActions();

  const {
    networkData,
    showIndirect,
    setShowIndirect,
    selectedRights,
    toggleRight,
    incomingRequests,
    outgoingRequests,
    allRelationships,
    groupConnections,
    isLoading,
  } = useGroupNetwork(groupId);

  const { canActivateLink } = useHierarchyLinkConflicts(groupId, allRelationships);

  // Tab state
  const [activeTab, setActiveTab] = useState<NetworkTab>(initialTab ?? 'current-network');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Search & filter state for manage tab
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<GroupRelationshipFilter>('all');
  const [manageRightFilter, setManageRightFilter] = useState<Set<string>>(
    new Set(NETWORK_FLOW_FILTER_TYPES)
  );

  const toggleManageRightFilter = useCallback((right: string) => {
    setManageRightFilter(prev => {
      const next = new Set(prev);
      if (next.has(right)) {
        next.delete(right);
      } else {
        next.add(right);
      }
      return next;
    });
  }, []);

  // Group incoming requests by request header
  const groupedIncoming = useMemo(() => {
    return groupRequestRelationships(incomingRequests, groupId);
  }, [incomingRequests, groupId]);

  // Group outgoing requests by request header
  const groupedOutgoing = useMemo(() => {
    return groupRequestRelationships(outgoingRequests, groupId);
  }, [outgoingRequests, groupId]);

  const activeRelationshipSummaries = useMemo(() => {
    return buildActiveRelationshipSummaries(networkData);
  }, [networkData]);

  // Filtered active relationships for manage tab
  const filteredRelationships = useMemo(() => {
    let items = activeRelationshipSummaries;

    if (directionFilter !== 'all') {
      items = items.filter(item => item.type === directionFilter);
    }

    // Filter by right type
    items = items
      .map(item => ({
        ...item,
        rights: item.rights.filter(r => manageRightFilter.has(r)),
      }))
      .filter(item => item.rights.length > 0);

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => {
        const description =
          typeof item.group.description === 'string' ? item.group.description.toLowerCase() : '';

        return item.group.name?.toLowerCase().includes(query) || description.includes(query);
      });
    }

    return items;
  }, [activeRelationshipSummaries, directionFilter, manageRightFilter, searchQuery]);

  // Filtered incoming/outgoing by search and right filters
  const filteredIncoming = useMemo(() => {
    const hasRightFilter = manageRightFilter.size !== NETWORK_FLOW_FILTER_TYPES.length;
    const query = searchQuery.toLowerCase();
    return groupedIncoming
      .filter(entry => !query || entry.group.name?.toLowerCase().includes(query))
      .map(entry => filterGroupedRequestItems(entry, manageRightFilter, hasRightFilter))
      .filter(
        entry =>
          !hasRightFilter ||
          getActionableRequestRels(entry).length > 0 ||
          entry.allRels.every(isRequestStructureRelationship)
      );
  }, [groupedIncoming, searchQuery, manageRightFilter]);

  const filteredOutgoing = useMemo(() => {
    const hasRightFilter = manageRightFilter.size !== NETWORK_FLOW_FILTER_TYPES.length;
    const query = searchQuery.toLowerCase();
    return groupedOutgoing
      .filter(entry => !query || entry.group.name?.toLowerCase().includes(query))
      .map(entry => filterGroupedRequestItems(entry, manageRightFilter, hasRightFilter))
      .filter(
        entry =>
          !hasRightFilter ||
          getActionableRequestRels(entry).length > 0 ||
          entry.allRels.every(isRequestStructureRelationship)
      );
  }, [groupedOutgoing, searchQuery, manageRightFilter]);

  // Handlers
  const handleAcceptRequest = useCallback(
    async (rels: NormalizedGroupRelationship[], submissionContext?: ActionSubmissionContext) => {
      const blocked = rels.filter(rel => !canActivateLink(rel));
      if (blocked.length > 0) {
        toast.error(t('common.network.linkAcceptBlocked'));
        throw new Error('Hierarchy member conflict');
      }

      const rightIdsByRequestId = new Map<string, Set<string>>();
      for (const rel of rels) {
        if (!rel.connection_request_id) {
          continue;
        }

        const rightIds = rightIdsByRequestId.get(rel.connection_request_id) ?? new Set<string>();
        if (rel.grant_id) {
          rightIds.add(rel.grant_id);
        }
        rightIdsByRequestId.set(rel.connection_request_id, rightIds);
      }

      const results: MutationResultLike[] = [];
      for (const [requestId, rightIds] of rightIdsByRequestId.entries()) {
        const result = approveGroupConnectionRequest({
          id: requestId,
          grant_request_ids: [...rightIds],
          approve_membership: rels.some(
            rel => rel.connection_request_id === requestId && isRequestMembershipRelationship(rel)
          ),
        });
        results.push(result);
        await waitForClientApply(result);
      }

      submissionContext?.reportProgress({ key: 'commit', status: 'complete' });
      submissionContext?.reportProgress({
        key: 'sync',
        status: 'active',
        copy: { key: 'common.actionSubmission.steps.link.syncConsequences' },
      });
      trackSubmissionServerFinalization(results, error => {
        toast.error(localizeAppError(error));
      });
    },
    [approveGroupConnectionRequest, canActivateLink, t]
  );

  const handleRejectRequest = useCallback(
    async (rels: NormalizedGroupRelationship[]) => {
      const rightIdsByRequestId = new Map<string, Set<string>>();
      for (const rel of rels) {
        if (!rel.connection_request_id) {
          continue;
        }

        const rightIds = rightIdsByRequestId.get(rel.connection_request_id) ?? new Set<string>();
        if (rel.grant_id) {
          rightIds.add(rel.grant_id);
        }
        rightIdsByRequestId.set(rel.connection_request_id, rightIds);
      }

      for (const [requestId, rightIds] of rightIdsByRequestId.entries()) {
        const result = rejectGroupConnectionRequest({
          id: requestId,
          grant_request_ids: [...rightIds],
          reject_membership: rels.some(
            rel => rel.connection_request_id === requestId && isRequestMembershipRelationship(rel)
          ),
          reject_structure: rels.some(
            rel => rel.connection_request_id === requestId && isRequestStructureRelationship(rel)
          ),
        });
        await waitForClientApply(result);
      }
    },
    [rejectGroupConnectionRequest]
  );

  const handleDeleteRelationship = useCallback(
    async (targetGroupId: string) => {
      const connectionsToDelete = groupConnections.filter(
        link =>
          (link.group_a_id === groupId && link.group_b_id === targetGroupId) ||
          (link.group_a_id === targetGroupId && link.group_b_id === groupId)
      );

      for (const connection of connectionsToDelete) {
        const result = deleteGroupConnection({ id: connection.id, acting_group_id: groupId });
        await waitForClientApply(result);
      }
    },
    [deleteGroupConnection, groupId, groupConnections]
  );

  // Workflow editor
  const workflowEditor = useWorkflowEditor(groupId);
  const workflowActions = useWorkflowActions();

  const handleSaveWorkflow = useCallback(
    async (submissionContext?: ActionSubmissionContext) => {
      if (!authUser?.id) return;
      await workflowEditor.saveWorkflow(authUser.id, submissionContext);
    },
    [authUser?.id, workflowEditor]
  );

  const handleApproveWorkflowApproval = useCallback(
    async (approvalId: string, submissionContext?: ActionSubmissionContext) => {
      const result = workflowActions.approveWorkflowApproval(approvalId);
      await waitForClientApply(result);
      submissionContext?.reportProgress({ key: 'commit', status: 'complete' });
      submissionContext?.reportProgress({ key: 'sync', status: 'active' });
      if (submissionContext) {
        trackServerFinalization(result, {
          onError: error => toast.error(localizeAppError(error)),
        });
      }
    },
    [workflowActions]
  );

  const handleRejectWorkflowApproval = useCallback(
    async (approvalId: string, submissionContext?: ActionSubmissionContext) => {
      const result = workflowActions.rejectWorkflowApproval(approvalId);
      await waitForClientApply(result);
      submissionContext?.reportProgress({ key: 'commit', status: 'complete' });
      submissionContext?.reportProgress({ key: 'sync', status: 'active' });
      if (submissionContext) {
        trackServerFinalization(result, {
          onError: error => toast.error(localizeAppError(error)),
        });
      }
    },
    [workflowActions]
  );

  // Collect all groups for workflow step selection
  const { groups: allGroupsRaw } = useAllGroups();
  const availableGroups = useMemo(() => {
    const groupsById = new Map(
      allGroupsRaw.map(g => [
        g.id,
        {
          id: g.id,
          name: g.name,
          description: g.description,
          group_type: g.group_type,
          member_count: g.member_count,
          event_count: g.event_count,
          amendment_count: g.amendment_count,
        },
      ])
    );

    // The workflow editor must always be able to pick the current page group as a start node.
    if (group?.id && !groupsById.has(group.id)) {
      groupsById.set(group.id, {
        id: group.id,
        name: group.name ?? null,
        description: group.description ?? null,
        group_type: group.group_type ?? 'base',
        member_count: group.member_count ?? 0,
        event_count: group.event_count ?? 0,
        amendment_count: group.amendment_count ?? 0,
      });
    }

    return Array.from(groupsById.values())
      .map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        group_type: g.group_type,
        member_count: g.member_count,
        event_count: g.event_count,
        amendment_count: g.amendment_count,
      }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [allGroupsRaw, group]);

  const workflowIncomingRequests = useMemo(
    () =>
      workflowEditor.workflows.filter(workflow =>
        (workflow.approvals ?? []).some(
          (approval: WorkflowWithStepsRow['approvals'][number]) =>
            approval.group_id === groupId && approval.status === 'pending'
        )
      ),
    [groupId, workflowEditor.workflows]
  );

  const workflowOutgoingRequests = useMemo(
    () =>
      workflowEditor.workflows.filter(workflow =>
        (workflow.approvals ?? []).some(
          (approval: WorkflowWithStepsRow['approvals'][number]) =>
            approval.requested_by_group_id === groupId &&
            approval.group_id !== groupId &&
            (approval.status === 'pending' || approval.status === 'rejected')
        )
      ),
    [groupId, workflowEditor.workflows]
  );

  const workflowAcceptedPendingRequests = useMemo(
    () =>
      workflowEditor.workflows.filter(workflow => {
        const approvals = workflow.approvals ?? [];
        const currentGroupApproval = approvals.find(
          (approval: WorkflowWithStepsRow['approvals'][number]) =>
            approval.group_id === groupId && approval.status === 'accepted'
        );
        const isOutgoingFromCurrentGroup = approvals.some(
          (approval: WorkflowWithStepsRow['approvals'][number]) =>
            approval.requested_by_group_id === groupId && approval.group_id !== groupId
        );

        return (
          workflow.status === 'pending_approval' &&
          Boolean(currentGroupApproval) &&
          !isOutgoingFromCurrentGroup
        );
      }),
    [groupId, workflowEditor.workflows]
  );

  const workflowActiveRelevant = useMemo(
    () =>
      workflowEditor.workflows.filter(
        workflow =>
          workflow.status === 'active' &&
          (workflow.approvals ?? []).some(
            (approval: WorkflowWithStepsRow['approvals'][number]) =>
              approval.group_id === groupId && approval.status === 'accepted'
          )
      ),
    [groupId, workflowEditor.workflows]
  );

  return {
    // Auth
    authUser,
    // Group
    group,
    groupId,
    groupName: group?.name || 'Group',
    isLoading,

    // Tab
    activeTab,
    setActiveTab,

    // Network graph (for current-network tab)
    networkData,
    showIndirect,
    setShowIndirect,
    selectedRights,
    toggleRight,

    // Manage tab data
    searchQuery,
    setSearchQuery,
    directionFilter,
    setDirectionFilter,
    manageRightFilter,
    toggleManageRightFilter,

    // Relationships
    allRelationships,
    filteredRelationships,
    filteredIncoming,
    filteredOutgoing,
    incomingRequestCount: countGroupedRequestHeaders(filteredIncoming),
    outgoingRequestCount: countGroupedRequestHeaders(filteredOutgoing),

    // Handlers
    handleAcceptRequest,
    handleRejectRequest,
    handleDeleteRelationship,

    // Workflows
    workflows: workflowEditor.workflows,
    allWorkflows: workflowEditor.allWorkflows,
    workflowsLoading: workflowEditor.isLoading,
    workflowIncomingRequests,
    workflowOutgoingRequests,
    workflowAcceptedPendingRequests,
    workflowActiveRelevant,
    isWorkflowEditorOpen: workflowEditor.isEditorOpen,
    editingWorkflow: workflowEditor.editingWorkflow,
    workflowDraftStartGroupId: workflowEditor.draftStartGroupId,
    setWorkflowDraftStartGroupId: workflowEditor.setDraftStartGroupId,
    workflowDraftName: workflowEditor.draftName,
    setWorkflowDraftName: workflowEditor.setDraftName,
    workflowDraftDescription: workflowEditor.draftDescription,
    setWorkflowDraftDescription: workflowEditor.setDraftDescription,
    workflowDraftIsDefaultEntry: workflowEditor.draftIsDefaultEntry,
    setWorkflowDraftIsDefaultEntry: workflowEditor.setDraftIsDefaultEntry,
    workflowDraftSteps: workflowEditor.draftSteps,
    availableGroups,
    availableWorkflows: workflowEditor.allWorkflows,
    openNewWorkflow: workflowEditor.openNewWorkflow,
    openEditWorkflow: workflowEditor.openEditWorkflow,
    closeWorkflowEditor: workflowEditor.closeEditor,
    addWorkflowStep: workflowEditor.addDraftStep,
    updateWorkflowStepDraft: workflowEditor.updateDraftStep,
    removeWorkflowStep: workflowEditor.removeDraftStep,
    moveWorkflowStep: workflowEditor.moveDraftStep,
    handleSaveWorkflow,
    handleDeleteWorkflow: workflowEditor.deleteWorkflow,
    handleApproveWorkflowApproval,
    handleRejectWorkflowApproval,
  };
}
