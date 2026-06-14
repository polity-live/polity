'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Check, X, Minus } from 'lucide-react';
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
    if (hasVoted) {
      toast.error(t('features.amendments.voteControls.alreadyVoted'));
      return;
    }

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

  if (status === 'accepted' || status === 'rejected') {
    return null;
  }

  return (
    <div className="space-y-4">
      {!hasVoted ? (
        <div className="flex gap-2">
          <Button
            onClick={() => handleVote('accept')}
            disabled={isVoting}
            variant="default"
            className={featureThemeClassName('voteVoteControlsSuccessBackground')}
          >
            <Check className="mr-2 h-4 w-4" />
            {t('features.amendments.voteControls.accept')}
          </Button>
          <Button
            onClick={() => handleVote('reject')}
            disabled={isVoting}
            variant="destructive"
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            {t('features.amendments.voteControls.reject')}
          </Button>
          <Button
            onClick={() => handleVote('abstain')}
            disabled={isVoting}
            variant="outline"
            className="flex-1"
          >
            <Minus className="mr-2 h-4 w-4" />
            {t('features.amendments.voteControls.abstain')}
          </Button>
        </div>
      ) : (
        <Card surface="infoSoft">
          <CardContent className="py-3">
            <p className="text-sm">
              {t('features.amendments.voteControls.yourVote').replace(
                '{{vote}}',
                currentUserVote.vote
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="bg-muted/50 rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-semibold">{t('features.amendments.voteControls.votingProgress')}</h4>
          <BadgeControl variant="secondary">
            {totalVotes} / {totalCollaborators} {t('features.amendments.voteControls.voted')}
          </BadgeControl>
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Check className={featureThemeClassName('timelineVoteTimelineCardSuccessIcon')} />
                {t('features.amendments.voteControls.accept')}
              </span>
              <span className="font-semibold">{acceptVotes}</span>
            </div>
            <div className={featureThemeClassName('voteVoteControlsNeutralBackground')}>
              <div
                className={featureThemeClassName('voteVoteControlsSuccessBackgroundAlpha')}
                style={{
                  width:
                    totalCollaborators > 0 ? `${(acceptVotes / totalCollaborators) * 100}%` : '0%',
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <X className={featureThemeClassName('timelineVoteTimelineCardDangerIcon')} />
                {t('features.amendments.voteControls.reject')}
              </span>
              <span className="font-semibold">{rejectVotes}</span>
            </div>
            <div className={featureThemeClassName('voteVoteControlsNeutralBackground')}>
              <div
                className={featureThemeClassName('voteVoteControlsDangerBackground')}
                style={{
                  width:
                    totalCollaborators > 0 ? `${(rejectVotes / totalCollaborators) * 100}%` : '0%',
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Minus className={featureThemeClassName('voteVoteControlsNeutralIcon')} />
                {t('features.amendments.voteControls.abstain')}
              </span>
              <span className="font-semibold">{abstainVotes}</span>
            </div>
            <div className={featureThemeClassName('voteVoteControlsNeutralBackground')}>
              <div
                className={featureThemeClassName('voteVoteControlsNeutralBackgroundAlpha')}
                style={{
                  width:
                    totalCollaborators > 0 ? `${(abstainVotes / totalCollaborators) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>

        {votes.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-sm font-semibold">
              {t('features.amendments.voteControls.votedList')}:
            </p>
            <div className="flex flex-wrap gap-2">
              {votes.map(vote => (
                <div
                  key={vote.id}
                  className="bg-background flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                >
                  <Avatar className="h-5 w-5">
                    {vote.voter?.user ? (
                      <AvatarImage src={vote.voter.user.avatar} alt={vote.voter.user.name || ''} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {vote.voter?.user?.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {vote.voter?.user?.name || t('features.amendments.voteControls.unspecified')}
                  </span>
                  <BadgeControl
                    variant="outline"
                    className={`ml-1 ${
                      vote.vote === 'accept'
                        ? featureThemeClassName('voteVoteControlsSuccessBorder')
                        : vote.vote === 'reject'
                          ? featureThemeClassName('voteVoteControlsDangerBorder')
                          : featureThemeClassName('voteVoteControlsNeutralBorder')
                    }`}
                  >
                    {vote.vote}
                  </BadgeControl>
                </div>
              ))}
            </div>
          </div>
        )}

        {notVotedYet.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-sm font-semibold">
              {t('features.amendments.voteControls.waitingFor')} ({notVotedYet.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {notVotedYet.map(collab => (
                <div
                  key={collab.id}
                  className="bg-muted flex items-center gap-1 rounded-full px-2 py-1 text-xs opacity-60"
                >
                  <Avatar className="h-5 w-5">
                    {collab.user?.avatar ? (
                      <AvatarImage src={collab.user.avatar} alt={collab.user.name || ''} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {collab.user?.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {collab.user?.name || t('features.amendments.voteControls.unspecified')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
