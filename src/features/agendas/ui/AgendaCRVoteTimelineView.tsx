'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Vote } from 'lucide-react';
import { ChangeRequestTimelineCard } from './ChangeRequestTimelineCard';
export interface AgendaCRVoteTimelineViewProps {
  agendaItemId: any;
  allCRsProcessed: any;
  canManage: any;
  canVote: any;
  castCRVote: any;
  closeVoting: any;
  completedItems: any;
  crTimeline: any;
  currentItem: any;
  getUserSelectedChoiceIds: any;
  hasUserVoted: any;
  isLoading: any;
  isTimelineComplete: any;
  progress: any;
  progressPercent: any;
  startFinalPhase: any;
  startIndicativePhase: any;
  t: any;
  userId: any;
}

export function AgendaCRVoteTimelineView({
  allCRsProcessed,
  canManage,
  canVote,
  castCRVote,
  closeVoting,
  completedItems,
  crTimeline,
  currentItem,
  getUserSelectedChoiceIds,
  hasUserVoted,
  isTimelineComplete,
  progressPercent,
  startFinalPhase,
  startIndicativePhase,
  t,
}: AgendaCRVoteTimelineViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            <CardTitle className="text-base">{t('features.agendas.crTimeline.title')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <BadgeControl variant="outline">
              {completedItems.length}/{crTimeline.length}
            </BadgeControl>
            {isTimelineComplete && (
              <BadgeControl variant="default" tone="successStrong">
                {t('features.agendas.crTimeline.allCompleted')}
              </BadgeControl>
            )}
          </div>
        </div>
        <Progress value={progressPercent} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {crTimeline.map((item: any, index: number) => (
            <ChangeRequestTimelineCard
              key={item.id}
              item={item}
              index={index}
              isCurrent={currentItem?.id === item.id}
              hasUserVoted={hasUserVoted(item)}
              userSelectedChoiceIds={getUserSelectedChoiceIds(item)}
              canManage={canManage}
              canVote={canVote}
              isFinalVoteLocked={item.is_final_vote && !allCRsProcessed}
              onCastVote={castCRVote}
              onStartIndicative={startIndicativePhase}
              onStartFinal={startFinalPhase}
              onCloseVoting={closeVoting}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
