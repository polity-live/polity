'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Check, X, Minus } from 'lucide-react';
export interface VoteControlsViewProps {
  changeRequestId: any;
  currentUserId: any;
  votes: any;
  collaborators: any;
  status: any;
  amendmentId: any;
  suggestionData: any;
  onVoteComplete: any;
  t: any;
  isVoting: any;
  setIsVoting: any;
  createChangeRequest: any;
  voteOnChangeRequest: any;
  isUUID: any;
  actualChangeRequestId: any;
  setActualChangeRequestId: any;
  currentUserVote: any;
  hasVoted: any;
  acceptVotes: any;
  rejectVotes: any;
  abstainVotes: any;
  totalVotes: any;
  totalCollaborators: any;
  votedUserIds: any;
  notVotedYet: any;
  handleVote: any;
}

export function VoteControlsView({
  votes,
  status,
  t,
  isVoting,
  currentUserVote,
  hasVoted,
  acceptVotes,
  rejectVotes,
  abstainVotes,
  totalVotes,
  totalCollaborators,
  notVotedYet,
  handleVote,
}: VoteControlsViewProps) {
  if (status === 'accepted' || status === 'rejected') {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasVoted && (
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
              {votes.map((vote: any) => (
                <div
                  key={vote.id}
                  className="bg-background flex items-center gap-1 rounded-md px-2 py-1 text-xs"
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
              {notVotedYet.map((collab: any) => (
                <div
                  key={collab.id}
                  className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs opacity-60"
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
