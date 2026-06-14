import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '../types/calendar.types';
import { getWeekDays, isSameDay, formatTime } from '../logic/dateUtils';

interface WeekViewViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  onEventOpen: (eventId: string) => void;
}

export const WeekViewView = ({
  selectedDate,
  events,
  allEvents,
  onEventOpen,
}: WeekViewViewProps) => {
  const { t, language } = useTranslation();
  const weekDays = getWeekDays(selectedDate);

  const getEventsForDate = (date: Date) => {
    return allEvents.filter(event => isSameDay(event.start_date, date));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('features.calendar.weekView.title')}</CardTitle>
        <CardDescription>
          {events.length === 1
            ? t('features.calendar.weekView.eventCount', { count: events.length })
            : t('features.calendar.weekView.eventCountPlural', { count: events.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[200px] rounded-lg border p-2',
                  isSelected && 'border-primary bg-accent',
                  isToday && !isSelected && 'border-primary'
                )}
              >
                <div className="mb-2 text-center">
                  <p className="text-muted-foreground text-xs font-medium">
                    {day.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                      weekday: 'short',
                    })}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      isToday && 'text-primary',
                      isSelected && 'text-primary'
                    )}
                  >
                    {day.getDate()}
                  </p>
                </div>
                <ScrollArea className="h-[140px]">
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <Button
                        key={event.id}
                        type="button"
                        variant="ghost"
                        className="hover:bg-accent block h-auto w-full rounded border p-1.5 text-left text-xs whitespace-normal transition-colors"
                        onClick={() => onEventOpen(event.id)}
                      >
                        <span className="block truncate font-medium">
                          {event.isMeeting && '📅 '}
                          {event.title}
                        </span>
                        <span className="text-muted-foreground block">
                          {formatTime(event.start_date)}
                        </span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
