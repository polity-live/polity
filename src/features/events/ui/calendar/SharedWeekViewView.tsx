import type { CSSProperties } from 'react';

import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import {
  getWeekViewBlockStyle,
  isSameWeekGridDay,
  WeekViewBlockButton,
  WeekViewDayHeaderButton,
  WEEK_VIEW_GRID_MIN_WIDTH,
  WEEK_VIEW_GRID_TEMPLATE_COLUMNS,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
  WEEK_VIEW_SLOT_MINUTES,
} from '@/features/shared/ui/calendar';
import type {
  SharedWeekViewController,
  WeekSelectionState,
} from '@/features/events/hooks/useSharedWeekViewController';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react';
import {
  getCompactCalendarEventClassName,
  getCompactCalendarEventMetaClassName,
} from './compactCalendarEventStyles';

interface SharedWeekViewViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
  onCreateEventRange?: (range: { start: Date; end: Date }) => void;
  controller: SharedWeekViewController;
  locale: string;
  createEventLabel: string;
}

const TOTAL_DAY_HEIGHT = WEEK_VIEW_HOUR_HEIGHT * 24;

function getSelectionStyle(selection: { startSlot: number; endSlot: number }): CSSProperties {
  return {
    top: `${selection.startSlot * WEEK_VIEW_SLOT_HEIGHT}px`,
    height: `${Math.max(
      WEEK_VIEW_SLOT_HEIGHT,
      (selection.endSlot - selection.startSlot) * WEEK_VIEW_SLOT_HEIGHT
    )}px`,
  };
}

function formatHourLabel(hour: number, locale: string): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);

  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeRange(start: Date, end: Date, locale: string): string {
  return `${start.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getEventEndDate(event: CalendarEvent): Date {
  const endTimestamp =
    typeof event.end_date === 'number' && event.end_date > event.start_date
      ? event.end_date
      : event.start_date + WEEK_VIEW_SLOT_MINUTES * 60 * 1000;

  return new Date(endTimestamp);
}

function getPopupTop(selection: WeekSelectionState | null): number {
  return selection
    ? Math.min(selection.startSlot * WEEK_VIEW_SLOT_HEIGHT + 8, TOTAL_DAY_HEIGHT - 84)
    : 0;
}

export function SharedWeekViewView({
  selectedDate,
  onDateSelect,
  onEventSelect,
  onCreateEventRange,
  controller,
  locale,
  createEventLabel,
}: SharedWeekViewViewProps) {
  const {
    containerRef,
    weekDays,
    dayLayouts,
    hourMarkers,
    halfHourMarkers,
    displayedSelection,
    selection,
    selectedRange,
    clearSelection,
    handleDayPointerDown,
    handleDayPointerMove,
    handleDayPointerUp,
  } = controller;

  return (
    <Card>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="max-h-[75vh] min-h-[640px] overflow-auto rounded-xl select-none"
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
              <div className="relative" style={{ height: `${TOTAL_DAY_HEIGHT}px` }}>
                {hourMarkers.map(hour => (
                  <div
                    key={`time-${hour}`}
                    className="border-border/80 absolute inset-x-0 border-t"
                    style={{ top: `${hour * WEEK_VIEW_HOUR_HEIGHT}px` }}
                  >
                    {hour < 24 && (
                      <span className="text-muted-foreground absolute top-0 right-2 -translate-y-1/2 text-[11px] font-medium">
                        {formatHourLabel(hour, locale)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {weekDays.map((day, dayIndex) => {
              const isToday = isSameWeekGridDay(day, new Date());
              const isSelected = isSameWeekGridDay(day, selectedDate);
              const daySelection =
                displayedSelection?.dayIndex === dayIndex ? displayedSelection : null;
              const popupTop = getPopupTop(selection);

              return (
                <div
                  key={`${day.toISOString()}-column`}
                  className={cn(
                    'relative border-l',
                    isToday && 'bg-primary/[0.04]',
                    isSelected && 'bg-accent/10'
                  )}
                  style={{ height: `${TOTAL_DAY_HEIGHT}px` }}
                  onPointerDown={handleDayPointerDown(dayIndex)}
                  onPointerMove={handleDayPointerMove(dayIndex)}
                  onPointerUp={handleDayPointerUp(dayIndex)}
                >
                  {hourMarkers.map(hour => (
                    <div
                      key={`hour-line-${dayIndex}-${hour}`}
                      className="border-border/70 pointer-events-none absolute inset-x-0 border-t"
                      style={{ top: `${hour * WEEK_VIEW_HOUR_HEIGHT}px` }}
                    />
                  ))}
                  {halfHourMarkers.map(offset => (
                    <div
                      key={`half-line-${dayIndex}-${offset}`}
                      className="border-border/40 pointer-events-none absolute inset-x-0 border-t border-dashed"
                      style={{ top: `${offset}px` }}
                    />
                  ))}

                  {daySelection && (
                    <div
                      className="border-primary/40 bg-primary/10 pointer-events-none absolute inset-x-1 z-10 rounded-md border"
                      style={getSelectionStyle(daySelection)}
                    />
                  )}

                  {selection?.dayIndex === dayIndex && selectedRange && (
                    <div
                      className="absolute right-2 left-2 z-30"
                      style={{ top: `${popupTop}px` }}
                      onPointerDown={event => event.stopPropagation()}
                    >
                      <div className="bg-popover w-max max-w-full rounded-md border p-2 shadow-lg">
                        <p className="text-muted-foreground mb-2 text-[10px] font-medium">
                          {formatTimeRange(selectedRange.start, selectedRange.end, locale)}
                        </p>
                        <Button
                          size="sm"
                          disabled={!onCreateEventRange}
                          onClick={() => onCreateEventRange?.(selectedRange)}
                        >
                          {createEventLabel}
                        </Button>
                      </div>
                    </div>
                  )}

                  {dayLayouts[dayIndex]?.map(layout => {
                    const event = layout.event as CalendarEvent;
                    const metaClassName = getCompactCalendarEventMetaClassName(event);
                    const showLocation = layout.height >= WEEK_VIEW_SLOT_HEIGHT * 2;
                    const eventEndDate = getEventEndDate(event);

                    return (
                      <WeekViewBlockButton
                        key={event.id}
                        className={getCompactCalendarEventClassName(event)}
                        style={getWeekViewBlockStyle({
                          column: layout.column,
                          columnCount: layout.columnCount,
                          top: layout.top,
                          height: layout.height,
                        })}
                        onClick={clickEvent => {
                          clickEvent.stopPropagation();
                          clearSelection();
                          onEventSelect(event);
                        }}
                      >
                        <span className="flex items-center gap-1 truncate font-semibold">
                          {!event.isMeeting && <CalendarIcon className="h-3 w-3 shrink-0" />}
                          <span className="truncate">
                            {event.isMeeting ? `📅 ${event.title}` : event.title}
                          </span>
                        </span>
                        <span className={cn('block truncate', metaClassName)}>
                          {formatTimeRange(new Date(event.start_date), eventEndDate, locale)}
                        </span>
                        {showLocation && event.location && (
                          <span
                            className={cn('mt-0.5 flex items-center gap-1 truncate', metaClassName)}
                          >
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
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
