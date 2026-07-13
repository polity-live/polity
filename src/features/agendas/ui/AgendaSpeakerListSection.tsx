'use client';

interface Speaker {
  id: string;
  order: number;
  time: number;
  completed: boolean;
  title?: string;
  startTime?: number;
  endTime?: number;
  user?: {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
    gender?: string | null;
  };
}

interface AgendaSpeakerListSectionProps {
  speakers: Speaker[];
  isUserInSpeakerList: boolean;
  canManageSpeakers: boolean;
  isAddingSpeaker: boolean;
  isRemovingSpeaker?: boolean;
  userId?: string;
  agendaStartTime?: number;
  showGender?: boolean;
  onAddToSpeakerList?: () => void;
  onRemoveFromSpeakerList?: () => void;
  onMarkCompleted?: (speakerId: string) => void;
  className?: string;
  agendaItemId?: string;
}
import { useAgendaSpeakerListSectionController } from './useAgendaSpeakerListSectionController';
import { AgendaSpeakerListSectionView } from './AgendaSpeakerListSectionView';

export function AgendaSpeakerListSection({
  speakers,
  isUserInSpeakerList,
  canManageSpeakers,
  isAddingSpeaker,
  isRemovingSpeaker,
  userId,
  agendaStartTime,
  showGender,
  onAddToSpeakerList,
  onRemoveFromSpeakerList,
  onMarkCompleted,
  className,
  agendaItemId,
}: AgendaSpeakerListSectionProps) {
  const viewProps = useAgendaSpeakerListSectionController({
    speakers,
    isUserInSpeakerList,
    canManageSpeakers,
    isAddingSpeaker,
    isRemovingSpeaker,
    userId,
    agendaStartTime,
    showGender,
    onAddToSpeakerList,
    onRemoveFromSpeakerList,
    onMarkCompleted,
    className,
    agendaItemId,
  });

  return <AgendaSpeakerListSectionView {...viewProps} />;
}
