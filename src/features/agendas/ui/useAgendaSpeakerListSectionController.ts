'use client';

import { useEffect, useMemo, useState } from 'react';
import { type CarouselApi } from '@/features/shared/ui/ui/carousel';
import { useTranslation } from '@/features/shared/hooks/use-translation';

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
  onAddToSpeakerList: () => void;
  onRemoveFromSpeakerList?: () => void;
  onMarkCompleted?: (speakerId: string) => void;
  className?: string;
}
function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
export function useAgendaSpeakerListSectionController({
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [now, setNow] = useState(() => Date.now());

  const sortedSpeakers = [...speakers].sort((a, b) => a.order - b.order);
  const currentSpeakerIndex = sortedSpeakers.findIndex(speaker => !speaker.completed);
  const currentSpeaker = currentSpeakerIndex >= 0 ? sortedSpeakers[currentSpeakerIndex] : null;
  const queueStartTime =
    agendaStartTime ?? currentSpeaker?.startTime ?? sortedSpeakers[0]?.startTime ?? Date.now();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const speakerQueue = useMemo(() => {
    let accumulatedMinutes = 0;

    return sortedSpeakers.map((speaker, index) => {
      const estimatedStartTime = queueStartTime + accumulatedMinutes * 60 * 1000;
      const durationMinutes = speaker.time ?? 3;
      const estimatedEndTime = estimatedStartTime + durationMinutes * 60 * 1000;
      accumulatedMinutes += durationMinutes;

      const isCurrent = index === currentSpeakerIndex;
      const isPast = speaker.completed;
      const isCurrentUser = speaker.user?.id === userId && !speaker.completed;
      const activeStartTime = speaker.startTime ?? estimatedStartTime;
      const activeEndTime = activeStartTime + durationMinutes * 60 * 1000;
      const msUntilStart = estimatedStartTime - now;
      const msUntilEnd = activeEndTime - now;

      return {
        ...speaker,
        estimatedStartTime,
        estimatedEndTime,
        durationMinutes,
        isCurrent,
        isPast,
        isCurrentUser,
        msUntilStart,
        msUntilEnd,
      };
    });
  }, [sortedSpeakers, queueStartTime, currentSpeakerIndex, userId, now]);

  const userSpeaker = speakerQueue.find(speaker => speaker.isCurrentUser && !speaker.completed);
  const showMembershipState = isUserInSpeakerList || Boolean(userSpeaker);

  useEffect(() => {
    if (!carouselApi || !expanded) return;
    const targetIndex = currentSpeakerIndex >= 0 ? currentSpeakerIndex : 0;
    carouselApi.scrollTo(targetIndex, true);
  }, [carouselApi, currentSpeakerIndex, expanded, speakerQueue.length]);

  const renderRelativeTime = (speaker: (typeof speakerQueue)[number]) => {
    if (speaker.completed) {
      return t('features.events.agenda.completedSpeaker');
    }

    if (speaker.isCurrent) {
      return formatDuration(speaker.msUntilEnd);
    }

    if (speaker.msUntilStart <= 0) {
      return t('features.events.agenda.upNext');
    }

    return formatDuration(speaker.msUntilStart);
  };

  const renderTimingLabel = (speaker: (typeof speakerQueue)[number]) => {
    if (speaker.completed) {
      return t('features.events.agenda.turnCompletedLabel');
    }

    if (speaker.isCurrent) {
      return t('features.events.agenda.timeRemainingLabel');
    }

    return t('features.events.agenda.turnStartsIn');
  };
  return {
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
    t,
    expanded,
    setExpanded,
    carouselApi,
    setCarouselApi,
    now,
    setNow,
    sortedSpeakers,
    currentSpeakerIndex,
    currentSpeaker,
    queueStartTime,
    speakerQueue,
    userSpeaker,
    showMembershipState,
    renderRelativeTime,
    renderTimingLabel,
  };
}
