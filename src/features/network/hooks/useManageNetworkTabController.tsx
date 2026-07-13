import { useMemo, useState } from 'react';
import type { ActionSubmissionContext } from '@/features/shared/ui/action-submission';
import { useHierarchyLinkConflicts } from './useHierarchyLinkConflicts';
import type {
  GroupRelationshipFilter,
  GroupedRelationshipRequest,
  GroupedRelationshipSummary,
  NetworkGroupEntity,
  NormalizedGroupRelationship,
} from '../types/network.types';

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

export function useManageNetworkTabController({
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
}: ManageNetworkTabProps) {
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

  return {
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
    virtualize,
    manageDialog,
    setManageDialog,
    canActivateLink,
    isLinkCheckApplicable,
    manageDialogAffectedUsers,
    manageDialogPartnerUsers,
    manageDialogCanAccept,
  };
}
