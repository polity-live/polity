'use client';

import { useState } from 'react';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface VoteControlsProps {
  changeRequestId: string;
  currentUserId: string;
  votes: {
    id: string;
    vote: string;
    createdAt: number;
    voter: {
      id: string;
      user?: {
        name?: string;
        avatar?: string;
      };
    };
  }[];
  collaborators: {
    id: string;
    user: {
      id: string;
      name?: string;
      avatar?: string;
    };
  }[];
  status: string;
  amendmentId: string;
  amendmentTitle?: string;
  documentId: string;
  suggestionData?: {
    crId: string;
    description: string;
    proposedChange: string;
    justification: string;
    userId: string;
    createdAt: number;
  };
  onVoteComplete?: () => void;
}
import { VoteControlsView } from './VoteControlsView';
export function VoteControls({
  changeRequestId,
  currentUserId,
  votes,
  collaborators,
  status,
  amendmentId,
  suggestionData,
  onVoteComplete,
}: VoteControlsProps) {
  const { t } = useTranslation();
  const [isVoting, setIsVoting] = useState(false);
  const { createChangeRequest, voteOnChangeRequest } = useAmendmentActions();

  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const [actualChangeRequestId, setActualChangeRequestId] = useState<string | null>(
    isUUID(changeRequestId) ? changeRequestId : null
  );

  const currentUserVote = votes.find(v => v.voter?.id === currentUserId);
  const hasVoted = !!currentUserVote;

  const acceptVotes = votes.filter(v => v.vote === 'accept').length;
  const rejectVotes = votes.filter(v => v.vote === 'reject').length;
  const abstainVotes = votes.filter(v => v.vote === 'abstain').length;
  const totalVotes = votes.length;
  const totalCollaborators = collaborators.length;

  const votedUserIds = new Set(votes.map(v => v.voter?.id));
  const notVotedYet = collaborators.filter(c => !votedUserIds.has(c.user?.id));

  const handleVote = async (voteType: 'accept' | 'reject' | 'abstain') => {
    setIsVoting(true);

    try {
      let crId = actualChangeRequestId;

      if (suggestionData && !actualChangeRequestId) {
        crId = crypto.randomUUID();

        await createChangeRequest({
          id: crId,
          title: suggestionData.crId,
          description: suggestionData.description,
          status: 'pending',
          amendment_id: amendmentId,
          reason: '',
          source_type: '',
          source_id: null,
          source_title: '',
          voting_status: '',
          voting_deadline: 0,
          voting_majority_type: '',
          quorum_required: 0,
        });

        setActualChangeRequestId(crId);
      }

      if (!crId) {
        throw new Error('Could not determine changeRequest ID');
      }

      const voteId = crypto.randomUUID();

      await voteOnChangeRequest({
        id: voteId,
        vote: voteType,
        change_request_id: crId,
      });

      toast.success(t('features.amendments.voteControls.voteRecorded'), {
        description: t('features.amendments.voteControls.yourVote').replace('{{vote}}', voteType),
      });

      if (onVoteComplete) {
        onVoteComplete();
      }
    } catch (error) {
      console.error('Failed to record vote:', error);
      toast.error(t('features.amendments.voteControls.voteFailed'));
    } finally {
      setIsVoting(false);
    }
  };
  return (
    <VoteControlsView
      changeRequestId={changeRequestId}
      currentUserId={currentUserId}
      votes={votes}
      collaborators={collaborators}
      status={status}
      amendmentId={amendmentId}
      suggestionData={suggestionData}
      onVoteComplete={onVoteComplete}
      t={t}
      isVoting={isVoting}
      setIsVoting={setIsVoting}
      createChangeRequest={createChangeRequest}
      voteOnChangeRequest={voteOnChangeRequest}
      isUUID={isUUID}
      actualChangeRequestId={actualChangeRequestId}
      setActualChangeRequestId={setActualChangeRequestId}
      currentUserVote={currentUserVote}
      hasVoted={hasVoted}
      acceptVotes={acceptVotes}
      rejectVotes={rejectVotes}
      abstainVotes={abstainVotes}
      totalVotes={totalVotes}
      totalCollaborators={totalCollaborators}
      votedUserIds={votedUserIds}
      notVotedYet={notVotedYet}
      handleVote={handleVote}
    />
  );
}
