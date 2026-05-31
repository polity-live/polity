import { useState, useMemo, useCallback } from 'react';
import { useGroupNetwork } from './useGroupNetwork';
import { useGroupData } from '@/features/groups/hooks/useGroupData';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { useAuth } from '@/providers/auth-provider';
import { RIGHT_TYPES } from '@/features/network/ui/RightFilters';
import { useWorkflowEditor } from './useWorkflowEditor';
import { useHierarchyLinkConflicts } from './useHierarchyLinkConflicts';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { getRelationshipTypeForGroup } from '../logic/groupRelationshipOrientation';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type {
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  GroupedRelationshipSummary,
  NetworkTab,
  NormalizedGroupRelationship,
} from '../types/network.types';

export function useNetworkPage(groupId: string) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { group } = useGroupData(groupId);
  const { updateRelationship, deleteRelationship } = useGroupActions();

  const {
    networkData,
    showIndirect,
    setShowIndirect,
    selectedRights,
    toggleRight,
    activeRelationships,
    incomingRequests,
    outgoingRequests,
    allRelationships,
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
        };
        groups.set(otherGroup.id, entry);
      }
      entry.rels.push(rel);
    });
    return Array.from(groups.values());
  }, [outgoingRequests, groupId]);

  // Filtered active relationships for manage tab
  const filteredRelationships = useMemo(() => {
    let items: GroupedRelationshipSummary[] = [];

    if (directionFilter !== 'child') {
      items = [
        ...items,
        ...networkData.parents.map(item => ({
          group: item.group,
          rights: item.rights,
          type: 'parent' as const,
        })),
      ];
    }
    if (directionFilter !== 'parent') {
      items = [
        ...items,
        ...networkData.children.map(item => ({
          group: item.group,
          rights: item.rights,
          type: 'child' as const,
        })),
      ];
    }
    if (directionFilter !== 'sibling') {
      items = [
        ...items,
        ...networkData.siblings.map(item => ({
          group: item.group,
          rights: item.rights,
          type: 'sibling' as const,
        })),
      ];
    }

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
  }, [networkData, directionFilter, manageRightFilter, searchQuery]);

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

      for (const rel of rels) {
        const result = updateRelationship({ id: rel.id, status: 'active' });
        await serverConfirmed(result);
      }
    },
    [canActivateLink, updateRelationship, t]
  );

  const handleRejectRequest = useCallback(
    async (rels: NormalizedGroupRelationship[]) => {
      for (const rel of rels) {
        const result = deleteRelationship({ id: rel.id });
        if (result) {
          await serverConfirmed(result);
        }
      }
    },
    [deleteRelationship]
  );

  const handleDeleteRelationship = useCallback(
    async (targetGroupId: string) => {
      const rels = activeRelationships.filter(
        rel =>
          (rel.group?.id === groupId && rel.related_group?.id === targetGroupId) ||
          (rel.related_group?.id === groupId && rel.group?.id === targetGroupId)
      );
      for (const rel of rels) {
        const result = deleteRelationship({ id: rel.id });
        if (result) {
          await serverConfirmed(result);
        }
      }
    },
    [activeRelationships, groupId, deleteRelationship]
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
      .map(g => ({ id: g.id, name: g.name }))
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
