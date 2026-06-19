import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
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
  FileText,
  Users,
  Vote,
  UserCheck,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { AgendaNavigationControls } from './AgendaNavigationControls';
import { AgendaElectionSection, isAutoAssignedRoleElection } from './AgendaElectionSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { AccreditationSection } from './AccreditationSection';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { getYouTubeVideoId } from '../logic/agendaUiHelpers';
function getAgendaItemIcon(type: string) {
  switch (type) {
    case 'election':
      return <UserCheck className="h-5 w-5" />;
    case 'vote':
      return <Vote className="h-5 w-5" />;
    case 'speech':
      return <Users className="h-5 w-5" />;
    case 'accreditation':
      return <ShieldCheck className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

export interface EventStreamSectionViewProps {
  eventId: any;
  streamUrl: any;
  currentAgendaItem: any;
  speakerList: any[];
  userId: any;
  isUserCandidate: any;
  addingSpeaker: any;
  removingSpeaker: any;
  votingLoading: any;
  userSpeaker: any;
  onAddToSpeakerList: any;
  onRemoveFromSpeakerList: any;
  onBecomeCandidate: any;
  onWithdrawCandidacy: any;
  calculateSpeakerTime: any;
  formatTime: any;
  t: any;
  carouselRef: any;
  canScrollLeft: any;
  setCanScrollLeft: any;
  canScrollRight: any;
  setCanScrollRight: any;
  speakersExpanded: any;
  setSpeakersExpanded: any;
  expanded: any;
  setExpanded: any;
  election: any;
  voteEntity: any;
  candidates: any;
  indicativeSelections: any;
  finalSelections: any;
  userHasVotedElection: any;
  userSelectedCandidateIds: any[];
  electionStatus: any;
  choices: readonly any[];
  indicativeDecisions: readonly any[];
  finalDecisions: readonly any[];
  userHasVotedVote: any;
  userSelectedChoiceIds: any[];
  voteStatus: any;
  getStatusColor: any;
  getTypeColor: any;
  updateScrollButtons: any;
  scroll: any;
}

export function EventStreamSectionView({
  eventId,
  streamUrl,
  currentAgendaItem,
  speakerList,
  userId,
  isUserCandidate,
  addingSpeaker,
  removingSpeaker,
  votingLoading,
  userSpeaker,
  onAddToSpeakerList,
  onRemoveFromSpeakerList,
  onBecomeCandidate,
  onWithdrawCandidacy,
  calculateSpeakerTime,
  formatTime,
  t,
  carouselRef,
  canScrollLeft,
  canScrollRight,
  speakersExpanded,
  setSpeakersExpanded,
  expanded,
  setExpanded,
  election,
  voteEntity,
  candidates,
  indicativeSelections,
  finalSelections,
  userHasVotedElection,
  userSelectedCandidateIds,
  electionStatus,
  choices,
  indicativeDecisions,
  finalDecisions,
  userHasVotedVote,
  userSelectedChoiceIds,
  voteStatus,
  getStatusColor,
  getTypeColor,
  scroll,
}: EventStreamSectionViewProps) {
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card surface="primaryStrong">
        <CardHeader surface="primarySoft">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={featureThemeClassName('agendaEventAgendaThemedPanel')}
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground relative flex h-10 w-10 items-center justify-center rounded-lg shadow-md">
                  {getAgendaItemIcon(
                    currentAgendaItem.type ??
                      translateText('generated.inline.0011_discussion_c255751d')
                  )}
                  <div
                    className={featureThemeClassName(
                      'agendaEventStreamSectionSuccessContrastPulseDot'
                    )}
                  >
                    <Play
                      className={featureThemeClassName('agendaEventStreamSectionContrastStyle')}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeControl variant="default" pulse>
                    {t('features.events.stream.live')}
                  </BadgeControl>
                  <CardTitle className="text-lg">{currentAgendaItem.title}</CardTitle>
                </div>
              </div>
              {expanded ? (
                <ChevronUp className="text-muted-foreground h-5 w-5" />
              ) : (
                <ChevronDown className="text-muted-foreground h-5 w-5" />
              )}
            </Button>
          </CollapsibleTrigger>
          <div className="mt-2 flex items-center gap-2">
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
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link
                to="/event/$id/agenda/$agendaItemId"
                params={{ id: eventId, agendaItemId: currentAgendaItem.id }}
              >
                {t('features.events.stream.viewDetails')}
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-4">
            {/* Live Stream Video */}
            {streamUrl &&
              (() => {
                const videoId = getYouTubeVideoId(streamUrl);
                return videoId ? (
                  <div
                    className={featureThemeClassName('agendaEventStreamSectionContrastBackground')}
                  >
                    <div className="aspect-video">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`}
                        title={t('features.events.stream.liveStream')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null;
              })()}

            {/* Description */}
            {currentAgendaItem.description && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {currentAgendaItem.description}
                </p>
              </div>
            )}

            {/* Agenda Navigation Controls */}
            <AgendaNavigationControls eventId={eventId} />

            {/* Election Section */}
            {election && candidates.length > 0 && (
              <AgendaElectionSection
                roleName={election.title ?? t('features.events.agenda.role')}
                electionMode={
                  (election as { election_mode?: string | null }).election_mode
                    ? normalizeElectionMode(
                        (election as { election_mode?: string | null }).election_mode
                      )
                    : null
                }
                seatCount={(election as { seat_count?: number | null }).seat_count ?? null}
                candidates={candidates}
                indicativeSelections={indicativeSelections}
                finalSelections={finalSelections}
                offlineTallies={election.offline_tallies ?? []}
                delegateTargetEventId={
                  (election as { delegate_assignment_meta?: { targetEventId?: string } | null })
                    .delegate_assignment_meta?.targetEventId
                }
                showRoleAssignedMessage={isAutoAssignedRoleElection(election)}
                userHasVoted={userHasVotedElection}
                userSelectedCandidateIds={userSelectedCandidateIds}
                electionStatus={electionStatus}
                canVote={!!userId}
                canBeCandidate={false}
                isUserCandidate={isUserCandidate}
                isVotingLoading={votingLoading === election.id}
                onBecomeCandidate={onBecomeCandidate ?? (() => undefined)}
                onWithdrawCandidacy={onWithdrawCandidacy}
              />
            )}

            {/* Accreditation Section */}
            {currentAgendaItem.type === 'accreditation' && (
              <AccreditationSection eventId={eventId} agendaItemId={currentAgendaItem.id} />
            )}

            {/* Vote Section */}
            {voteEntity && choices.length > 0 && (
              <AgendaVoteSection
                voteId={voteEntity.id}
                voteTitle={voteEntity.title || 'Vote'}
                choices={[...choices]}
                indicativeDecisions={[...indicativeDecisions]}
                finalDecisions={[...finalDecisions]}
                offlineTallies={voteEntity.offline_tallies ?? []}
                userHasVoted={userHasVotedVote}
                userSelectedChoiceIds={userSelectedChoiceIds}
                voteStatus={voteStatus}
                majorityType={voteEntity.majority_type}
                totalEligibleVoters={voteEntity.voters?.length}
              />
            )}

            {/* Speaker List */}
            <Collapsible open={speakersExpanded} onOpenChange={setSpeakersExpanded}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={featureThemeClassName('agendaEventStreamSectionThemedPanel')}
                    >
                      <h3 className="text-lg font-semibold">
                        {t('features.events.stream.speakersList')} ({speakerList.length})
                      </h3>
                      {speakersExpanded ? (
                        <ChevronUp className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <ChevronDown className="text-muted-foreground h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  {userSpeaker ? (
                    <Button
                      onClick={() => onRemoveFromSpeakerList(userSpeaker.id)}
                      disabled={removingSpeaker === userSpeaker.id}
                      variant="outline"
                      size="sm"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {removingSpeaker === userSpeaker.id
                        ? translateText('generated.inline.0015_removing_2a76d431')
                        : translateText('generated.inline.0016_remove_yourself_fa3b0e30')}
                    </Button>
                  ) : onAddToSpeakerList ? (
                    <Button
                      onClick={onAddToSpeakerList}
                      disabled={addingSpeaker || !userId}
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {addingSpeaker
                        ? translateText('generated.inline.0017_adding_268c06a2')
                        : translateText('generated.inline.0018_add_yourself_71fba1c3')}
                    </Button>
                  ) : null}
                </div>

                <CollapsibleContent>
                  {speakerList.length === 0 ? (
                    <div className="py-8 text-center">
                      <User className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                      <p className="text-muted-foreground text-sm">
                        {translateText('generated.inline.0054_no_speakers_yet_47546d9a')}
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {canScrollLeft && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-full shadow-lg"
                          onClick={() => scroll('left')}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                      )}
                      {canScrollRight && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-full shadow-lg"
                          onClick={() => scroll('right')}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      )}
                      <div
                        ref={carouselRef}
                        className="flex gap-4 overflow-x-auto scroll-smooth px-10 pb-3"
                        style={{ scrollbarWidth: 'thin' }}
                      >
                        {speakerList.map((speaker: any, index: number) => {
                          const speakerTime = calculateSpeakerTime(index);
                          const speakerName =
                            `${speaker.user?.first_name ?? ''} ${speaker.user?.last_name ?? ''}`.trim() ||
                            speaker.user?.email ||
                            'Unknown';
                          const speakerAvatar = speaker.user?.avatar ?? undefined;
                          const isCurrentUser = speaker.user?.id === userId;

                          return (
                            <Card
                              key={speaker.id}
                              className={`relative w-56 flex-shrink-0 ${
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
                                  onClick={() => onRemoveFromSpeakerList(speaker.id)}
                                  disabled={removingSpeaker === speaker.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              <CardContent className="space-y-3 p-4">
                                <div className="flex justify-center">
                                  <Avatar className="border-background h-16 w-16 border-4 shadow-lg">
                                    <AvatarImage src={speakerAvatar} />
                                    <AvatarFallback className="text-xl">
                                      {speakerName[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="text-center">
                                  <h4
                                    className="truncate text-sm font-semibold"
                                    title={speakerName}
                                  >
                                    {speakerName}
                                  </h4>
                                  {isCurrentUser && (
                                    <BadgeControl variant="secondary" className="mt-1">
                                      {translateText('generated.inline.0055_you_905cb326')}
                                    </BadgeControl>
                                  )}
                                </div>
                                <div className="flex justify-center">
                                  <BadgeControl variant="secondary" size="sm" className="px-3 py-1">
                                    <Clock className="mr-1.5 h-3 w-3" />
                                    {formatTime(speakerTime)} ({speaker.time}
                                    {translateText('generated.inline.0056_min_c5cceefd')}
                                  </BadgeControl>
                                </div>
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
                </CollapsibleContent>
              </div>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
