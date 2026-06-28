import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useSubscribeAmendment } from './useSubscribeAmendment';
import { useAmendmentCollaboration } from './useAmendmentCollaboration';
import { useCloneAmendment } from './useCloneAmendment';
import { deriveVoteState, AMENDMENT_STATUS_COLORS } from '../logic/amendmentHelpers';
import {
  deriveImplementationDisplayStatus,
  formatImplementationEvaluationDate,
  formatImplementationEvaluationSummary,
  getImplementationEvaluationModeLabel,
  getImplementationReviewOutcomeLabel,
  normalizeAmendmentProcessStatus,
  normalizeImplementationEvaluationMode,
  normalizeImplementationEvaluationStatus,
  resolveImplementationReviewVoteOutcome,
} from '../logic/implementationEvaluation';
import {
  deriveSupporterDirectoryItems,
  deriveSupporterMapItems,
  type SupporterMapItem,
} from '../logic/supporterDirectory';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import type { VoteValue } from '@/features/shared/ui/voting/VoteButtons';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

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
  const supportConfirmations = amendment?.support_confirmations || [];
  const supporterDirectoryItems = useMemo(
    () =>
      deriveSupporterDirectoryItems({
        groupDecisions: amendment?.group_decisions,
        supportConfirmations,
      }),
    [amendment?.group_decisions, supportConfirmations]
  );
  const supportingGroupCount = supporterDirectoryItems.length;
  const clones = facadeResult.clones ?? [];
  const clonedFrom = amendment?.clone_source;
  const totalSupportingMembers = supporterDirectoryItems.reduce(
    (sum: number, supporter) => sum + supporter.memberCount,
    0
  );
  const targetCollaborator = undefined as { imageURL?: string; name?: string } | undefined;
  const currentProcessRun = amendment?.current_process_run ?? null;
  const targetGroup = currentProcessRun?.selected_target_group ?? amendment?.group;
  const evaluationMode = normalizeImplementationEvaluationMode(
    currentProcessRun?.evaluation_mode ?? null
  );
  const processStatus = normalizeAmendmentProcessStatus(currentProcessRun?.status ?? null);
  const implementationStatus = normalizeImplementationEvaluationStatus(
    currentProcessRun?.implementation_status ?? null
  );
  const evaluationTask =
    currentProcessRun?.tasks?.find(task => task.task_type === 'implementation_evaluation') ?? null;
  const evaluationAgendaItem = evaluationTask?.agenda_item ?? null;
  const evaluationEvent = evaluationTask?.event ?? null;
  const evaluationVote = evaluationAgendaItem?.votes?.[0] ?? null;
  const evaluationDueDate = evaluationTask?.due_at ?? currentProcessRun?.evaluation_date ?? null;
  const evaluationModeLabel = getImplementationEvaluationModeLabel(evaluationMode);
  const evaluationConfigurationSummary = formatImplementationEvaluationSummary({
    mode: evaluationMode,
    fixedDate:
      evaluationMode === 'fixed_date' ? (currentProcessRun?.evaluation_date ?? null) : null,
    offsetMonths: currentProcessRun?.evaluation_offset_months ?? null,
    offsetYears: currentProcessRun?.evaluation_offset_years ?? null,
  });
  const evaluationDueDateLabel = formatImplementationEvaluationDate(evaluationDueDate);
  const implementationDisplayStatus = deriveImplementationDisplayStatus({
    processStatus,
    implementationStatus,
  });
  const evaluationVoteOutcome = resolveImplementationReviewVoteOutcome(evaluationVote);
  const evaluationVoteOutcomeLabel = getImplementationReviewOutcomeLabel(evaluationVoteOutcome);
  const hasImplementationEvaluation =
    Boolean(evaluationMode) || Boolean(implementationStatus) || Boolean(evaluationDueDate);

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
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }
    if (!amendment) {
      toast.error(translateText('generated.inline.0139_amendment_not_found_19292116'));
      return;
    }

    try {
      if (voteState.userVote) {
        if (voteState.currentVoteValue === voteValue) {
          await waitForClientApply(deleteSupportVote(voteState.userVote.id));
        } else {
          await waitForClientApply(
            updateSupportVote({ id: voteState.userVote.id, vote: voteValue })
          );
        }
      } else {
        await waitForClientApply(
          supportAmendment({
            id: crypto.randomUUID(),
            amendment_id: amendmentId,
            vote: voteValue,
          })
        );
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(translateText('generated.inline.0140_failed_to_vote_68d9f4e2'));
    }
  };

  const supporterMapItems = useMemo<SupporterMapItem[]>(
    () => deriveSupporterMapItems(supporterDirectoryItems),
    [supporterDirectoryItems]
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
    supporterDirectoryItems,
    supportingGroupCount,
    clones,
    clonedFrom,
    totalSupportingMembers,
    targetCollaborator,
    targetGroup,
    currentProcessRun,
    evaluationMode,
    evaluationModeLabel,
    evaluationConfigurationSummary,
    implementationStatus,
    implementationDisplayStatus,
    evaluationTask,
    evaluationEvent,
    evaluationAgendaItem,
    evaluationVoteOutcome,
    evaluationVoteOutcomeLabel,
    evaluationDueDate,
    evaluationDueDateLabel,
    hasImplementationEvaluation,
    supporterMapItems,

    // Vote
    ...voteState,
    handleVote,

    // Clone
    ...cloneData,
    networkData,
    usersData,

    // Helpers
    statusColors: AMENDMENT_STATUS_COLORS,
  };
}
