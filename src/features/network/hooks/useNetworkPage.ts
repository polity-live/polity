import { useState, useMemo, useCallback } from 'react';
import { useGroupNetwork } from './useGroupNetwork';
import { useGroupData } from '@/features/groups/hooks/useGroupData';
import { useNetworkLinkActions } from '@/zero/network';
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
import type {
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  NetworkTab,
  NormalizedGroupRelationship,
} from '../types/network.types';

export function useNetworkPage(groupId: string) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { group } = useGroupData(groupId);
  const { approveNetworkLinkChangeRequest, rejectNetworkLinkChangeRequest, deleteNetworkLink } =
    useNetworkLinkActions();

  const {
    networkData,
    showIndirect,
    setShowIndirect,
    selectedRights,
    toggleRight,
    incomingRequests,
    outgoingRequests,
    allRelationships,
    groupLinks,
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

  // Group incoming requests by source group
  const groupedIncoming = useMemo(() => {
    const groups = new Map<string, GroupedRelationshipRequest>();
    incomingRequests.forEach(rel => {
      const otherGroup = rel.group?.id === groupId ? rel.related_group : rel.group;
      const relationshipType = getRelationshipTypeForGroup(rel, groupId);
      if (!otherGroup) return;
      if (!relationshipType) return;

      let entry = groups.get(otherGroup.id);
      if (!entry) {
        entry = {
          group: otherGroup,
          rels: [],
          type: relationshipType,
          membershipMode: rel.membership_mode ?? null,
        };
        groups.set(otherGroup.id, entry);
      }
      entry.rels.push(rel);
    });
    return Array.from(groups.values());
  }, [incomingRequests, groupId]);

  // Group outgoing requests by target group
  const groupedOutgoing = useMemo(() => {
    const groups = new Map<string, GroupedRelationshipRequest>();
    outgoingRequests.forEach(rel => {
      const otherGroup = rel.group?.id === groupId ? rel.related_group : rel.group;
      const relationshipType = getRelationshipTypeForGroup(rel, groupId);
      if (!otherGroup) return;
      if (!relationshipType) return;

      let entry = groups.get(otherGroup.id);
      if (!entry) {
        entry = {
          group: otherGroup,
          rels: [],
          type: relationshipType,
          membershipMode: rel.membership_mode ?? null,
        };
        groups.set(otherGroup.id, entry);
      }
      entry.rels.push(rel);
    });
    return Array.from(groups.values());
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
    if (!searchQuery.trim() && manageRightFilter.size === RIGHT_TYPES.length)
      return groupedIncoming;

    const query = searchQuery.toLowerCase();
    return groupedIncoming
      .map(entry => ({
        ...entry,
        rels: entry.rels.filter(rel => manageRightFilter.has(rel.with_right ?? '')),
      }))
      .filter(
        entry =>
          entry.rels.length > 0 && (!query || entry.group.name?.toLowerCase().includes(query))
      );
  }, [groupedIncoming, searchQuery, manageRightFilter]);

  const filteredOutgoing = useMemo(() => {
    if (!searchQuery.trim() && manageRightFilter.size === RIGHT_TYPES.length)
      return groupedOutgoing;

    const query = searchQuery.toLowerCase();
    return groupedOutgoing
      .map(entry => ({
        ...entry,
        rels: entry.rels.filter(rel => manageRightFilter.has(rel.with_right ?? '')),
      }))
      .filter(
        entry =>
          entry.rels.length > 0 && (!query || entry.group.name?.toLowerCase().includes(query))
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
        if (!rel.network_link_request_id) {
          continue;
        }

        const rightIds = rightIdsByRequestId.get(rel.network_link_request_id) ?? new Set<string>();
        rightIds.add(rel.network_link_right_id);
        rightIdsByRequestId.set(rel.network_link_request_id, rightIds);
      }

      for (const [requestId, rightIds] of rightIdsByRequestId.entries()) {
        const result = approveNetworkLinkChangeRequest({
          id: requestId,
          right_ids: [...rightIds],
        });
        await serverConfirmed(result);
      }
    },
    [approveNetworkLinkChangeRequest, canActivateLink, t]
  );

  const handleRejectRequest = useCallback(
    async (rels: NormalizedGroupRelationship[]) => {
      const rightIdsByRequestId = new Map<string, Set<string>>();
      for (const rel of rels) {
        if (!rel.network_link_request_id) {
          continue;
        }

        const rightIds = rightIdsByRequestId.get(rel.network_link_request_id) ?? new Set<string>();
        rightIds.add(rel.network_link_right_id);
        rightIdsByRequestId.set(rel.network_link_request_id, rightIds);
      }

      for (const [requestId, rightIds] of rightIdsByRequestId.entries()) {
        const result = rejectNetworkLinkChangeRequest({
          id: requestId,
          right_ids: [...rightIds],
        });
        await serverConfirmed(result);
      }
    },
    [rejectNetworkLinkChangeRequest]
  );

  const handleDeleteRelationship = useCallback(
    async (targetGroupId: string) => {
      const linksToDelete = groupLinks.filter(
        link =>
          (link.source_group_id === groupId && link.target_group_id === targetGroupId) ||
          (link.source_group_id === targetGroupId && link.target_group_id === groupId)
      );

      for (const link of linksToDelete) {
        const result = deleteNetworkLink({ id: link.id });
        await serverConfirmed(result);
      }
    },
    [deleteNetworkLink, groupId, groupLinks]
  );

  // Workflow editor
  const workflowEditor = useWorkflowEditor(groupId);

  const handleSaveWorkflow = useCallback(async () => {
    if (!authUser?.id) return;
    await workflowEditor.saveWorkflow(authUser.id);
  }, [authUser?.id, workflowEditor]);

  // Collect all groups for workflow step selection
  const { groups: allGroupsRaw } = useAllGroups();
  const availableGroups = useMemo(() => {
    return allGroupsRaw
      .map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        member_count: g.member_count,
        event_count: g.event_count,
        amendment_count: g.amendment_count,
      }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [allGroupsRaw]);

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

    // Handlers
    handleAcceptRequest,
    handleRejectRequest,
    handleDeleteRelationship,

    // Workflows
    workflows: workflowEditor.workflows,
    workflowsLoading: workflowEditor.isLoading,
    isWorkflowEditorOpen: workflowEditor.isEditorOpen,
    editingWorkflow: workflowEditor.editingWorkflow,
    workflowDraftName: workflowEditor.draftName,
    setWorkflowDraftName: workflowEditor.setDraftName,
    workflowDraftDescription: workflowEditor.draftDescription,
    setWorkflowDraftDescription: workflowEditor.setDraftDescription,
    workflowDraftSteps: workflowEditor.draftSteps,
    availableGroups,
    openNewWorkflow: workflowEditor.openNewWorkflow,
    openEditWorkflow: workflowEditor.openEditWorkflow,
    closeWorkflowEditor: workflowEditor.closeEditor,
    addWorkflowStep: workflowEditor.addDraftStep,
    removeWorkflowStep: workflowEditor.removeDraftStep,
    moveWorkflowStep: workflowEditor.moveDraftStep,
    handleSaveWorkflow,
    handleDeleteWorkflow: workflowEditor.deleteWorkflow,
  };
}
