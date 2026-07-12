import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  Clock,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  Play,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { AgendaNavigationControls } from '@/features/agendas/ui/AgendaNavigationControls';
import {
  AgendaElectionSection,
  isAutoAssignedRoleElection,
} from '@/features/agendas/ui/AgendaElectionSection';
import { AgendaVoteSection } from '@/features/agendas/ui/AgendaVoteSection';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { getSpeakerGenderLabel } from '@/features/agendas/logic/speakerListGenderQuota';
import {
  INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR,
  useHorizontalArrowNavigation,
} from '@/features/shared/hooks/useHorizontalArrowNavigation';
import { EventLivestreamPlayer } from './EventLivestreamPlayer';

function formatGenderBadgeLabel(t: any, gender?: string | null) {
  const labelKey =
    gender === 'male'
      ? 'male'
      : gender === 'female'
        ? 'female'
        : gender === 'diverse'
          ? 'diverse'
          : 'unspecified';

  return t(
    `features.events.agenda.genderQuota.genderLabels.${labelKey}`,
    getSpeakerGenderLabel(gender)
  );
}
export interface EventStreamViewProps {
  eventId: any;
  navigate: any;
  t: any;
  carouselRef: any;
  activeContentRef: any;
  canScrollLeft: any;
  setCanScrollLeft: any;
  canScrollRight: any;
  setCanScrollRight: any;
  previousAgendaItemIdRef: any;
  event: any;
  currentAgendaItem: any;
  speakerList: any;
  user: any;
  isLoading: any;
  addingSpeaker: any;
  removingSpeaker: any;
  canJoinSpeakerList: any;
  userSpeaker: any;
  handleAddToSpeakerList: any;
  handleRemoveFromSpeakerList: any;
  calculateSpeakerTime: any;
  formatTime: any;
  speakersExpanded: any;
  setSpeakersExpanded: any;
  attendanceMode: any;
  confirmedOfflineParticipantCount: any;
  election: any;
  indicativeSelections: any;
  finalSelections: any;
  userHasElectionVoted: any;
  userSelectedCandidateIds: any;
  isUserCandidate: any;
  voteEntity: any;
  indicativeDecisions: any;
  finalDecisions: any;
  userHasVoteVoted: any;
  userSelectedChoiceIds: any;
  updateScrollButtons: any;
  scroll: any;
  getAgendaItemIcon: any;
  getStatusColor: any;
  getTypeColor: any;
}

