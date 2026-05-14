import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import {
  buildWeekEventLayout,
  DEFAULT_WEEK_VIEW_SCROLL_TOP,
  getDateForWeekSlot,
  getWeekGridDays,
  getWeekSelectionRange,
  isSameWeekGridDay,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
  WEEK_VIEW_SLOT_MINUTES,
  WEEK_VIEW_SLOTS_PER_DAY,
} from '@/features/events/logic/weekViewGrid';
import { Calendar as CalendarIcon, MapPin } from 'lucide-react';
import {
  getCompactCalendarEventClassName,
  getCompactCalendarEventMetaClassName,
} from './compactCalendarEventStyles';

interface SharedWeekViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
  onCreateEventRange?: (range: { start: Date; end: Date }) => void;
}

interface WeekSelectionDraft {
  dayIndex: number;
  anchorSlot: number;
  currentSlot: number;
}

interface WeekSelectionState {
  dayIndex: number;
  startSlot: number;
  endSlot: number;
}

const TOTAL_DAY_HEIGHT = WEEK_VIEW_HOUR_HEIGHT * 24;
const GRID_TEMPLATE_COLUMNS = '4.5rem repeat(7, minmax(10rem, 1fr))';
const GRID_MIN_WIDTH = '74.5rem';
const EVENT_COLUMN_GAP_PX = 6;

function getPointerSlotIndex(event: React.PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height - 1);

  return Math.min(WEEK_VIEW_SLOTS_PER_DAY - 1, Math.floor(offsetY / WEEK_VIEW_SLOT_HEIGHT));
}

function getSelectionStyle(selection: { startSlot: number; endSlot: number }): CSSProperties {
  return {
    top: `${selection.startSlot * WEEK_VIEW_SLOT_HEIGHT}px`,
    height: `${Math.max(
      WEEK_VIEW_SLOT_HEIGHT,
      (selection.endSlot - selection.startSlot) * WEEK_VIEW_SLOT_HEIGHT
    )}px`,
  };
}

