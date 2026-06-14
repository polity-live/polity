import { featureThemeClassName } from '@/features/shared/theme';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import { MapPin, Video } from 'lucide-react';
import type { MeetingInstance } from '../hooks/useMeetPage';
import {
  buildDayTimeLayout,
  getWeekViewBlockStyle,
  isSameWeekGridDay,
  WeekViewBlockButton,
  WeekViewDayHeaderButton,
  WEEK_VIEW_GRID_MIN_WIDTH,
  WEEK_VIEW_GRID_TEMPLATE_COLUMNS,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
} from '@/features/shared/ui/calendar';

interface MeetingWeekViewViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getInstancesForDate: (date: Date) => MeetingInstance[];
  onSelectInstance?: (instance: MeetingInstance) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  weekDays: Date[];
  halfHourMarkers: number[];
  hourMarkers: number[];
  locale: string;
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
  endTimestamp: number | null | undefined,
  locale: string
): string {
  const start = new Date(startTimestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end =
    endTimestamp != null
      ? new Date(endTimestamp).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return end ? `${start} - ${end}` : start;
}

export function MeetingWeekViewView({
  selectedDate,
  onDateSelect,
  getInstancesForDate,
  onSelectInstance,
  containerRef,
  weekDays,
  halfHourMarkers,
  hourMarkers,
  locale,
}: MeetingWeekViewViewProps) {
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
                  onDateSelect={onDateSelect}
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
                      <span className={featureThemeClassName('eventSharedWeekViewNeutralText')}>
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
