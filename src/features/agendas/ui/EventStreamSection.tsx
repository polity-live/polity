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
import { useEventStreamSectionController } from './useEventStreamSectionController';
import { EventStreamSectionView } from './EventStreamSectionView';

export function EventStreamSection({
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
  const viewProps = useEventStreamSectionController({
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
  });

  if (!viewProps) return null;

  return <EventStreamSectionView {...viewProps} />;
}