function getEventBlockStyle(
  column: number,
  columnCount: number,
  top: number,
  height: number
): CSSProperties {
  const widthPercent = 100 / columnCount;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPercent}% - ${EVENT_COLUMN_GAP_PX}px)`,
    left: `calc(${widthPercent * column}% + ${EVENT_COLUMN_GAP_PX / 2}px)`,
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

export function SharedWeekView({
  selectedDate,
  events,
  onDateSelect,
  onEventSelect,
  onCreateEventRange,
}: SharedWeekViewProps) {
  const { language, t } = useTranslation();
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draftSelectionRef = useRef<WeekSelectionDraft | null>(null);
  const [draftSelection, setDraftSelection] = useState<WeekSelectionDraft | null>(null);
  const [selection, setSelection] = useState<WeekSelectionState | null>(null);
  const weekDays = useMemo(() => getWeekGridDays(selectedDate), [selectedDate]);
  const weekStartKey = weekDays[0]?.getTime() ?? 0;
  const weekEventLayout = useMemo(() => buildWeekEventLayout(events, weekDays), [events, weekDays]);
  const dayLayouts = useMemo(
    () =>
      weekDays.map((_, dayIndex) => weekEventLayout.filter(layout => layout.dayIndex === dayIndex)),
    [weekDays, weekEventLayout]
  );
  const hourMarkers = useMemo(() => Array.from({ length: 25 }, (_, hour) => hour), []);
  const halfHourMarkers = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => hour * WEEK_VIEW_HOUR_HEIGHT + WEEK_VIEW_SLOT_HEIGHT),
    []
  );

  const clearSelection = useCallback(() => {
    draftSelectionRef.current = null;
    setDraftSelection(null);
    setSelection(null);
  }, []);

  const finalizeDraftSelection = useCallback((dayIndex?: number, slotIndex?: number) => {
    const currentDraft = draftSelectionRef.current;

    if (!currentDraft) {
      return;
    }

    const targetSlot =
      dayIndex === currentDraft.dayIndex && slotIndex !== undefined
        ? slotIndex
        : currentDraft.currentSlot;

    draftSelectionRef.current = null;
    setDraftSelection(null);
    setSelection({
      dayIndex: currentDraft.dayIndex,
      ...getWeekSelectionRange(currentDraft.anchorSlot, targetSlot),
    });
  }, []);

  useEffect(() => {
    draftSelectionRef.current = draftSelection;
  }, [draftSelection]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, weekStartKey]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTop = DEFAULT_WEEK_VIEW_SCROLL_TOP;
  }, [weekStartKey]);

  useEffect(() => {
    if (!draftSelection) {
      return;
    }

    const handlePointerUp = () => {
      finalizeDraftSelection();
    };

    const handlePointerCancel = () => {
      clearSelection();
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [clearSelection, draftSelection, finalizeDraftSelection]);

  useEffect(() => {
    if (!selection) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        clearSelection();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [clearSelection, selection]);

  const displayedSelection = useMemo(() => {
    if (draftSelection) {
      return {
        dayIndex: draftSelection.dayIndex,
        ...getWeekSelectionRange(draftSelection.anchorSlot, draftSelection.currentSlot),
      };
    }

    return selection;
  }, [draftSelection, selection]);

  const selectedRange = useMemo(() => {
    if (!selection) {
      return null;
    }

    const day = weekDays[selection.dayIndex];

    if (!day) {
      return null;
    }

    return {
      start: getDateForWeekSlot(day, selection.startSlot),
      end: getDateForWeekSlot(day, selection.endSlot),
    };
  }, [selection, weekDays]);

  const handleDayPointerDown = useCallback(
    (dayIndex: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      const slotIndex = getPointerSlotIndex(event);

      event.preventDefault();
      setSelection(null);
      const nextDraft = {
        dayIndex,
        anchorSlot: slotIndex,
        currentSlot: slotIndex,
      };
      draftSelectionRef.current = nextDraft;
      setDraftSelection(nextDraft);
    },
    []
  );

  const handleDayPointerMove = useCallback(
    (dayIndex: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      const currentDraft = draftSelectionRef.current;

      if (!currentDraft || currentDraft.dayIndex !== dayIndex) {
        return;
      }

      const slotIndex = getPointerSlotIndex(event);

      if (slotIndex === currentDraft.currentSlot) {
        return;
      }

      const nextDraft = {
        ...currentDraft,
        currentSlot: slotIndex,
      };
      draftSelectionRef.current = nextDraft;
      setDraftSelection(nextDraft);
    },
    []
  );

  const handleDayPointerUp = useCallback(
    (dayIndex: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draftSelectionRef.current || draftSelectionRef.current.dayIndex !== dayIndex) {
        return;
      }

      finalizeDraftSelection(dayIndex, getPointerSlotIndex(event));
    },
    [finalizeDraftSelection]
  );

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
            style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS, minWidth: GRID_MIN_WIDTH }}
          >
            <div className="bg-background/95 sticky top-0 left-0 z-40 border-r border-b backdrop-blur" />

            {weekDays.map(day => {
              const isToday = isSameWeekGridDay(day, new Date());
              const isSelected = isSameWeekGridDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={cn(
                    'sticky top-0 z-30 border-b px-2 py-3 text-center backdrop-blur transition-colors',
                    isSelected
                      ? 'bg-accent/80'
                      : isToday
                        ? 'border-primary/30 bg-primary/10'
                        : 'bg-background/95 hover:bg-accent/40'
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <p className="text-muted-foreground text-xs font-medium">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      (isToday || isSelected) && 'text-primary'
                    )}
                  >
                    {day.getDate()}
                  </p>
                </button>
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
              const popupTop = selection
                ? Math.min(selection.startSlot * WEEK_VIEW_SLOT_HEIGHT + 8, TOTAL_DAY_HEIGHT - 84)
                : 0;

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
                          {t('features.calendar.actions.createEvent')}
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
                      <button
                        key={event.id}
                        type="button"
                        className={cn(
                          'hover:ring-primary/20 absolute z-20 overflow-hidden rounded-md border p-1.5 text-left text-xs shadow-sm transition-all hover:ring-2',
                          getCompactCalendarEventClassName(event)
                        )}
                        style={getEventBlockStyle(
                          layout.column,
                          layout.columnCount,
                          layout.top,
                          layout.height
                        )}
                        onClick={clickEvent => {
                          clickEvent.stopPropagation();
                          clearSelection();
                          onEventSelect(event);
                        }}
                      >
                        <div className="flex items-center gap-1 truncate font-semibold">
                          {!event.isMeeting && <CalendarIcon className="h-3 w-3 shrink-0" />}
                          <span className="truncate">
                            {event.isMeeting ? `📅 ${event.title}` : event.title}
                          </span>
                        </div>
                        <p className={cn('truncate', metaClassName)}>
                          {formatTimeRange(new Date(event.start_date), eventEndDate, locale)}
                        </p>
                        {showLocation && event.location && (
                          <p
                            className={cn('mt-0.5 flex items-center gap-1 truncate', metaClassName)}
                          >
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </p>
                        )}
                      </button>
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
