import { useNavigate } from '@tanstack/react-router';

import type { CalendarEvent } from '../types/calendar.types';
import { getBaseEventId } from '../logic/eventIdUtils';
import { MonthViewView } from './MonthViewView';

interface MonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
}

export const MonthView = (props: MonthViewProps) => {
  const navigate = useNavigate();

  return (
    <MonthViewView
      {...props}
      onEventOpen={eventId => {
        const baseEventId = getBaseEventId(eventId);
        navigate({ to: `/event/${baseEventId}` });
      }}
    />
  );
};
