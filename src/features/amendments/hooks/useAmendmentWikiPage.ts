import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useSubscribeAmendment } from './useSubscribeAmendment';
import { useAmendmentCollaboration } from './useAmendmentCollaboration';
import { useCloneAmendment } from './useCloneAmendment';
import {
  deriveVoteState,
  getSupportStatus,
  AMENDMENT_STATUS_COLORS,
} from '../logic/amendmentHelpers';
import { notifyAmendmentVoted } from '@/features/notifications/utils/notification-helpers.ts';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import type { VoteValue } from '@/features/shared/ui/voting/VoteButtons';
import type { SupporterMapItem } from '../ui/SupporterLocalityMap';

export function useAmendmentWikiPage(amendmentId: string) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Subscribe hook
  const subscribeData = useSubscribeAmendment(amendmentId);

  // Collaboration hook
  const collaborationData = useAmendmentCollaboration(amendmentId);

  const { supportAmendment, updateSupportVote, deleteSupportVote } = useAmendmentActions();

  // All data via facade
  const facadeResult = useAmendmentState({
    amendmentId,
    userId: user?.id,
    includeFullRelations: true,
    includeClones: true,
    includeRoles: true,
    includeNetworkData: true,
    includeUserMemberships: !!user?.id,
    includeAllUsers: !!user?.id,
  });

  const amendment = facadeResult.amendmentFull;

  const networkData = useMemo(
    () => ({
      groupMemberships: [
        ...(facadeResult.userMemberships ?? []),
        ...(facadeResult.allGroupMemberships ?? []),
      ],
      groups: facadeResult.allGroups ?? [],
      groupRelationships: facadeResult.allGroupRelationships ?? [],
      events: facadeResult.allEvents ?? [],
    }),
    [
      facadeResult.userMemberships,
      facadeResult.allGroupMemberships,
      facadeResult.allGroups,
      facadeResult.allGroupRelationships,
      facadeResult.allEvents,
    ]
  );

  // Clone hook (needs networkData + selectedTargetGroupId for event queries)
  const cloneData = useCloneAmendment(amendmentId, amendment, user?.id, user?.email);

  const usersData = useMemo(
    () => ({
      $users: facadeResult.allUsers ?? [],
    }),
    [facadeResult.allUsers]
  );

  // Derived data
  const collaborators = amendment?.collaborators || [];
  const supportingGroups = amendment?.support_confirmations || [];
  const supportConfirmations = amendment?.support_confirmations || [];
  const clones = facadeResult.clones ?? [];
  const clonedFrom = amendment?.clone_source;
  const totalSupportingMembers = supportingGroups.reduce(
    (sum: number, confirmation) => sum + Math.max(0, confirmation.group?.member_count ?? 0),
    0
  );
  const targetCollaborator = undefined as { imageURL?: string; name?: string } | undefined;
  const targetGroup = amendment?.group;
  const currentProcessRun = amendment?.current_process_run ?? null;
  const implementationStatus = currentProcessRun?.implementation_status ?? null;
  const evaluationTask =
    currentProcessRun?.tasks?.find(task => task.task_type === 'implementation_evaluation') ?? null;
  const evaluationDueDate = evaluationTask?.due_at ?? currentProcessRun?.evaluation_date ?? null;

  const isAdmin = collaborationData.status === 'admin';

  const voteState = useMemo(
    () =>
      amendment
        ? deriveVoteState(amendment, user?.id)
        : {
            score: 0,
            upvotes: 0,
            downvotes: 0,
            supporterCount: 0,
            userVote: undefined,
            currentVoteValue: 0 as VoteValue,
            hasUpvoted: false,
            hasDownvoted: false,
          },
    [amendment, user?.id]
  );

  const handleVote = async (voteValue: VoteValue) => {
    if (!user?.id) {
      toast.error('Please log in to vote');
      return;
    }
    if (!amendment) {
      toast.error('Amendment not found');
      return;
    }

    try {
      if (voteState.userVote) {
        if (voteState.currentVoteValue === voteValue) {
          await deleteSupportVote(voteState.userVote.id);
        } else {
          await updateSupportVote({ id: voteState.userVote.id, vote: voteValue });
        }
      } else {
        await supportAmendment({
          id: crypto.randomUUID(),
          amendment_id: amendmentId,
          vote: voteValue,
        });

        const adminCollab = collaborators.find(c => c.status === 'admin');
        const authorUserId = adminCollab?.user?.id;
        if (authorUserId && authorUserId !== user.id) {
          await notifyAmendmentVoted({
            senderId: user.id,
            senderName: user.email || 'Someone',
            recipientUserId: authorUserId,
            amendmentId,
            amendmentTitle: amendment.title ?? '',
            voteType: voteValue === 1 ? 'upvote' : 'downvote',
          });
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    }
  };

  const getSupportStatusForGroup = (groupId: string) =>
    getSupportStatus(
      groupId,
      supportConfirmations.map(sc => ({
        group: sc.group_id ? { id: sc.group_id } : undefined,
        status: sc.status ?? undefined,
      }))
    );

  const supporterMapItems = useMemo<SupporterMapItem[]>(
    () =>
      supportingGroups
        .filter(
          confirmation =>
            confirmation.group?.id &&
            confirmation.group?.latitude != null &&
            confirmation.group?.longitude != null &&
            getSupportStatusForGroup(confirmation.group.id) !== 'declined'
        )
        .map(confirmation => ({
          id: confirmation.group?.id ?? confirmation.id,
          name: confirmation.group?.name ?? 'Unbenannte Gruppe',
          latitude: confirmation.group?.latitude ?? 0,
          longitude: confirmation.group?.longitude ?? 0,
          groupHref: `/group/${confirmation.group?.id}`,
          decisionHref: `/amendment/${amendmentId}`,
        })),
    [amendmentId, supportingGroups]
  );

  // Visibility access check
  const canAccess = checkEntityAccess(
    amendment?.visibility,
    !!user,
    collaborationData.isCollaborator || collaborationData.isAdmin
  );

  return {
    // Navigation
    navigate,
    user,

    // Access
    canAccess,

    // Subscribe
    ...subscribeData,

    // Collaboration
    collaboration: collaborationData,

    // Amendment data
    amendment,
    roles: facadeResult.roles,
    isLoading: facadeResult.isLoading,
    isAdmin,
    collaborators,
    supportingGroups,
    clones,
    clonedFrom,
    totalSupportingMembers,
    targetCollaborator,
    targetGroup,
    currentProcessRun,
    implementationStatus,
    evaluationDueDate,
    supporterMapItems,

    // Vote
    ...voteState,
    handleVote,

    // Clone
    ...cloneData,
    networkData,
    usersData,

    // Helpers
    getSupportStatus: getSupportStatusForGroup,
    statusColors: AMENDMENT_STATUS_COLORS,
  };
}
