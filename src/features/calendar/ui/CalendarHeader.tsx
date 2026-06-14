import { useNavigate } from '@tanstack/react-router';

import type { CalendarView } from '../types/calendar.types';
import { CalendarHeaderView } from './CalendarHeaderView';

interface CalendarHeaderProps {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  currentViewTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const CalendarHeader = (props: CalendarHeaderProps) => {
  const navigate = useNavigate();

  return <CalendarHeaderView {...props} onCreateEvent={() => navigate({ to: '/create/event' })} />;
};
