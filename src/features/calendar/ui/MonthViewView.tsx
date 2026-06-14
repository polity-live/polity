import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Calendar } from '@/features/shared/ui/ui/calendar';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '../types/calendar.types';
import { isSameDay, formatTime } from '../logic/dateUtils';

interface MonthViewViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  onEventOpen: (eventId: string) => void;
}

export const MonthViewView = ({
  selectedDate,
  onDateSelect,
  events,
  allEvents,
  onEventOpen,
}: MonthViewViewProps) => {
  const { t, language } = useTranslation();

  const getEventsForDate = (date: Date) => {
    return allEvents.filter((event: any) => isSameDay(event.start_date, date));
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('features.calendar.monthView.title')}</CardTitle>
            <CardDescription>
              {events.length === 1
                ? t('features.calendar.monthView.eventCount', { count: events.length })
                : t('features.calendar.monthView.eventCountPlural', { count: events.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={date => date && onDateSelect(date)}
              month={selectedDate}
              onMonthChange={onDateSelect}
              modifiers={{
                hasEvents: (date: Date) => getEventsForDate(date).length > 0,
              }}
              modifiersClassNames={{
                hasEvents:
                  'font-bold text-primary relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary',
              }}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.length === 1
                ? t('features.calendar.monthView.eventCount', { count: selectedDateEvents.length })
                : t('features.calendar.monthView.eventCountPlural', {
                    count: selectedDateEvents.length,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {t('features.calendar.monthView.noEvents')}
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {selectedDateEvents.map((event: any) => (
                    <Button
                      key={event.id}
                      type="button"
                      variant="ghost"
                      className="hover:bg-accent block h-auto w-full rounded-lg border p-3 text-left whitespace-normal transition-colors"
                      onClick={() => onEventOpen(event.id)}
                    >
                      <span className="block font-semibold">
                        {event.isMeeting && '📅 '}
                        {event.title}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {formatTime(event.start_date)}
                      </span>
                      {event.location && !event.isMeeting && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {event.location}
                        </span>
                      )}
                      {event.isMeeting && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {event.visibility === 'public'
                            ? t('features.calendar.eventCard.publicMeeting')
                            : t('features.calendar.eventCard.privateMeeting')}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
