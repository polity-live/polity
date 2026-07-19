import { useNavigate } from '@tanstack/react-router';

import { useMeetingActions } from '@/zero/events/useMeetingActions';
import { useMeetingData } from './useMeetingData';

interface MeetingParticipantViewModel {
  id: string;
  status: string;
  booker?: {
    id: string;
    name?: string;
    handle?: string;
    avatar?: string;
  };
}

export function useMeetingDetailPage(meetingId: string) {
  const navigate = useNavigate();
  const {
    event,
    isLoading,
    isAuthenticated,
    isOwner,
    hasBooked,
    bookingCount,
    isPast,
    isAvailable,
  } = useMeetingData(meetingId);
  const { bookMeeting, cancelMeetingBooking } = useMeetingActions();

  if (isLoading) {
    return { state: 'loading' as const };
  }

  if (!event) {
    return { state: 'not-found' as const };
  }

  const creator = event.creator as
    | { id: string; first_name?: string | null; avatar?: string | null }
    | undefined;
  const participants = (event.participants ?? [])
    .map(
      (participant): MeetingParticipantViewModel => ({
        id: participant.id ?? '',
        status: participant.status ?? '',
        booker: participant.user
          ? {
              id: participant.user.id,
              name: participant.user.first_name ?? undefined,
              handle: participant.user.handle ?? undefined,
              avatar: participant.user.avatar ?? undefined,
            }
          : undefined,
      })
    )
    .filter(participant => participant.booker?.id !== event.creator_id);

  return {
    state: 'ready' as const,
    title: (event.title || 'Meeting') as string,
    isPublic: event.meeting_type === 'public-meeting',
    owner: {
      id: creator?.id ?? 'unknown',
      name: creator?.first_name ?? 'Unknown',
      avatar: creator?.avatar ?? undefined,
    },
    meetingType: event.meeting_type ?? '',
    bookingCount,
    meetingId: event.id,
    description: typeof event.description === 'string' ? event.description : '',
    isAuthenticated,
    isOwner,
    hasBooked,
    isAvailable,
    isPast,
    startTime: event.start_date ?? 0,
    endTime: event.end_date ?? 0,
    participants,
    about: event.description,
    onBook: () => bookMeeting(event.id),
    onCancelBooking: () => cancelMeetingBooking(event.id),
    onNavigateCalendar: () => navigate({ to: '/calendar' }),
    onNavigateEdit: () => navigate({ to: `/event/${event.id}` }),
  };
}
