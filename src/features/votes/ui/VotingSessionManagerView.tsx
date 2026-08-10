'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { Progress } from '@/features/shared/ui/ui/progress';
import {
  Clock,
  Users,
  Play,
  Square,
  CheckCircle2,
  Loader2,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { type MajorityType } from '../hooks/useEventVoting';
import { formatTimeRemaining, getMajorityTypeText } from '@/features/shared/utils/voting-utils';
export interface VotingSessionManagerViewProps {
  eventId: any;
  agendaItemId: any;
  votingType: any;
  targetEntityId: any;
  t: any;
  currentSession: any;
  votedCount: any;
  totalVoters: any;
  canManageVoting: any;
  voteResults: any;
  isLoading: any;
  timeRemaining: any;
  startIntroductionPhase: any;
  startVotingPhase: any;
  closeVoting: any;
  majorityType: any;
  setMajorityType: any;
  timeLimit: any;
  setTimeLimit: any;
  expanded: any;
  setExpanded: any;
  handleStartIntroduction: any;
  handleStartVoting: any;
  handleCloseVoting: any;
  votingProgress: any;
}

export function VotingSessionManagerView({
  t,
  currentSession,
  votedCount,
  totalVoters,
  canManageVoting,
  voteResults,
  isLoading,
  timeRemaining,
  majorityType,
  setMajorityType,
  timeLimit,
  setTimeLimit,
  expanded,
  setExpanded,
  handleStartIntroduction,
  handleStartVoting,
  handleCloseVoting,
  votingProgress,
}: VotingSessionManagerViewProps) {
  // No active session - show start options
  if (!currentSession && canManageVoting) {
    return (
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  data-action-id="votes.session.setup.toggle"
                  variant="ghost"
                  presentation="transparentGhost"
                >
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="h-5 w-5" />
                    {t('features.events.voting.startVoting')}
                    {expanded ? (
                      <ChevronUp className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    )}
                  </CardTitle>
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <FormControlLabel>{t('features.events.voting.majorityType')}</FormControlLabel>
                <FormControlSelect
                  data-action-id="votes.session.majority.select"
                  value={majorityType}
                  onValueChange={v => setMajorityType(v as MajorityType)}
                >
                  <FormControlSelectTrigger data-action-id="votes.session.majority.select">
                    <FormControlSelectValue />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    <FormControlSelectItem
                      data-action-id="votes.session.majority.simple"
                      value="simple"
                    >
                      {t('features.events.voting.simpleMajority')}
                    </FormControlSelectItem>
                    <FormControlSelectItem
                      data-action-id="votes.session.majority.absolute"
                      value="absolute"
                    >
                      {t('features.events.voting.absoluteMajority')}
                    </FormControlSelectItem>
                    <FormControlSelectItem
                      data-action-id="votes.session.majority.two-thirds"
                      value="two_thirds"
                    >
                      {t('features.events.voting.twoThirdsMajority')}
                    </FormControlSelectItem>
                  </FormControlSelectContent>
                </FormControlSelect>
              </div>

              <div>
                <FormControlLabel>{t('features.events.voting.timeLimit')}</FormControlLabel>
                <FormControlInput
                  type="number"
                  value={timeLimit}
                  onChange={e => setTimeLimit(parseInt(e.target.value) || 300)}
                  min={30}
                  max={3600}
                />
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span>
                  {totalVoters} {t('features.events.voting.eligibleVoters')}
                </span>
              </div>

              <Button
                data-action-id="votes.session.introduction.start"
                onClick={handleStartIntroduction}
                disabled={isLoading || totalVoters === 0}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {t('features.events.voting.startIntroduction')}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  if (!currentSession) {
    return null;
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card surface={currentSession.phase === 'voting' ? 'primarySoft' : 'default'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button
                data-action-id="votes.session.active.toggle"
                variant="ghost"
                presentation="transparentGhost"
              >
                <CardTitle className="flex items-center gap-2 text-lg">
                  {currentSession.phase === 'introduction' && (
                    <>
                      <Play
                        className={featureThemeClassName('voteVotingSessionManagerWarningIcon')}
                      />
                      {t('features.events.voting.introduction')}
                    </>
                  )}
                  {currentSession.phase === 'voting' && (
                    <>
                      <Timer className="text-primary h-5 w-5 animate-pulse" />
                      {t('features.events.voting.votingActive')}
                    </>
                  )}
                  {currentSession.phase === 'completed' && (
                    <>
                      <CheckCircle2
                        className={featureThemeClassName(
                          'agendaChangeRequestTimelineCardSuccessIcon'
                        )}
                      />
                      {t('features.events.voting.completed')}
                    </>
                  )}
                  {expanded ? (
                    <ChevronUp className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-4 w-4" />
                  )}
                </CardTitle>
              </Button>
            </CollapsibleTrigger>
            <BadgeControl variant={currentSession.result === 'passed' ? 'default' : 'secondary'}>
              {getMajorityTypeText(currentSession.majorityType)}
            </BadgeControl>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Timer for voting phase */}
            {currentSession.phase === 'voting' && timeRemaining !== null && (
              <div className="flex items-center justify-center gap-2 font-mono text-2xl">
                <Clock className="h-6 w-6" />
                <span
                  className={
                    timeRemaining < 60
                      ? featureThemeClassName('notificationNotificationDangerText')
                      : ''
                  }
                >
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            )}

            {/* Voting progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('features.events.voting.votesReceived')}
                </span>
                <span className="font-medium">
                  {votedCount} / {totalVoters}
                </span>
              </div>
              <Progress value={votingProgress} className="h-2" />
            </div>

            {/* Vote results (show after voting) */}
            {(currentSession.phase === 'voting' || currentSession.phase === 'completed') && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={featureThemeClassName('voteVotingSessionManagerSuccessPanel')}>
                  <div className={featureThemeClassName('voteVotingSessionManagerSuccessText')}>
                    {voteResults.accept}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('features.events.voting.accept')}
                  </div>
                </div>
                <div className={featureThemeClassName('voteVotingSessionManagerDangerPanel')}>
                  <div className={featureThemeClassName('voteVotingSessionManagerDangerText')}>
                    {voteResults.reject}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('features.events.voting.reject')}
                  </div>
                </div>
                <div className={featureThemeClassName('voteVotingSessionManagerNeutralPanel')}>
                  <div className={featureThemeClassName('voteVotingSessionManagerNeutralText')}>
                    {voteResults.abstain}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('features.events.voting.abstain')}
                  </div>
                </div>
              </div>
            )}

            {/* Result badge */}
            {currentSession.phase === 'completed' && currentSession.result && (
              <div className="flex justify-center">
                <BadgeControl
                  variant={currentSession.result === 'passed' ? 'default' : 'destructive'}
                  className="px-4 py-2 text-lg"
                >
                  {currentSession.result === 'passed'
                    ? t('features.events.voting.passed')
                    : currentSession.result === 'rejected'
                      ? t('features.events.voting.rejected')
                      : t('features.events.voting.tie')}
                </BadgeControl>
              </div>
            )}

            {/* Control buttons for managers */}
            {canManageVoting && (
              <div className="flex gap-2">
                {currentSession.phase === 'introduction' && (
                  <Button
                    data-action-id="votes.session.voting.start"
                    onClick={handleStartVoting}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {t('features.events.voting.startVoting')}
                  </Button>
                )}

                {currentSession.phase === 'voting' && (
                  <Button
                    data-action-id="votes.session.voting.close"
                    variant="destructive"
                    onClick={handleCloseVoting}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="mr-2 h-4 w-4" />
                    )}
                    {t('features.events.voting.closeVoting')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
