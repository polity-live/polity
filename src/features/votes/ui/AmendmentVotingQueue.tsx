'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useState, useMemo } from 'react';
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
import { toast } from 'sonner';
import { useChangeRequestVoting } from '../hooks/useChangeRequestVoting';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

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
}

interface VoteSession {
  id: string;
  status: string;
  votingStartTime: number;
  votingEndTime: number;
  currentChangeRequestIndex?: number;
  votes?: {
    id: string;
    vote: string;
    voter: {
      id: string;
      name?: string;
    };
  }[];
}

interface AmendmentVotingQueueProps {
  amendmentId: string;
  eventId: string;
  agendaItemId: string;
  changeRequests: ChangeRequest[];
  currentSession?: VoteSession;
  isOrganizer: boolean;
  onAdvanceToNext: () => void;
  onComplete: () => void;
  userId?: string;
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
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : isCompleted
            ? 'border-gray-300 bg-gray-50 dark:bg-gray-900'
            : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {isOrganizer && !isCompleted && (
          <div className="mt-1 flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="h-6 w-6 p-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
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
              <span className="text-sm font-semibold text-gray-600">#{index + 1}</span>
              <h4 className="font-semibold">{changeRequest.title}</h4>
              {isActive && (
                <BadgeControl variant="default" className="bg-blue-500">
                  {translateText('generated.inline.1246_aktuelle_abstimmung_bf7b15bd')}
                </BadgeControl>
              )}
              {isCompleted && voteResults && (
                <BadgeControl
                  variant={acceptPercentage > 50 ? 'default' : 'secondary'}
                  className={acceptPercentage > 50 ? 'bg-green-500' : 'bg-red-500'}
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
                <BadgeControl variant="outline" className="text-xs">
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

export function AmendmentVotingQueue({
  amendmentId,
  eventId,
  agendaItemId,
  changeRequests,
  currentSession,
  isOrganizer,
  onAdvanceToNext,
  onComplete,
  userId,
}: AmendmentVotingQueueProps) {
  const { t } = useTranslation();
  const [localChangeRequests, setLocalChangeRequests] = useState(changeRequests);

  // Integrate with useChangeRequestVoting for proper voting management
  const {
    currentChangeRequest,
    voteResults: currentVoteResults,
    hasVoted,
    castVote,
    isLoading: votingLoading,
  } = useChangeRequestVoting({
    eventId,
    votingSessionId: currentSession?.id || '',
    userId: userId || '',
    agendaItemId,
    amendmentId,
  });

  // Sort change requests by votingOrder (if set) or characterCount
  const sortedChangeRequests = useMemo(() => {
    return [...localChangeRequests].sort((a, b) => {
      if (a.votingOrder !== undefined && b.votingOrder !== undefined) {
        return a.votingOrder - b.votingOrder;
      }
      if (a.votingOrder !== undefined) return -1;
      if (b.votingOrder !== undefined) return 1;
      return (b.characterCount || 0) - (a.characterCount || 0);
    });
  }, [localChangeRequests]);

  const currentIndex = currentSession?.currentChangeRequestIndex || 0;
  const totalRequests = sortedChangeRequests.length;
  const progress = totalRequests > 0 ? ((currentIndex + 1) / (totalRequests + 1)) * 100 : 0;

  const timeRemaining = currentSession ? Math.max(0, currentSession.votingEndTime - Date.now()) : 0;
  const minutesRemaining = Math.floor(timeRemaining / 60000);
  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newOrder = [...sortedChangeRequests];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;

    await updateVotingOrder(newOrder);
  };

  const handleMoveDown = async (index: number) => {
    if (index === sortedChangeRequests.length - 1) return;

    const newOrder = [...sortedChangeRequests];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;

    await updateVotingOrder(newOrder);
  };

  const updateVotingOrder = async (newOrder: ChangeRequest[]) => {
    setLocalChangeRequests(newOrder);
    toast.success(
      translateText('generated.inline.1256_abstimmungsreihenfolge_aktualisiert_4e6d6850')
    );
  };

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
            {sortedChangeRequests.map((cr, index) => (
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
                    ? { accept: 10, reject: 5, abstain: 2 } // Placeholder: needs per-change-request vote aggregation from voting session data
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
                <BadgeControl variant="outline" className="bg-green-50">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t('features.events.voting.voted')}
                </BadgeControl>
              )}
            </div>

            {/* Vote Results Display */}
            {currentVoteResults && (
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  {currentVoteResults.accept}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  {currentVoteResults.reject}
                </span>
                <span className="flex items-center gap-1">
                  <Minus className="h-4 w-4 text-gray-600" />
                  {currentVoteResults.abstain}
                </span>
              </div>
            )}

            {/* Vote Buttons */}
            {!hasVoted && userId && (
              <div className="flex gap-2">
                <Button
                  onClick={() => castVote('accept')}
                  disabled={votingLoading}
                  variant="outline"
                  className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  {t('features.events.voting.accept')}
                </Button>
                <Button
                  onClick={() => castVote('reject')}
                  disabled={votingLoading}
                  variant="outline"
                  className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  {t('features.events.voting.reject')}
                </Button>
                <Button
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
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-gray-300'
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
                <BadgeControl variant="default" className="bg-green-500">
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
              <Button onClick={onAdvanceToNext} className="flex-1">
                <ArrowDown className="mr-2 h-4 w-4" />
                {translateText('generated.inline.1263_n_chster_vorschlag_17267465')}
              </Button>
            ) : (
              <Button onClick={onComplete} variant="default" className="flex-1 bg-green-600">
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
