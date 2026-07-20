'use client';
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { NormalizedGroupRelationship } from '../types/network.types';
import type { HierarchyConflictUser } from '../hooks/useHierarchyLinkConflicts';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import type { GroupConflictPreflightInput } from '@/features/groups/logic/groupConflictPreflight';
import { canonicalGroupPair } from '../logic/groupConnectionComposer';
function buildGroupConnectionPreflightFromRelationships(
  relationships: readonly NormalizedGroupRelationship[]
): GroupConflictPreflightInput | null {
  const firstRelationship = relationships[0];
  if (!firstRelationship) {
    return null;
  }

  const grants = relationships.flatMap(relationship => {
    if (!relationship.with_right || !relationship.grant_id) {
      return [];
    }
    return [
      {
        id: relationship.grant_id,
        right_key: relationship.with_right as
          | 'informationRight'
          | 'amendmentRight'
          | 'rightToSpeak'
          | 'activeVotingRight'
          | 'passiveVotingRight',
        holder_group_id: relationship.group_id,
        scope_group_id: relationship.related_group_id,
        status: relationship.status === 'rejected' ? ('rejected' as const) : ('active' as const),
        initiator_group_id: relationship.initiator_group_id ?? null,
      },
    ];
  });

  if (grants.length === 0) {
    return null;
  }

  const pair = canonicalGroupPair(firstRelationship.group_id, firstRelationship.related_group_id);
  const hasMembership =
    firstRelationship.membership_mode !== 'none' &&
    firstRelationship.member_source_group_id != null &&
    firstRelationship.member_target_group_id != null;

  return {
    kind: 'group_connection_upsert' as const,
    connection_id: firstRelationship.connection_id,
    ...pair,
    connection_type: firstRelationship.connection_type,
    parent_group_id: firstRelationship.parent_group_id,
    child_group_id: firstRelationship.child_group_id,
    grants,
    membership_rule: hasMembership
      ? {
          member_source_group_id: firstRelationship.member_source_group_id as string,
          member_target_group_id: firstRelationship.member_target_group_id as string,
          membership_mode: firstRelationship.membership_mode as
            'all_members' | 'role_members' | 'selected_source_groups',
          required_source_role_id: firstRelationship.required_source_role_id,
          eligible_origin_group_ids: firstRelationship.eligible_origin_group_ids,
        }
      : null,
  };
}
interface HierarchyConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  otherGroupName: string;
  relationships: NormalizedGroupRelationship[];
  affectedUsers: HierarchyConflictUser[];
  partnerUsers: HierarchyConflictUser[];
  canAccept: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

export function useHierarchyConflictDialogController({
  open,
  onOpenChange,
  groupName,
  otherGroupName,
  relationships,
  affectedUsers,
  partnerUsers,
  canAccept,
  onAccept,
  onReject,
}: HierarchyConflictDialogProps) {
  const { t } = useTranslation();

  const navigate = useNavigate();

  const { leaveGroup } = useGroupActions();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const relationshipPreflightInput = useMemo(
    () => (open ? buildGroupConnectionPreflightFromRelationships(relationships) : null),
    [open, relationships]
  );

  const relationshipPreflight = useGroupConflictPreflight(relationshipPreflightInput, {
    enabled: open && relationshipPreflightInput != null,
  });

  const rightsLabel = useMemo(
    () =>
      relationships
        .map(rel => rel.with_right)
        .filter(Boolean)
        .join(', '),
    [relationships]
  );

  const hasStructuredConflicts = relationshipPreflight.response.conflicts.length > 0;

  const hasFallbackConflictUsers = affectedUsers.length > 0 || partnerUsers.length > 0;

  const handleMessage = (user: HierarchyConflictUser) => {
    navigate({
      to: '/messages',
      search: {
        userId: user.userId,
        name: user.displayName,
      },
    });
    onOpenChange(false);
  };

  const handleRemoveFromGroup = async (user: HierarchyConflictUser) => {
    if (!user.membershipIdInCurrentGroup) {
      toast.error(t('common.network.conflictUserNotInGroup'));
      return;
    }

    setRemovingUserId(user.userId);
    try {
      await leaveGroup({ id: user.membershipIdInCurrentGroup });
      toast.success(t('common.network.conflictUserRemoved'));
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(t('common.network.conflictUserRemoveFailed'));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAccept = async () => {
    if (!canAccept || relationshipPreflight.blocking || relationshipPreflight.isLoading) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAccept();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const affectedMembersDescription = t('common.network.affectedMembersDescription');

  const futurePartnersDescription = t('common.network.futurePartnersDescription', {
    groupName: otherGroupName,
  });

  return {
    open,
    onOpenChange,
    groupName,
    otherGroupName,
    relationships,
    affectedUsers,
    partnerUsers,
    canAccept,
    onAccept,
    onReject,
    t,
    navigate,
    leaveGroup,
    isSubmitting,
    setIsSubmitting,
    removingUserId,
    setRemovingUserId,
    relationshipPreflightInput,
    relationshipPreflight,
    rightsLabel,
    hasStructuredConflicts,
    hasFallbackConflictUsers,
    handleMessage,
    handleRemoveFromGroup,
    handleAccept,
    handleReject,
    affectedMembersDescription,
    futurePartnersDescription,
  };
}
