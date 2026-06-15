import { featureThemeClassName } from '@/features/shared/theme';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, Users, Vote, UserCheck } from 'lucide-react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useEventStream } from '../hooks/useEventStream';
import { useTranslation } from '@/features/shared/hooks/use-translation';
function resolveAttendanceMode(
  event?: {
    attendance_mode?: string | null;
    location_type?: string | null;
  } | null
) {
  if (event?.attendance_mode === 'online' || event?.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event?.location_type === 'online' ? 'online' : 'offline';
}
import { EventStreamView } from './EventStreamView';
export function EventStream({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const carouselRef = useRef<HTMLDivElement>(null);
  const activeContentRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const previousAgendaItemIdRef = useRef<string | null>(null);

  const {
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
  } = useEventStream(eventId);

  const [speakersExpanded, setSpeakersExpanded] = useState(true);
  const attendanceMode = resolveAttendanceMode(event);
  const confirmedOfflineParticipantCount =
    event?.offline_participants?.filter(
      participant =>
        participant.attendance_status === 'confirmed' &&
        participant.participation_channel === 'offline'
    ).length ?? 0;

  // Prepare election data for AgendaElectionSection
  const election = currentAgendaItem?.election?.[0];

  const indicativeSelections = useMemo(() => {
    if (!election) return [];
    return election.indicative_selections || [];
  }, [election]);

  const finalSelections = useMemo(() => {
    if (!election) return [];
    return election.final_selections || [];
  }, [election]);

  const userHasElectionVoted = useMemo(() => {
    if (!user?.id || !election) return false;
    const userElector = election.electors?.find((e: { user_id: string }) => e.user_id === user.id);
    if (!userElector) return false;
    // Check if user has any selections in indicative or final
    return (
      indicativeSelections.some(
        (s: { elector_participation_id?: string | null }) => s.elector_participation_id != null
      ) ||
      finalSelections.some(
        (s: { elector_participation_id?: string | null }) => s.elector_participation_id != null
      )
    );
  }, [user?.id, election, indicativeSelections, finalSelections]);

  const userSelectedCandidateIds = useMemo(() => {
    if (!user?.id || !election) return [];
    const selections = election.status === 'indicative' ? indicativeSelections : finalSelections;
    return selections
      .filter((s: { candidate_id: string }) => s.candidate_id)
      .map((s: { candidate_id: string }) => s.candidate_id);
  }, [user?.id, election, indicativeSelections, finalSelections]);

  const isUserCandidate = useMemo(() => {
    if (!user?.id || !election?.candidates) return false;
    return election.candidates.some((c: { user_id: string }) => c.user_id === user.id);
  }, [user?.id, election?.candidates]);

  // Prepare vote data for AgendaVoteSection
  const voteEntity = currentAgendaItem?.votes?.[0];

  const indicativeDecisions = useMemo(() => {
    if (!voteEntity) return [];
    return voteEntity.indicative_decisions || [];
  }, [voteEntity]);

  const finalDecisions = useMemo(() => {
    if (!voteEntity) return [];
    return voteEntity.final_decisions || [];
  }, [voteEntity]);

  const userHasVoteVoted = useMemo(() => {
    if (!user?.id || !voteEntity) return false;
    const userVoter = voteEntity.voters?.find((v: { user_id: string }) => v.user_id === user.id);
    return !!userVoter;
  }, [user?.id, voteEntity]);

  const userSelectedChoiceIds = useMemo(() => {
    if (!user?.id || !voteEntity) return [];
    const decisions = voteEntity.status === 'indicative' ? indicativeDecisions : finalDecisions;
    return decisions
      .filter((d: { choice_id: string }) => d.choice_id)
      .map((d: { choice_id: string }) => d.choice_id);
  }, [user?.id, voteEntity, indicativeDecisions, finalDecisions]);

  // Show toast notification when agenda item changes
  useEffect(() => {
    const currentId = currentAgendaItem?.id;
    if (currentId && currentId !== previousAgendaItemIdRef.current) {
      if (previousAgendaItemIdRef.current !== null) {
        // Show toast notification for agenda item change
        toast(t('features.events.agenda.itemActivated'), {
          description: currentAgendaItem.title,
        });
        // Auto-scroll to active content
        setTimeout(() => {
          activeContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      previousAgendaItemIdRef.current = currentId;
    }
  }, [currentAgendaItem?.id, currentAgendaItem?.title, toast, t]);

  // Carousel scroll handlers
  const updateScrollButtons = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', updateScrollButtons);
      return () => carousel.removeEventListener('scroll', updateScrollButtons);
    }
  }, [speakerList]);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      const newScrollLeft =
        direction === 'left'
          ? carouselRef.current.scrollLeft - scrollAmount
          : carouselRef.current.scrollLeft + scrollAmount;

      carouselRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  const getAgendaItemIcon = (type: string) => {
    switch (type) {
      case 'election':
        return <UserCheck className="h-5 w-5" />;
      case 'vote':
        return <Vote className="h-5 w-5" />;
      case 'speech':
        return <Users className="h-5 w-5" />;
      case 'discussion':
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return featureThemeClassName('agendaEventStreamSectionSuccessBackground');
      case 'in-progress':
        return featureThemeClassName('agendaEventStreamSectionInfoBackground');
      case 'pending':
      default:
        return featureThemeClassName('agendaEventStreamSectionNeutralBackground');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'election':
        return featureThemeClassName('agendaEventStreamSectionAccentBackground');
      case 'vote':
        return featureThemeClassName('agendaEventStreamSectionWarningBackground');
      case 'speech':
        return featureThemeClassName('agendaEventStreamSectionInfoBackground');
      case 'discussion':
      default:
        return featureThemeClassName('agendaEventStreamSectionSuccessBackground');
    }
  };
  return (
    <EventStreamView
      eventId={eventId}
      navigate={navigate}
      t={t}
      carouselRef={carouselRef}
      activeContentRef={activeContentRef}
      canScrollLeft={canScrollLeft}
      setCanScrollLeft={setCanScrollLeft}
      canScrollRight={canScrollRight}
      setCanScrollRight={setCanScrollRight}
      previousAgendaItemIdRef={previousAgendaItemIdRef}
      event={event}
      currentAgendaItem={currentAgendaItem}
      speakerList={speakerList}
      user={user}
      isLoading={isLoading}
      addingSpeaker={addingSpeaker}
      removingSpeaker={removingSpeaker}
      canJoinSpeakerList={canJoinSpeakerList}
      userSpeaker={userSpeaker}
      handleAddToSpeakerList={handleAddToSpeakerList}
      handleRemoveFromSpeakerList={handleRemoveFromSpeakerList}
      calculateSpeakerTime={calculateSpeakerTime}
      formatTime={formatTime}
      speakersExpanded={speakersExpanded}
      setSpeakersExpanded={setSpeakersExpanded}
      attendanceMode={attendanceMode}
      confirmedOfflineParticipantCount={confirmedOfflineParticipantCount}
      election={election}
      indicativeSelections={indicativeSelections}
      finalSelections={finalSelections}
      userHasElectionVoted={userHasElectionVoted}
      userSelectedCandidateIds={userSelectedCandidateIds}
      isUserCandidate={isUserCandidate}
      voteEntity={voteEntity}
      indicativeDecisions={indicativeDecisions}
      finalDecisions={finalDecisions}
      userHasVoteVoted={userHasVoteVoted}
      userSelectedChoiceIds={userSelectedChoiceIds}
      updateScrollButtons={updateScrollButtons}
      scroll={scroll}
      getAgendaItemIcon={getAgendaItemIcon}
      getStatusColor={getStatusColor}
      getTypeColor={getTypeColor}
    />
  );
}
