interface CalendarVisibilityParticipant {
  user_id: string;
  user?: { id: string } | null;
}

interface CalendarVisibilityEvent {
  creator_id: string;
  creator?: { id: string } | null;
  participants?: readonly CalendarVisibilityParticipant[] | null;
  is_bookable: boolean;
  meeting_type?: string | null;
}

export function isCalendarEventOwnedByUser(
  event: CalendarVisibilityEvent,
  userId: string
): boolean {
  return event.creator_id === userId || event.creator?.id === userId;
}

export function isCalendarEventVisibleToUser(
  event: CalendarVisibilityEvent,
  userId: string
): boolean {
  const isOrganizer = isCalendarEventOwnedByUser(event, userId);
  const isParticipant =
    event.participants?.some(
      participant => participant.user_id === userId || participant.user?.id === userId
    ) ?? false;
  const isBookableMeeting = Boolean(event.is_bookable && event.meeting_type);

  return isOrganizer || isParticipant || isBookableMeeting;
}
