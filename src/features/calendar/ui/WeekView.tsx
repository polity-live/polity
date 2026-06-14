import { useNavigate } from '@tanstack/react-router';

import type { CalendarEvent } from '../types/calendar.types';
import { getBaseEventId } from '../logic/eventIdUtils';
import { WeekViewView } from './WeekViewView';

interface WeekViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
}

export const WeekView = (props: WeekViewProps) => {
  const navigate = useNavigate();

  return (
    <WeekViewView
      {...props}
      onEventOpen={eventId => {
        const baseEventId = getBaseEventId(eventId);
        navigate({ to: `/event/${baseEventId}` });
      }}
    />
  );
};
