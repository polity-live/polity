import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { MapPin, Video } from 'lucide-react';
import { formatTime } from '@/features/meet/logic/date-helpers.ts';
import type { MeetingInstance } from '../hooks/useMeetPage';
import { useMeetingWeekViewController } from '../hooks/useMeetingWeekViewController';
import { MeetingInstanceCard } from './MeetingInstanceCard';
import {
  buildDayTimeLayout,
  CalendarChronologicalListView,
  getWeekViewBlockStyle,
  isSameWeekGridDay,
  WeekViewBlockButton,
  WeekViewDayHeaderButton,
  WEEK_VIEW_GRID_MIN_WIDTH,
  WEEK_VIEW_GRID_TEMPLATE_COLUMNS,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
} from '@/features/shared/ui/calendar';

interface MeetingListViewProps {
  instances: MeetingInstance[];
  isOwner: boolean;
  onBook: (instance: MeetingInstance) => void;
  onCancel: (instance: MeetingInstance) => void;
  onDelete: (eventId: string) => void;
  selectedDate: Date;
  onSelectInstance?: (instance: MeetingInstance) => void;
}

interface MeetingWeekViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getInstancesForDate: (date: Date) => MeetingInstance[];
  onSelectInstance?: (instance: MeetingInstance) => void;
}

interface MeetingMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getInstancesForDate: (date: Date) => MeetingInstance[];
  onSelectInstance?: (instance: MeetingInstance) => void;
}

function isSameDay(d1: Date | string | number, d2: Date): boolean {
  const date1 = new Date(d1);
  return (
    date1.getFullYear() === d2.getFullYear() &&
    date1.getMonth() === d2.getMonth() &&
    date1.getDate() === d2.getDate()
  );
}

function getMonthGrid(selectedDate: Date): (Date | null)[][] {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let index = 0; index < startDayOfWeek; index += 1) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function getCompactCardClassName(instance: MeetingInstance): string {
  const isFull = instance.bookingCount >= instance.maxBookings;

  if (instance.isBookedByMe) {
    return 'border-green-300 dark:border-green-800';
  }

  if (instance.isBookable && !isFull) {
    return 'border-dashed border-blue-300 dark:border-blue-800';
  }

  return '';
}

const MEETING_WEEK_TOTAL_DAY_HEIGHT = WEEK_VIEW_HOUR_HEIGHT * 24;

function getMeetingLocationLabel(instance: MeetingInstance): string | null {
  return instance.locationName || ((instance.locationUrl ?? instance.streamUrl) ? 'Online' : null);
}

