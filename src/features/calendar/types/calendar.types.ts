import type { EventForCalendarRow } from '@/zero/events/queries';

export type CalendarView = 'day' | 'week' | 'month';
export type CalendarViewMode = 'list' | 'week' | 'month';

export interface CalendarUser {
  id: string;
  name?: string;
  avatar?: string;
}

export type CalendarEvent = Omit<
  EventForCalendarRow,
  'start_date' | 'end_date' | 'title' | 'description'
> & {
  start_date: number;
  end_date: number;
  title: string;
  description: string;
  location?: string;
  location_url?: string | null;
  organizer?: CalendarUser;
  groupName?: string;
  organizerName?: string;
  attendeeCount?: number;
  hashtags?: { id: string; tag: string }[];
  isMeeting?: boolean;
  isOwner?: boolean;
  bookingCount?: number;
  isBookedByMe?: boolean;
  isRecurringInstance?: boolean;
  recurringParentId?: string;
  instanceDate?: string;
  stream_url?: string | null;
};
