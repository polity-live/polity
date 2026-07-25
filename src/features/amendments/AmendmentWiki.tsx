'use client';
import { type VoteValue } from '@/features/shared/ui/voting';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useCreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useAmendmentWikiPage } from './hooks/useAmendmentWikiPage';
import { SupporterDirectorySection } from './ui/SupporterDirectorySection';

interface AmendmentWikiProps {
  amendmentId: string;
}
import { AmendmentWikiView } from './AmendmentWikiView';
export function AmendmentWiki({ amendmentId }: AmendmentWikiProps) {
  const { t } = useTranslation();
  const recoveryDraft = useCreateRecoveryDraft('amendment', amendmentId);
  const {
    user,
    canAccess,
    isSubscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
    collaboration,
    amendment,
    isLoading,
    roles,
    collaborators,
    supporterDirectoryItems,
    supportingGroupCount,
    clones,
    clonedFrom,
    totalSupportingMembers,
    targetCollaborator,
    targetGroup,
    evaluationModeLabel,
    evaluationConfigurationSummary,
    implementationStatus,
    implementationDisplayStatus,
    evaluationEvent,
    evaluationAgendaItem,
    evaluationVoteOutcomeLabel,
    evaluationDueDateLabel,
    hasImplementationEvaluation,
    supporterMapItems,
    upvotes,
    downvotes,
    currentVoteValue,
    handleVote,
    cloneDialogOpen,
    setCloneDialogOpen,
    isCloning,
    handleClone,
    handleConfirmClone,
  } = useAmendmentWikiPage(amendmentId);

  if (!amendment && recoveryDraft) {
    return <CreateRecoveryState draft={recoveryDraft} />;
  }

  if (!amendment && isLoading) {
    return <PageSkeleton />;
  }

  const normalizedVoteValue: VoteValue =
    currentVoteValue === -1 ? -1 : currentVoteValue === 1 ? 1 : 0;
  const supporterDirectorySection = (
    <SupporterDirectorySection items={supporterDirectoryItems} mapItems={supporterMapItems} />
  );
  return (
    <AmendmentWikiView
      virtualizeParticipationDirectory
      amendmentId={amendmentId}
      t={t}
      user={user}
      canAccess={canAccess}
      isSubscribed={isSubscribed}
      subscriberCount={subscriberCount}
      toggleSubscribe={toggleSubscribe}
      subscribeLoading={subscribeLoading}
      collaboration={collaboration}
      amendment={amendment}
      roles={roles}
      collaborators={collaborators}
      supporterDirectoryItems={supporterDirectoryItems}
      supportingGroupCount={supportingGroupCount}
      clones={clones}
      clonedFrom={clonedFrom}
      totalSupportingMembers={totalSupportingMembers}
      targetCollaborator={targetCollaborator}
      targetGroup={targetGroup}
      evaluationModeLabel={evaluationModeLabel}
      evaluationConfigurationSummary={evaluationConfigurationSummary}
      implementationStatus={implementationStatus}
      implementationDisplayStatus={implementationDisplayStatus}
      evaluationEvent={evaluationEvent}
      evaluationAgendaItem={evaluationAgendaItem}
      evaluationVoteOutcomeLabel={evaluationVoteOutcomeLabel}
      evaluationDueDateLabel={evaluationDueDateLabel}
      hasImplementationEvaluation={hasImplementationEvaluation}
      supporterMapItems={supporterMapItems}
      upvotes={upvotes}
      downvotes={downvotes}
      currentVoteValue={currentVoteValue}
      handleVote={handleVote}
      cloneDialogOpen={cloneDialogOpen}
      setCloneDialogOpen={setCloneDialogOpen}
      isCloning={isCloning}
      handleClone={handleClone}
      handleConfirmClone={handleConfirmClone}
      normalizedVoteValue={normalizedVoteValue}
      supporterDirectorySection={supporterDirectorySection}
    />
  );
}
