import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { useSharedWeekViewController } from '@/features/events/hooks/useSharedWeekViewController';
import { SharedWeekViewView } from './SharedWeekViewView';

interface SharedWeekViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
  onCreateEventRange?: (range: { start: Date; end: Date }) => void;
}

export function SharedWeekView({
  selectedDate,
  events,
  onDateSelect,
  onEventSelect,
  onCreateEventRange,
}: SharedWeekViewProps) {
  const { language, t } = useTranslation();
  const controller = useSharedWeekViewController({ selectedDate, events });
  const locale = language === 'de' ? 'de-DE' : 'en-US';

  return (
    <SharedWeekViewView
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      onEventSelect={onEventSelect}
      onCreateEventRange={onCreateEventRange}
      controller={controller}
      locale={locale}
      createEventLabel={t('features.calendar.actions.createEvent')}
    />
  );
}