export function EventStreamView({
  eventId,
  navigate,
  t,
  carouselRef,
  activeContentRef,
  canScrollLeft,
  canScrollRight,
  event,
  currentAgendaItem,
  speakerList,
  user,
  isLoading,
  addingSpeaker,
  removingSpeaker,
  canJoinSpeakerList,
  userSpeaker,
  handleAddToSpeakerList,
  handleRemoveFromSpeakerList,
  calculateSpeakerTime,
  formatTime,
  speakersExpanded,
  setSpeakersExpanded,
  attendanceMode,
  confirmedOfflineParticipantCount,
  election,
  indicativeSelections,
  finalSelections,
  userHasElectionVoted,
  userSelectedCandidateIds,
  isUserCandidate,
  voteEntity,
  indicativeDecisions,
  finalDecisions,
  userHasVoteVoted,
  userSelectedChoiceIds,
  scroll,
  getAgendaItemIcon,
  getStatusColor,
  getTypeColor,
}: EventStreamViewProps) {
  const showSpeakerGender = Boolean(event?.gender_quota_enabled);
  const { onKeyDown: onSpeakerCarouselKeyDown } = useHorizontalArrowNavigation({
    mode: 'scoped',
    canGoPrev: canScrollLeft,
    canGoNext: canScrollRight,
    onGoPrev: () => scroll('left'),
    onGoNext: () => scroll('right'),
    lockSelector: INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR,
  });

  if (isLoading) {
    return (
      <div className="min-h-[400px] py-6">
        <SectionSkeleton rows={4} label={t('common.loading.sectionSkeleton.label')} />
      </div>
    );
  }

  if (!event || !currentAgendaItem) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">{t('features.events.stream.noActiveItem')}</p>
        <Button onClick={() => navigate({ to: `/event/${eventId}` })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('features.events.backToEvent')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Stream Video */}
      <EventLivestreamPlayer
        streamUrl={event.stream_url}
        title={t('features.events.stream.liveStream')}
        containerClassName={featureThemeClassName('agendaEventStreamSectionContrastBackground')}
      />

      {/* Current Agenda Item - Prominent Display */}
      <div ref={activeContentRef}>
        <Card elevation="ringPrimary">
          <CardHeader surface="primarySoft">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-primary text-primary-foreground relative flex h-14 w-14 items-center justify-center rounded-lg shadow-md">
                  {getAgendaItemIcon(
                    currentAgendaItem.type ??
                      translateText('generated.inline.0011_discussion_c255751d')
                  )}
                  <div className={featureThemeClassName('eventEventStreamSuccessContrastPulseDot')}>
                    <Play className={featureThemeClassName('eventEventStreamContrastStyle')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BadgeControl variant="default" pulse>
                      {t('features.events.stream.live')}
                    </BadgeControl>
                    <CardTitle className="text-2xl">{currentAgendaItem.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeControl className={getTypeColor(currentAgendaItem.type ?? 'discussion')}>
                      <span className="capitalize">{currentAgendaItem.type}</span>
                    </BadgeControl>
                    <BadgeControl className={getStatusColor(currentAgendaItem.status ?? 'pending')}>
                      {currentAgendaItem.status}
                    </BadgeControl>
                    {currentAgendaItem.duration && (
                      <BadgeControl variant="outline">
                        <Clock className="mr-1 h-3 w-3" />
                        {currentAgendaItem.duration} {t('common.minutes')}
                      </BadgeControl>
                    )}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link
                  to="/event/$id/agenda/$agendaItemId"
                  params={{ id: eventId, agendaItemId: currentAgendaItem.id }}
                >
                  {t('features.events.stream.viewDetails')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          {currentAgendaItem.description && (
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {currentAgendaItem.description}
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Agenda Navigation Controls for organizers */}
        <AgendaNavigationControls eventId={eventId} />
      </div>

      {/* Election Section */}
      {election && election.candidates && election.candidates.length > 0 && (
        <AgendaElectionSection
          roleName={election.title ?? t('features.events.agenda.role')}
          electionMode={
            election.election_mode ? normalizeElectionMode(election.election_mode) : null
          }
          seatCount={election.seat_count}
          candidates={[...election.candidates] as CandidatesByElectionRow[]}
          indicativeSelections={indicativeSelections}
          finalSelections={finalSelections}
          offlineTallies={election.offline_tallies ?? []}
          attendanceMode={attendanceMode}
          delegateTargetEventId={
            (election as { delegate_assignment_meta?: { targetEventId?: string } | null })
              .delegate_assignment_meta?.targetEventId
          }
          showRoleAssignedMessage={isAutoAssignedRoleElection(election)}
          userHasVoted={userHasElectionVoted}
          userSelectedCandidateIds={userSelectedCandidateIds}
          electionStatus={election.status ?? 'indicative'}
          canVote={!!user}
          canBeCandidate={false}
          isUserCandidate={isUserCandidate}
          onBecomeCandidate={() => undefined}
          onWithdrawCandidacy={() => undefined}
        />
      )}

      {/* Vote Section */}
      {voteEntity && voteEntity.choices && voteEntity.choices.length > 0 && (
        <AgendaVoteSection
          voteId={voteEntity.id}
          voteTitle={voteEntity.title || 'Vote'}
          choices={[...voteEntity.choices] as ChoicesByVoteRow[]}
          indicativeDecisions={indicativeDecisions}
          finalDecisions={finalDecisions}
          offlineTallies={voteEntity.offline_tallies ?? []}
          attendanceMode={attendanceMode}
          userHasVoted={userHasVoteVoted}
          userSelectedChoiceIds={userSelectedChoiceIds}
          voteStatus={voteEntity.status ?? 'indicative'}
          majorityType={voteEntity.majority_type}
          totalEligibleVoters={
            voteEntity.offline_electorate_size == null
              ? (voteEntity.voters?.length ?? 0) + confirmedOfflineParticipantCount
              : (voteEntity.voters ?? []).filter(
                  (voter: { participation_channel?: string | null }) =>
                    voter.participation_channel !== 'offline'
                ).length + voteEntity.offline_electorate_size
          }
          offlineEligibleCount={
            voteEntity.offline_electorate_size ?? confirmedOfflineParticipantCount
          }
        />
      )}

      {/* Speaker List Section */}
      <Collapsible open={speakersExpanded} onOpenChange={setSpeakersExpanded}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={featureThemeClassName('agendaEventStreamSectionThemedPanel')}
                >
                  <CardTitle className="text-2xl">
                    {t('features.events.stream.speakersList')} ({speakerList.length})
                  </CardTitle>
                  {speakersExpanded ? (
                    <ChevronUp className="text-muted-foreground h-5 w-5" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              {userSpeaker ? (
                <Button
                  onClick={() => handleRemoveFromSpeakerList(userSpeaker.id)}
                  disabled={removingSpeaker === userSpeaker.id}
                  variant="outline"
                  size="lg"
                >
                  <X className="mr-2 h-5 w-5" />
                  {removingSpeaker === userSpeaker.id
                    ? translateText('generated.inline.0015_removing_2a76d431')
                    : translateText('generated.inline.0016_remove_yourself_fa3b0e30')}
                </Button>
              ) : canJoinSpeakerList ? (
                <Button
                  onClick={handleAddToSpeakerList}
                  disabled={addingSpeaker || !user}
                  size="lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  {addingSpeaker
                    ? translateText('generated.inline.0017_adding_268c06a2')
                    : translateText('generated.inline.0018_add_yourself_71fba1c3')}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {speakerList.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground text-lg">
                    {translateText('generated.inline.0054_no_speakers_yet_47546d9a')}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {translateText(
                      'generated.inline.0519_be_the_first_to_add_yourself_to_the_speakers__dd223a89'
                    )}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Carousel Navigation Buttons */}
                  {canScrollLeft && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-full shadow-lg"
                      onClick={() => scroll('left')}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  )}
                  {canScrollRight && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-full shadow-lg"
                      onClick={() => scroll('right')}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  )}

                  {/* Carousel */}
                  <div
                    ref={carouselRef}
                    tabIndex={0}
                    onKeyDown={onSpeakerCarouselKeyDown}
                    data-arrow-keys="local"
                    className="flex gap-4 overflow-x-auto scroll-smooth px-12 pb-4"
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {speakerList.map((speaker: any, index: number) => {
                      const speakerTime = calculateSpeakerTime(index);
                      const speakerName =
                        `${speaker.user?.first_name ?? ''} ${speaker.user?.last_name ?? ''}`.trim() ||
                        speaker.user?.email ||
                        'Unknown';
                      const speakerAvatar = speaker.user?.avatar ?? undefined;
                      const isCurrentUser = speaker.user?.id === user?.id;

                      return (
                        <Card
                          key={speaker.id}
                          className={`relative w-64 flex-shrink-0 ${
                            speaker.completed
                              ? 'border-muted opacity-60'
                              : isCurrentUser
                                ? 'border-primary border-2'
                                : 'border-primary'
                          }`}
                        >
                          {isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full"
                              onClick={() => handleRemoveFromSpeakerList(speaker.id)}
                              disabled={removingSpeaker === speaker.id}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          <CardContent className="space-y-4 p-6">
                            {/* Speaker Avatar */}
                            <div className="flex justify-center">
                              <Avatar className="border-background h-20 w-20 border-4 shadow-lg">
                                <AvatarImage src={speakerAvatar} />
                                <AvatarFallback className="text-2xl">
                                  {speakerName[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            {/* Speaker Name */}
                            <div className="text-center">
                              <h3 className="truncate text-lg font-semibold" title={speakerName}>
                                {speakerName}
                              </h3>
                              {isCurrentUser && (
                                <BadgeControl variant="secondary" className="mt-1">
                                  {translateText('generated.inline.0055_you_905cb326')}
                                </BadgeControl>
                              )}
                              {showSpeakerGender && (
                                <BadgeControl variant="outline" className="mt-1">
                                  {formatGenderBadgeLabel(t, speaker.user?.gender)}
                                </BadgeControl>
                              )}
                            </div>

                            {/* Speaker Title */}
                            <div className="text-center">
                              <p
                                className="text-muted-foreground truncate text-sm"
                                title={speaker.title ?? undefined}
                              >
                                {speaker.title}
                              </p>
                            </div>

                            {/* Time Badge */}
                            <div className="flex justify-center">
                              <BadgeControl variant="secondary" size="md" className="px-4 py-2">
                                <Clock className="mr-2 h-4 w-4" />
                                {formatTime(speakerTime)} ({speaker.time}
                                {translateText('generated.inline.0056_min_c5cceefd')}
                              </BadgeControl>
                            </div>

                            {/* Completed Badge */}
                            {speaker.completed && (
                              <div className="flex justify-center">
                                <BadgeControl
                                  variant="outline"
                                  className={featureThemeClassName(
                                    'agendaEventStreamSectionSuccessBackgroundAlpha'
                                  )}
                                >
                                  {translateText('generated.inline.0057_completed_1798b3ba')}
                                </BadgeControl>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
