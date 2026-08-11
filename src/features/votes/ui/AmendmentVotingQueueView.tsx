'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Progress } from '@/features/shared/ui/ui/progress';
import {
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  proposedChange: string;
  characterCount?: number;
  votingOrder?: number;
  status: string;
  source?: string;
  createdAt: number;
  creator?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  voteResults?: { accept: number; reject: number; abstain: number };
}
function ChangeRequestItem({
  changeRequest,
  index,
  isActive,
  isCompleted,
  isOrganizer,
  voteResults,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  changeRequest: ChangeRequest;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isOrganizer: boolean;
  voteResults?: { accept: number; reject: number; abstain: number };
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const totalVotes = voteResults
    ? voteResults.accept + voteResults.reject + voteResults.abstain
    : 0;
  const acceptPercentage =
    voteResults && totalVotes > 0 ? (voteResults.accept / totalVotes) * 100 : 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isActive
          ? featureThemeClassName('voteAmendmentVotingQueueInfoSurface')
          : isCompleted
            ? featureThemeClassName('voteAmendmentVotingQueueNeutralSurface')
            : featureThemeClassName('voteAmendmentVotingQueueNeutralBorder')
      }`}
    >
      <div className="flex items-start gap-3">
        {isOrganizer && !isCompleted && (
          <div className="mt-1 flex flex-col gap-1">
            <Button
              data-action-id="votes.amendment-queue.order.move-up"
              size="sm"
              variant="ghost"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="h-6 w-6 p-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              data-action-id="votes.amendment-queue.order.move-down"
              size="sm"
              variant="ghost"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="h-6 w-6 p-0"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={featureThemeClassName('voteAmendmentVotingQueueNeutralText')}>
                #{index + 1}
              </span>
              <h4 className="font-semibold">{changeRequest.title}</h4>
              {isActive && (
                <BadgeControl variant="default" tone="infoStrong">
                  {translateText('generated.inline.1246_aktuelle_abstimmung_bf7b15bd')}
                </BadgeControl>
              )}
              {isCompleted && voteResults && (
                <BadgeControl
                  variant={acceptPercentage > 50 ? 'default' : 'secondary'}
                  className={
                    acceptPercentage > 50
                      ? featureThemeClassName('agendaAgendaVoteSectionSuccessBackground')
                      : featureThemeClassName('agendaAgendaVoteSectionDangerBackground')
                  }
                >
                  {acceptPercentage > 50 ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {translateText('generated.inline.1247_angenommen_187cf380')}
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-1 h-3 w-3" />
                      {translateText('generated.inline.1248_abgelehnt_110d6fe7')}
                    </>
                  )}
                </BadgeControl>
              )}
            </div>
            <BadgeControl variant="outline">
              {changeRequest.characterCount || 0}
              {translateText('generated.inline.1249_zeichen_ge_ndert_2bb3e4a3')}
            </BadgeControl>
          </div>

          <p className="text-muted-foreground text-sm">{changeRequest.description}</p>

          {changeRequest.creator && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>
                {translateText('generated.inline.1250_vorgeschlagen_von_eb4cafd3')}
                {changeRequest.creator.name ||
                  translateText('generated.inline.0028_unbekannt_d0b00a9f')}
              </span>
              {changeRequest.source && (
                <BadgeControl variant="outline" size="xs">
                  {changeRequest.source === 'collaborator'
                    ? translateText('generated.inline.0157_collaborator_794b34c1')
                    : translateText('generated.inline.0158_event_teilnehmer_c24630ba')}
                </BadgeControl>
              )}
            </div>
          )}

          {isCompleted && voteResults && (
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span>
                  {translateText('generated.inline.1251_zustimmung_74668f14')}
                  {voteResults.accept}
                </span>
                <span>
                  {translateText('generated.inline.1252_ablehnung_11faeacf')}
                  {voteResults.reject}
                </span>
                <span>
                  {translateText('generated.inline.1253_enthaltung_76de9169')}
                  {voteResults.abstain}
                </span>
              </div>
              <Progress value={acceptPercentage} className="h-2" />
              <p className="text-muted-foreground text-xs">
                {acceptPercentage.toFixed(1)}
                {translateText('generated.inline.1254_zustimmung_b883f2af')}
                {totalVotes}
                {translateText('generated.inline.1255_stimmen_fd8199c1')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export interface AmendmentVotingQueueViewProps {
  amendmentId: any;
  eventId: any;
  agendaItemId: any;
  changeRequests: any;
  currentSession: any;
  isOrganizer: any;
  onAdvanceToNext: any;
  onComplete: any;
  userId: any;
  t: any;
  localChangeRequests: any;
  setLocalChangeRequests: any;
  currentChangeRequest: any;
  currentVoteResults: any;
  hasVoted: any;
  castVote: any;
  votingLoading: any;
  sortedChangeRequests: any;
  currentIndex: any;
  totalRequests: any;
  progress: any;
  timeRemaining: any;
  minutesRemaining: any;
  secondsRemaining: any;
  handleMoveUp: any;
  handleMoveDown: any;
  updateVotingOrder: any;
}

export function AmendmentVotingQueueView({
  currentSession,
  isOrganizer,
  onAdvanceToNext,
  onComplete,
  userId,
  t,
  currentChangeRequest,
  currentVoteResults,
  hasVoted,
  castVote,
  votingLoading,
  sortedChangeRequests,
  currentIndex,
  totalRequests,
  progress,
  minutesRemaining,
  secondsRemaining,
  handleMoveUp,
  handleMoveDown,
}: AmendmentVotingQueueViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {translateText('generated.inline.1257_abstimmungs_warteschlange_81e93825')}
          </CardTitle>
          {currentSession?.status === 'active' && (
            <BadgeControl variant="default" className="gap-1">
              <Clock className="h-3 w-3" />
              {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
              {translateText('generated.inline.0184_verbleibend_6ffd5c42')}
            </BadgeControl>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {translateText('generated.inline.1258_fortschritt_3f32e7c1')}
              {currentIndex + 1} / {totalRequests + 1}
            </span>
            <span className="text-muted-foreground">
              {currentIndex < totalRequests
                ? translateText('generated.inline.0159_vorschl_ge_7f907c67')
                : translateText('generated.inline.0160_finale_abstimmung_ba186955')}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Change Requests Queue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {translateText('generated.inline.1259_vorschl_ge_8f142a45')}
              {totalRequests})
            </h3>
            {isOrganizer && (
              <p className="text-muted-foreground text-xs">
                {translateText('generated.inline.1260_zum_neuordnen_63249e46')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {sortedChangeRequests.map((cr: any, index: number) => (
              <ChangeRequestItem
                key={cr.id}
                changeRequest={cr}
                index={index}
                isActive={currentIndex === index && currentSession?.status === 'active'}
                isCompleted={index < currentIndex}
                isOrganizer={isOrganizer}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                canMoveUp={index > 0}
                canMoveDown={index < sortedChangeRequests.length - 1}
                voteResults={
                  index < currentIndex
                    ? (cr.voteResults ?? { accept: 10, reject: 5, abstain: 2 })
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* Current Vote Section */}
        {currentChangeRequest && currentSession?.status === 'active' && (
          <div className="border-primary bg-primary/5 space-y-4 rounded-lg border-2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{t('features.events.voting.castYourVote')}</h4>
                <p className="text-muted-foreground text-sm">{currentChangeRequest.title}</p>
              </div>
              {hasVoted && (
                <BadgeControl variant="outline" tone="successSoft">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t('features.events.voting.voted')}
                </BadgeControl>
              )}
            </div>

            {/* Vote Results Display */}
            {currentVoteResults && (
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <ThumbsUp
                    className={featureThemeClassName('timelineTodoTimelineCardSuccessIcon')}
                  />
                  {currentVoteResults.accept}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown
                    className={featureThemeClassName('voteAmendmentVotingQueueDangerIcon')}
                  />
                  {currentVoteResults.reject}
                </span>
                <span className="flex items-center gap-1">
                  <Minus className={featureThemeClassName('voteAmendmentVotingQueueNeutralIcon')} />
                  {currentVoteResults.abstain}
                </span>
              </div>
            )}

            {/* Vote Buttons */}
            {!hasVoted && userId && (
              <div className="flex gap-2">
                <Button
                  data-action-id="votes.amendment-queue.vote.accept"
                  onClick={() => castVote('accept')}
                  disabled={votingLoading}
                  variant="outline"
                  className={featureThemeClassName('voteAmendmentVotingQueueSuccessBadge')}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  {t('features.events.voting.accept')}
                </Button>
                <Button
                  data-action-id="votes.amendment-queue.vote.reject"
                  onClick={() => castVote('reject')}
                  disabled={votingLoading}
                  variant="outline"
                  className={featureThemeClassName('voteAmendmentVotingQueueDangerBadge')}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  {t('features.events.voting.reject')}
                </Button>
                <Button
                  data-action-id="votes.amendment-queue.vote.abstain"
                  onClick={() => castVote('abstain')}
                  disabled={votingLoading}
                  variant="outline"
                  className="flex-1"
                >
                  <Minus className="mr-2 h-4 w-4" />
                  {t('features.events.voting.abstain')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Final Text Vote */}
        {currentIndex >= totalRequests && (
          <div
            className={`rounded-lg border-2 p-4 ${
              currentSession?.status === 'active'
                ? featureThemeClassName('voteAmendmentVotingQueueSuccessSurface')
                : featureThemeClassName('voteAmendmentVotingQueueNeutralBorderAlpha')
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">
                  {translateText('generated.inline.1261_finale_textabstimmung_0385a475')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.1262_abstimmung_ber_den_gesamten_amendment_text_53856d8c'
                  )}
                </p>
              </div>
              {currentSession?.status === 'active' && (
                <BadgeControl variant="default" tone="successStrong">
                  {translateText('generated.inline.1246_aktuelle_abstimmung_bf7b15bd')}
                </BadgeControl>
              )}
            </div>
          </div>
        )}

        {/* Organizer Controls */}
        {isOrganizer && currentSession?.status === 'active' && (
          <div className="flex gap-2 pt-4">
            {currentIndex < totalRequests ? (
              <Button
                data-action-id="votes.amendment-queue.advance"
                onClick={onAdvanceToNext}
                className="flex-1"
              >
                <ArrowDown className="mr-2 h-4 w-4" />
                {translateText('generated.inline.1263_n_chster_vorschlag_17267465')}
              </Button>
            ) : (
              <Button
                data-action-id="votes.amendment-queue.complete"
                onClick={onComplete}
                variant="default"
                presentation="success"
                className="flex-1"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {translateText('generated.inline.1264_abstimmung_abschlie_en_4133d62a')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
