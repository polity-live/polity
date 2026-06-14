import { featureThemeClassName } from '@/features/shared/theme';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react';
import {
  getCompactCalendarEventClassName,
  getCompactCalendarEventMetaClassName,
} from './compactCalendarEventStyles';

interface SharedMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
}

function isSameDay(d1: Date | string | number, d2: Date): boolean {
  const date1 = new Date(d1);
  return (
    date1.getFullYear() === d2.getFullYear() &&
    date1.getMonth() === d2.getMonth() &&
    date1.getDate() === d2.getDate()
  );
}

function formatTime(date: string | number | Date): string {
  return new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getMonthGrid(selectedDate: Date): (Date | null)[][] {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Fill leading nulls
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill trailing nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function SharedMonthView({
  selectedDate,
  onDateSelect,
  events,
  onEventSelect,
}: SharedMonthViewProps) {
  const { language } = useTranslation();
  const weeks = getMonthGrid(selectedDate);
  const today = new Date();
  const weekdayLabels = language === 'de' ? WEEKDAY_LABELS_DE : WEEKDAY_LABELS_EN;

  const getEventsForDate = (date: Date) =>
    events
      .filter((e: any) => isSameDay(e.start_date, date))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px border-b pb-2">
          {weekdayLabels.map((label: any) => (
            <div key={label} className="text-muted-foreground text-center text-xs font-medium">
              {label}
            </div>
          ))}
        </div>

        {/* Week rows */}
        <div className="grid grid-cols-7 gap-px">
          {weeks.map((week: any, weekIndex: number) =>
            week.map((day: any, dayIndex: number) => {
              if (!day) {
                return (
                  <div key={`${weekIndex}-${dayIndex}`} className="bg-muted/30 min-h-[120px]" />
                );
              }

              const dayEvents = getEventsForDate(day);
              const isCurrentDay = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn(
                    'min-h-[120px] border-r border-b p-1 transition-colors',
                    isSelected && 'bg-accent/50',
                    'hover:bg-accent/30 cursor-pointer'
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        isCurrentDay && 'bg-primary text-primary-foreground',
                        isSelected && !isCurrentDay && 'bg-accent-foreground/10 font-bold'
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <ScrollArea className="h-[90px]">
                    <div className="space-y-0.5">
                      {dayEvents.map((event: any) => (
                        <div
                          key={event.id}
                          className={cn(
                            featureThemeClassName('eventSharedMonthThemedText'),
                            getCompactCalendarEventClassName(event)
                          )}
                          onClick={e => {
                            e.stopPropagation();
                            onEventSelect(event);
                          }}
                        >
                          <p className="flex items-center gap-1 truncate font-medium">
                            {!event.isMeeting && <CalendarIcon className="h-2.5 w-2.5 shrink-0" />}
                            <span className="truncate">
                              {event.isMeeting && '📅 '}
                              {event.title}
                            </span>
                          </p>
                          <p className={getCompactCalendarEventMetaClassName(event)}>
                            {formatTime(event.start_date)}
                          </p>
                          {event.location && (
                            <p
                              className={cn(
                                'flex items-center gap-0.5 truncate',
                                getCompactCalendarEventMetaClassName(event)
                              )}
                            >
                              <MapPin className="h-2 w-2 shrink-0" />
                              {event.location}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
