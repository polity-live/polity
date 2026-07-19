import { featureThemeClassName } from '@/features/shared/theme';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { MapPin, Video } from 'lucide-react';
import { formatTime } from '@/features/meet/logic/date-helpers.ts';
import type { MeetingInstance } from '../hooks/useMeetPage';
import { useMeetingWeekViewController } from '../hooks/useMeetingWeekViewController';
import { MeetingInstanceCard } from './MeetingInstanceCard';
import { CalendarChronologicalListView } from '@/features/shared/ui/calendar';
import { MeetingWeekViewView } from './MeetingWeekViewView';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface MeetingListViewProps {
  instances: MeetingInstance[];
  isOwner: boolean;
  onBook?: (instance: MeetingInstance) => void;
  onCancel?: (instance: MeetingInstance) => void;
  onDelete?: (eventId: string) => void;
  selectedDate: Date;
  onSelectInstance?: (instance: MeetingInstance) => void;
  creatorId?: string;
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
    return featureThemeClassName('meetMeetingCalendarViewsSuccessBorder');
  }

  if (instance.isBookable && !isFull) {
    return featureThemeClassName('meetMeetingCalendarViewsInfoBorder');
  }

  return '';
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
        !onClick && featureThemeClassName('meetMeetingCalendarViewsThemedBackground')
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
  creatorId,
}: MeetingListViewProps) {
  const { t } = useTranslation();

  const renderMeeting = (instance: MeetingInstance) => (
    <MeetingInstanceCard
      instance={instance}
      isOwner={isOwner}
      onBook={onBook}
      onCancel={onCancel}
      onDelete={onDelete}
      onSelect={onSelectInstance}
    />
  );

  if (creatorId) {
    const context = { creatorId, from: null, to: null, query: '', order: 'ascending' as const };
    return (
      <PolityZeroListView<any, { start_date: number; id: string }, typeof context>
        context={context}
        historyKey={`user-${creatorId}-meetings`}
        estimateSize={260}
        getRowKey={event => event.id}
        toStartRow={event => ({ start_date: event.start_date, id: event.id })}
        getPageQuery={({ limit, start, dir, settled }) => ({
          query: queries.events.calendarPage({ ...context, limit, start, dir }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        getSingleQuery={({ id, settled }) => ({
          query: queries.events.byId({ id }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        renderRow={event => {
          const eventInstances = instances
            .filter(instance => instance.parentEventId === event.id)
            .sort((left, right) => left.startDate - right.startDate);
          return (
            <div className="space-y-3 pb-4">
              {eventInstances.map(instance => (
                <div key={instance.id}>{renderMeeting(instance)}</div>
              ))}
            </div>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-52 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-12 text-center">
            {t('features.calendar.dayView.noEvents')}
          </p>
        )}
        className="h-[700px] overflow-auto"
      />
    );
  }

  return (
    <CalendarChronologicalListView
      items={instances}
      selectedDate={selectedDate}
      getItemDate={instance => instance.startDate}
      getItemKey={instance => instance.id}
      emptyText={t('features.calendar.dayView.noEvents')}
      renderItem={renderMeeting}
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
    <MeetingWeekViewView
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      getInstancesForDate={getInstancesForDate}
      onSelectInstance={onSelectInstance}
      containerRef={containerRef}
      weekDays={weekDays}
      halfHourMarkers={halfHourMarkers}
      hourMarkers={hourMarkers}
      locale={locale}
    />
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
