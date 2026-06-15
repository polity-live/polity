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
  onAddToSpeakerList?: () => void;
  onRemoveFromSpeakerList?: () => void;
  onMarkCompleted?: (speakerId: string) => void;
  className?: string;
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
  onAddToSpeakerList,
  onRemoveFromSpeakerList,
  onMarkCompleted,
  className,
}: AgendaSpeakerListSectionProps) {
  const viewProps = useAgendaSpeakerListSectionController({
    speakers,
    isUserInSpeakerList,
    canManageSpeakers,
    isAddingSpeaker,
    isRemovingSpeaker,
    userId,
    agendaStartTime,
    onAddToSpeakerList,
    onRemoveFromSpeakerList,
    onMarkCompleted,
    className,
  });

  return <AgendaSpeakerListSectionView {...viewProps} />;
}
