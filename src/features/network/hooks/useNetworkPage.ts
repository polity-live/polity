import { useState, useMemo, useCallback } from 'react';
import { useGroupNetwork } from './useGroupNetwork';
import { useGroupData } from '@/features/groups/hooks/useGroupData';
import { useGroupConnectionActions, useWorkflowActions } from '@/zero/network';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { useAuth } from '@/providers/auth-provider';
import { RIGHT_TYPES } from '@/features/network/ui/RightFilters';
import { useWorkflowEditor } from './useWorkflowEditor';
import { useHierarchyLinkConflicts } from './useHierarchyLinkConflicts';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { getRelationshipTypeForGroup } from '../logic/groupRelationshipOrientation';
import { buildActiveRelationshipSummaries } from '../logic/relationshipSummaryHelpers';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type {
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  NetworkTab,
  NormalizedGroupRelationship,
} from '../types/network.types';

function isRequestRightRelationship(rel: NormalizedGroupRelationship) {
  return Boolean(rel.grant_id && rel.with_right);
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

export function useNetworkPage(groupId: string) {
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
  const [activeTab, setActiveTab] = useState<NetworkTab>('current-network');

  // Search & filter state for manage tab
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<GroupRelationshipFilter>('all');
  const [manageRightFilter, setManageRightFilter] = useState<Set<string>>(new Set(RIGHT_TYPES));

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
    const hasRightFilter = manageRightFilter.size !== RIGHT_TYPES.length;
    const query = searchQuery.toLowerCase();
    return groupedIncoming
      .filter(entry => !query || entry.group.name?.toLowerCase().includes(query))
      .map(entry => ({
        ...entry,
        rightRels: hasRightFilter
          ? entry.rightRels.filter(rel => manageRightFilter.has(rel.with_right ?? ''))
          : entry.rightRels,
        rels: hasRightFilter
          ? entry.rightRels.filter(rel => manageRightFilter.has(rel.with_right ?? ''))
          : entry.rightRels,
      }))
      .filter(
        entry =>
          !hasRightFilter ||
          entry.rightRels.length > 0 ||
          entry.allRels.every(rel => !isRequestRightRelationship(rel))
      );
  }, [groupedIncoming, searchQuery, manageRightFilter]);

  const filteredOutgoing = useMemo(() => {
    const hasRightFilter = manageRightFilter.size !== RIGHT_TYPES.length;
    const query = searchQuery.toLowerCase();
    return groupedOutgoing
      .filter(entry => !query || entry.group.name?.toLowerCase().includes(query))
      .map(entry => ({
        ...entry,
        rightRels: hasRightFilter
          ? entry.rightRels.filter(rel => manageRightFilter.has(rel.with_right ?? ''))
          : entry.rightRels,
        rels: hasRightFilter
          ? entry.rightRels.filter(rel => manageRightFilter.has(rel.with_right ?? ''))
          : entry.rightRels,
      }))
      .filter(
        entry =>
          !hasRightFilter ||
          entry.rightRels.length > 0 ||
          entry.allRels.every(rel => !isRequestRightRelationship(rel))
      );
  }, [groupedOutgoing, searchQuery, manageRightFilter]);

  // Handlers
  const handleAcceptRequest = useCallback(
    async (rels: NormalizedGroupRelationship[]) => {
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

      for (const [requestId, rightIds] of rightIdsByRequestId.entries()) {
        const result = approveGroupConnectionRequest({
          id: requestId,
          grant_request_ids: [...rightIds],
          approve_membership: rels.some(
            rel => rel.connection_request_id === requestId && rel.membership_mode !== 'none'
          ),
        });
        await serverConfirmed(result);
      }
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
            rel => rel.connection_request_id === requestId && rel.membership_mode !== 'none'
          ),
          reject_structure: rels.some(
            rel => rel.connection_request_id === requestId && !isRequestRightRelationship(rel)
          ),
        });
        await serverConfirmed(result);
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
        const result = deleteGroupConnection({ id: connection.id });
        await serverConfirmed(result);
      }
    },
    [deleteGroupConnection, groupId, groupConnections]
  );

  // Workflow editor
  const workflowEditor = useWorkflowEditor(groupId);
  const workflowActions = useWorkflowActions();

  const handleSaveWorkflow = useCallback(async () => {
    if (!authUser?.id) return;
    await workflowEditor.saveWorkflow(authUser.id);
  }, [authUser?.id, workflowEditor]);

  const handleApproveWorkflowApproval = useCallback(
    async (approvalId: string) => {
      const result = workflowActions.approveWorkflowApproval(approvalId);
      await serverConfirmed(result);
    },
    [workflowActions]
  );

  const handleRejectWorkflowApproval = useCallback(
    async (approvalId: string) => {
      const result = workflowActions.rejectWorkflowApproval(approvalId);
      await serverConfirmed(result);
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
