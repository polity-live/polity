import { featureThemeClassName } from '@/features/shared/theme';
import { useRef, useState, useEffect } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';

interface Speaker {
  id: string;
  title?: string | null;
  time?: number | null;
  completed?: boolean | null;
  order_index?: number | null;
  user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    avatar?: string | null;
    gender?: string | null;
  } | null;
}

interface CandidateSelection {
  candidate_id: string;
}

interface ChoiceDecision {
  choice_id: string;
}

interface CurrentAgendaItem {
  id: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  duration?: number | null;
  voting_phase?: string | null;
  election?: {
    id: string;
    title?: string | null;
    candidates?: CandidatesByElectionRow[];
    indicative_selections?: readonly CandidateSelection[];
    final_selections?: readonly CandidateSelection[];
    offline_tallies?: readonly {
      candidate_id?: string | null;
      phase?: string | null;
      count?: number | null;
    }[];
    electors?: { user_id?: string | null }[];
  }[];
  votes?: {
    id: string;
    title?: string | null;
    choices?: ChoicesByVoteRow[];
    indicative_decisions?: readonly ChoiceDecision[];
    final_decisions?: readonly ChoiceDecision[];
    offline_tallies?: readonly {
      choice_id?: string | null;
      phase?: string | null;
      count?: number | null;
    }[];
    voters?: { user_id?: string | null }[];
    majority_type?: string | null;
  }[];
  speaker_list?: Speaker[];
}

interface EventStreamSectionProps {
  eventId: string;
  streamUrl?: string | null;
  currentAgendaItem: CurrentAgendaItem | null;
  speakerList: Speaker[];
  showGender?: boolean;
  userId?: string;
  isUserCandidate: boolean;
  addingSpeaker: boolean;
  removingSpeaker: string | null;
  votingLoading: string | null;
  userSpeaker?: { id: string };
  onAddToSpeakerList?: () => void;
  onRemoveFromSpeakerList: (speakerId: string) => void;
  onBecomeCandidate?: () => void;
  onWithdrawCandidacy?: () => void;
  calculateSpeakerTime: (index: number) => Date;
  formatTime: (date: Date) => string;
}
export function useEventStreamSectionController({
  eventId,
  streamUrl,
  currentAgendaItem,
  speakerList,
  showGender,
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
}: EventStreamSectionProps) {
  const { t } = useTranslation();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [speakersExpanded, setSpeakersExpanded] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const election = currentAgendaItem?.election?.[0];
  const voteEntity = currentAgendaItem?.votes?.[0];

  // Derive election data
  const candidates = election?.candidates ?? [];
  const indicativeSelections = election?.indicative_selections ?? [];
  const finalSelections = election?.final_selections ?? [];
  const userHasVotedElection = election?.electors?.some(e => e.user_id === userId) ?? false;
  const userSelectedCandidateIds = finalSelections
    .filter(() => election?.electors?.some(e => e.user_id === userId) ?? false)
    .map(s => s.candidate_id);
  const electionStatus = currentAgendaItem?.voting_phase ?? null;

  // Derive vote data
  const choices = voteEntity?.choices ?? [];
  const indicativeDecisions = voteEntity?.indicative_decisions ?? [];
  const finalDecisions = voteEntity?.final_decisions ?? [];
  const userHasVotedVote = voteEntity?.voters?.some(v => v.user_id === userId) ?? false;
  const userSelectedChoiceIds = finalDecisions
    .filter(() => voteEntity?.voters?.some(v => v.user_id === userId) ?? false)
    .map(d => d.choice_id);
  const voteStatus = currentAgendaItem?.voting_phase ?? null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return featureThemeClassName('agendaEventStreamSectionSuccessBackground');
      case 'in-progress':
        return featureThemeClassName('agendaEventStreamSectionInfoBackground');
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
      case 'accreditation':
        return featureThemeClassName('agendaEventStreamSectionTealBackground');
      default:
        return featureThemeClassName('agendaEventStreamSectionSuccessBackground');
    }
  };

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
      carouselRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  if (!currentAgendaItem) {
    return null;
  }
  return {
    eventId,
    streamUrl,
    currentAgendaItem,
    speakerList,
    showGender,
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
    setCanScrollLeft,
    canScrollRight,
    setCanScrollRight,
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
    updateScrollButtons,
    scroll,
  };
}