function formatWeekHourLabel(hour: number, locale: string): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);

  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMeetingTimeRange(
  startTimestamp: number,
  endTimestamp: number,
  locale: string
): string {
  return `${new Date(startTimestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${new Date(endTimestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function CompactMeetingCard({
  instance,
  onClick,
}: {
  instance: MeetingInstance;
  onClick?: (instance: MeetingInstance) => void;
}) {
  const isPast = instance.endDate < Date.now();
  const locationLabel =
    instance.locationName || ((instance.locationUrl ?? instance.streamUrl) ? 'Online' : null);

  return (
    <div
      className={cn(
        'bg-card hover:bg-accent cursor-pointer rounded-md border p-1.5 text-xs shadow-sm transition-colors',
        getCompactCardClassName(instance),
        isPast && 'opacity-50',
        !onClick && 'cursor-default hover:bg-transparent'
      )}
      onClick={event => {
        event.stopPropagation();
        onClick?.(instance);
      }}
    >
      <p className="truncate font-medium">{instance.title}</p>
      <p className="text-muted-foreground">{formatTime(instance.startDate)}</p>
      {locationLabel && (
        <p className="text-muted-foreground flex items-center gap-0.5 truncate">
          {instance.locationName ? (
            <MapPin className="h-2.5 w-2.5 shrink-0" />
          ) : (
            <Video className="h-2.5 w-2.5 shrink-0" />
          )}
          {locationLabel}
        </p>
      )}
    </div>
  );
}

export function MeetingListView({
  instances,
  isOwner,
  onBook,
  onCancel,
  onDelete,
  selectedDate,
  onSelectInstance,
}: MeetingListViewProps) {
  const { t } = useTranslation();

  return (
    <CalendarChronologicalListView
      items={instances}
      selectedDate={selectedDate}
      getItemDate={instance => instance.startDate}
      getItemKey={instance => instance.id}
      emptyText={t('features.calendar.dayView.noEvents')}
      renderItem={instance => (
        <MeetingInstanceCard
          instance={instance}
          isOwner={isOwner}
          onBook={onBook}
          onCancel={onCancel}
          onDelete={onDelete}
          onSelect={onSelectInstance}
        />
      )}
    />
  );
}

export function MeetingWeekView({
  selectedDate,
  onDateSelect,
  getInstancesForDate,
  onSelectInstance,
}: MeetingWeekViewProps) {
  const { language } = useTranslation();
  const { containerRef, weekDays, halfHourMarkers, hourMarkers, locale } =
    useMeetingWeekViewController({
      selectedDate,
      language,
    });

  return (
    <Card>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="max-h-[75vh] min-h-[640px] overflow-auto rounded-xl"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: WEEK_VIEW_GRID_TEMPLATE_COLUMNS,
              minWidth: WEEK_VIEW_GRID_MIN_WIDTH,
            }}
          >
            <div className="bg-background/95 sticky top-0 left-0 z-40 border-r border-b backdrop-blur" />

            {weekDays.map(day => {
              const isToday = isSameWeekGridDay(day, new Date());
              const isSelected = isSameWeekGridDay(day, selectedDate);

              return (
                <WeekViewDayHeaderButton
                  key={day.toISOString()}
                  date={day}
                  locale={locale}
                  isSelected={isSelected}
                  isToday={isToday}
                  onSelect={onDateSelect}
                />
              );
            })}

            <div className="bg-background/95 sticky left-0 z-[25] border-r backdrop-blur">
              <div className="relative" style={{ height: `${MEETING_WEEK_TOTAL_DAY_HEIGHT}px` }}>
                {hourMarkers.map(hour => (
                  <div
                    key={`meeting-time-${hour}`}
                    className="border-border/80 absolute inset-x-0 border-t"
                    style={{ top: `${hour * WEEK_VIEW_HOUR_HEIGHT}px` }}
                  >
                    {hour < 24 && (
                      <span className="text-muted-foreground absolute top-0 right-2 -translate-y-1/2 text-[11px] font-medium">
                        {formatWeekHourLabel(hour, locale)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {weekDays.map(day => {
              const isToday = isSameWeekGridDay(day, new Date());
              const isSelected = isSameWeekGridDay(day, selectedDate);
              const dayInstances = getInstancesForDate(day);
              const dayLayouts = buildDayTimeLayout(
                dayInstances,
                instance => instance.startDate,
                instance => instance.endDate
              );

              return (
                <div
                  key={`${day.toISOString()}-column`}
                  className={cn(
                    'relative border-l',
                    isToday && 'bg-primary/[0.04]',
                    isSelected && 'bg-accent/10'
                  )}
                  style={{ height: `${MEETING_WEEK_TOTAL_DAY_HEIGHT}px` }}
                  onClick={() => onDateSelect(day)}
                >
                  {hourMarkers.map(hour => (
                    <div
                      key={`meeting-hour-line-${day.toISOString()}-${hour}`}
                      className="border-border/70 pointer-events-none absolute inset-x-0 border-t"
                      style={{ top: `${hour * WEEK_VIEW_HOUR_HEIGHT}px` }}
                    />
                  ))}
                  {halfHourMarkers.map(offset => (
                    <div
                      key={`meeting-half-line-${day.toISOString()}-${offset}`}
                      className="border-border/40 pointer-events-none absolute inset-x-0 border-t border-dashed"
                      style={{ top: `${offset}px` }}
                    />
                  ))}

                  {dayLayouts.map(layout => {
                    const instance = layout.item;
                    const isPast = instance.endDate < Date.now();
                    const locationLabel = getMeetingLocationLabel(instance);
                    const showLocation = layout.height >= WEEK_VIEW_SLOT_HEIGHT * 2;

                    return (
                      <WeekViewBlockButton
                        key={instance.id}
                        tone="card"
                        className={cn(getCompactCardClassName(instance), isPast && 'opacity-50')}
                        style={getWeekViewBlockStyle({
                          column: layout.column,
                          columnCount: layout.columnCount,
                          top: layout.top,
                          height: layout.height,
                        })}
                        onClick={event => {
                          event.stopPropagation();
                          onSelectInstance?.(instance);
                        }}
                      >
                        <span className="block truncate font-medium">{instance.title}</span>
                        <span className="text-muted-foreground block truncate">
                          {formatMeetingTimeRange(instance.startDate, instance.endDate, locale)}
                        </span>
                        {showLocation && locationLabel && (
                          <span className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                            {instance.locationName ? (
                              <MapPin className="h-3 w-3 shrink-0" />
                            ) : (
                              <Video className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">{locationLabel}</span>
                          </span>
                        )}
                      </WeekViewBlockButton>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LABELS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function MeetingMonthView({
  selectedDate,
  onDateSelect,
  getInstancesForDate,
  onSelectInstance,
}: MeetingMonthViewProps) {
  const { language } = useTranslation();
  const weeks = getMonthGrid(selectedDate);
  const today = new Date();
  const weekdayLabels = language === 'de' ? WEEKDAY_LABELS_DE : WEEKDAY_LABELS_EN;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-7 gap-px border-b pb-2">
          {weekdayLabels.map(label => (
            <div key={label} className="text-muted-foreground text-center text-xs font-medium">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <div key={`${weekIndex}-${dayIndex}`} className="bg-muted/30 min-h-[120px]" />
                );
              }

              const dayInstances = getInstancesForDate(day);
              const isCurrentDay = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn(
                    'hover:bg-accent/30 min-h-[120px] cursor-pointer border-r border-b p-1 transition-colors',
                    isSelected && 'bg-accent/50'
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
                      {dayInstances.map(instance => (
                        <CompactMeetingCard
                          key={instance.id}
                          instance={instance}
                          onClick={selectedInstance => onSelectInstance?.(selectedInstance)}
                        />
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
