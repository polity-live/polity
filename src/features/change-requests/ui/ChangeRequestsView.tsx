import { Link } from '@tanstack/react-router';
import type { Value } from 'platejs';
import { Button } from '@/features/shared/ui/ui/button';
import { PageWrapper } from '@/layout/page-wrapper';
import { ArrowLeft, FileEdit } from 'lucide-react';
import { AgendaCRVoteTimeline } from '@/features/agendas/ui/AgendaCRVoteTimeline';
import { ChangeRequestCardsList } from '@/features/agendas/ui/ChangeRequestCardsList';
import type { ChangeRequestDiffData } from '@/features/agendas/ui/ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ChangeRequestsViewProps {
  agendaItemId?: string;
  allChangeRequestsCount: number;
  amendmentId: string;
  approvedCount: number;
  declinedCount: number;
  diffMap: Record<string, ChangeRequestDiffData>;
  discussions: TDiscussion[];
  documentContent?: Value;
  editingMode?: string | null;
  hasAmendment: boolean;
  isInVotingStage: boolean;
  isLoading: boolean;
  openCount: number;
  timelineItems: ChangeRequestTimelineRow[];
  userId?: string;
  canManageInternalVotes?: boolean;
  canVoteInternal?: boolean;
  onCastInternalVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onFinalizeInternalVote?: (changeRequestId: string) => Promise<void>;
}

export function ChangeRequestsView({
  agendaItemId,
  allChangeRequestsCount,
  amendmentId,
  approvedCount,
  declinedCount,
  diffMap,
  discussions,
  documentContent,
  editingMode,
  hasAmendment,
  isInVotingStage,
  isLoading,
  openCount,
  timelineItems,
  userId,
  canManageInternalVotes,
  canVoteInternal,
  onCastInternalVote,
  onFinalizeInternalVote,
}: ChangeRequestsViewProps) {
  const isInternalVotingStage = editingMode === 'vote_internal';
  const hasUserVoted = (item: ChangeRequestTimelineRow) =>
    Boolean(
      item.change_request && 'user_vote' in item.change_request && item.change_request.user_vote
    );
  const getUserSelectedChoiceIds = (item: ChangeRequestTimelineRow) => {
    const userVote =
      item.change_request && 'user_vote' in item.change_request
        ? item.change_request.user_vote
        : null;
    if (!userVote || !item.change_request_id) return [];
    const choiceKey = userVote === 'accept' ? 'yes' : userVote === 'reject' ? 'no' : 'abstain';
    return [`mock-choice-${choiceKey}-${item.change_request_id}`];
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          {translateText('generated.inline.0283_loading_change_requests_83649539')}
        </div>
      </PageWrapper>
    );
  }

  if (!hasAmendment) {
    return (
      <PageWrapper>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {translateText('generated.inline.0066_amendment_not_found_3cea3d4d')}
          </h1>
          <p className="text-muted-foreground">
            {translateText(
              'generated.inline.0067_the_amendment_you_re_looking_for_doesn_t_exis_f871134d'
            )}
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="mb-6">
        <Link to="/amendment/$id" params={{ id: amendmentId }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0284_back_to_amendment_7273f2de')}
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <FileEdit className="h-8 w-8" />
          <h1 className="text-4xl font-bold">
            {translateText('generated.inline.0285_change_requests_af9a9fa4')}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {openCount} open, {approvedCount} approved, {declinedCount}
          {translateText('generated.inline.0286_declined_change_request_c80f316b')}
          {allChangeRequestsCount !== 1 ? 's' : ''}
          {translateText('generated.inline.0287_for_this_amendment_659b8c41')}
        </p>
      </div>

      {isInVotingStage && agendaItemId && (
        <div className="mb-8">
          <AgendaCRVoteTimeline agendaItemId={agendaItemId} userId={userId} />
        </div>
      )}

      {timelineItems.length > 0 && (
        <ChangeRequestCardsList
          items={timelineItems}
          editingMode={editingMode}
          isVotingActive={isInternalVotingStage}
          userId={userId}
          diffMap={diffMap}
          documentContent={documentContent}
          discussions={discussions}
          amendmentId={amendmentId}
          agendaItemId={agendaItemId}
          canManage={isInternalVotingStage && Boolean(canManageInternalVotes)}
          canVote={isInternalVotingStage && Boolean(canVoteInternal)}
          hasUserVoted={isInternalVotingStage ? hasUserVoted : undefined}
          getUserSelectedChoiceIds={isInternalVotingStage ? getUserSelectedChoiceIds : undefined}
          onCastVote={isInternalVotingStage ? onCastInternalVote : undefined}
          onFinalizeInternalVote={isInternalVotingStage ? onFinalizeInternalVote : undefined}
        />
      )}
    </PageWrapper>
  );
}
